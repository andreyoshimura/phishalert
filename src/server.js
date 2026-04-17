const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const url = require("node:url");

const PORT = Number(process.env.PORT || 3003);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = path.join(__dirname, "official");
const DATA_DIR = path.join(__dirname, "..", "data");
const DOSSIERS_DIR = path.join(DATA_DIR, "dossiers");
const EVENTS_FILE = path.join(DATA_DIR, "events.jsonl");
const APP_ORIGIN = `http://${HOST}:${PORT}`;
const APP_HOSTNAME = new URL(APP_ORIGIN).hostname;
const SUSPICIOUS_TLDS = [
  ".click",
  ".club",
  ".cyou",
  ".gq",
  ".ga",
  ".loan",
  ".ml",
  ".tk",
  ".top",
  ".xyz",
];
const SUSPICIOUS_HOST_KEYWORDS = [
  "auth",
  "bank",
  "login",
  "portal",
  "secure",
  "session",
  "signin",
  "support",
  "update",
  "verify",
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

const RISK_ORDER = {
  low: 0,
  medium: 1,
  high: 2,
};

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureDossiersDir() {
  ensureDataDir();
  fs.mkdirSync(DOSSIERS_DIR, { recursive: true });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function appendEvent(event) {
  ensureDataDir();
  fs.appendFileSync(EVENTS_FILE, `${JSON.stringify(event)}\n`, "utf8");
}

function extractTrustedHeaders(req) {
  return {
    "x-forwarded-for": req.headers["x-forwarded-for"] || "",
    "x-real-ip": req.headers["x-real-ip"] || "",
    "cf-ipcountry": req.headers["cf-ipcountry"] || "",
    "x-country": req.headers["x-country"] || "",
    "x-geo-country": req.headers["x-geo-country"] || "",
    "x-region": req.headers["x-region"] || "",
    "x-geo-region": req.headers["x-geo-region"] || "",
    "x-city": req.headers["x-city"] || "",
    "x-geo-city": req.headers["x-geo-city"] || "",
    "x-asn": req.headers["x-asn"] || "",
    "x-geo-asn": req.headers["x-geo-asn"] || "",
    "x-org": req.headers["x-org"] || "",
    "x-geo-org": req.headers["x-geo-org"] || "",
    "x-isp": req.headers["x-isp"] || "",
    "x-geo-isp": req.headers["x-geo-isp"] || "",
  };
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }
  return value ? String(value) : "";
}

function dossierToMarkdown(dossier) {
  const indicators = dossier.indicators
    .map((indicator) => `- ${indicator.type}: ${indicator.value}`)
    .join("\n");
  const actions = dossier.recommended_actions.map((action) => `- ${action}`).join("\n");
  const codes = dossier.indicator_codes.map((code) => `- \`${code}\``).join("\n");
  const network = dossier.evidence.network || {};
  const geo = network.geo || {};

  return [
    `# ${dossier.dossier_id}`,
    "",
    "## Triage",
    `- **Risk level:** ${dossier.risk_level}`,
    `- **Score:** ${dossier.score}`,
    `- **Summary:** ${dossier.summary}`,
    `- **Created at:** ${dossier.created_at}`,
    "",
    "## Origin",
    `- **Page origin:** ${dossier.evidence.page_origin}`,
    `- **Page path:** ${dossier.evidence.page_path}`,
    `- **Referrer origin:** ${dossier.evidence.referrer_origin || "n/a"}`,
    `- **Referrer path:** ${dossier.evidence.referrer_path || "n/a"}`,
    `- **Campaign token present:** ${dossier.evidence.campaign_token_present}`,
    `- **Observed at:** ${dossier.evidence.observed_at}`,
    "",
    "## Network / Geo",
    `- **Remote address:** ${network.remote_address || "n/a"}`,
    `- **Forwarded for:** ${network.forwarded_for || "n/a"}`,
    `- **Real IP:** ${network.real_ip || "n/a"}`,
    `- **Geo source:** ${geo.source || "n/a"}`,
    `- **Country:** ${geo.country || "n/a"}`,
    `- **Region:** ${geo.region || "n/a"}`,
    `- **City:** ${geo.city || "n/a"}`,
    `- **ASN:** ${geo.asn || "n/a"}`,
    `- **Org:** ${geo.org || "n/a"}`,
    `- **ISP:** ${geo.isp || "n/a"}`,
    "",
    "## Evidence",
    indicators || "- none",
    "",
    "## Indicator Codes",
    codes || "- none",
    "",
    "## Recommendation",
    actions || "- none",
    "",
    "## Source Event",
    `- **Event type:** ${dossier.source_event.event_type}`,
    `- **Received at:** ${dossier.source_event.received_at}`,
    `- **Page URL:** ${dossier.source_event.page_url}`,
    `- **Campaign token present:** ${dossier.source_event.campaign_token_present}`,
    "",
    "## Operational Notes",
    ...(dossier.operational_notes || []).map((note) => `- ${note}`),
    "",
  ].join("\n");
}

function writeDossierExports(dossier) {
  ensureDossiersDir();
  const jsonPath = path.join(DOSSIERS_DIR, `${dossier.dossier_id}.json`);
  const mdPath = path.join(DOSSIERS_DIR, `${dossier.dossier_id}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(dossier, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, dossierToMarkdown(dossier), "utf8");
  return {
    json_path: path.relative(DATA_DIR, jsonPath),
    markdown_path: path.relative(DATA_DIR, mdPath),
  };
}

function isIPv4Hostname(hostname) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function extractUrlParts(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return {
      origin: parsed.origin,
      hostname: parsed.hostname.toLowerCase(),
      pathname: parsed.pathname || "/",
    };
  } catch {
    return null;
  }
}

function extractNetworkContext(event) {
  const headers = event.headers || {};
  const forwardedFor = normalizeHeaderValue(event.x_forwarded_for || headers["x-forwarded-for"] || "");
  const realIp = normalizeHeaderValue(event.x_real_ip || headers["x-real-ip"] || "");
  const country =
    normalizeHeaderValue(
      event.waf_country ||
        headers["cf-ipcountry"] ||
        headers["x-country"] ||
        headers["x-geo-country"] ||
        ""
    ) || "";
  const region = normalizeHeaderValue(headers["x-region"] || headers["x-geo-region"] || "");
  const city = normalizeHeaderValue(headers["x-city"] || headers["x-geo-city"] || "");
  const asn = normalizeHeaderValue(headers["x-asn"] || headers["x-geo-asn"] || "");
  const org = normalizeHeaderValue(headers["x-org"] || headers["x-geo-org"] || "");
  const isp = normalizeHeaderValue(headers["x-isp"] || headers["x-geo-isp"] || "");

  return {
    remote_address: event.remote_address || "",
    forwarded_for: forwardedFor,
    real_ip: realIp,
    geo: {
      country,
      region,
      city,
      asn,
      org,
      isp,
      source: country || region || city || asn || org || isp ? "waf_headers" : "unavailable",
    },
  };
}

function readEvents() {
  if (!fs.existsSync(EVENTS_FILE)) {
    return [];
  }

  const raw = fs.readFileSync(EVENTS_FILE, "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function getRiskRank(riskLevel) {
  return RISK_ORDER[riskLevel] ?? 0;
}

function buildDossier(event) {
  const analysis = event.analysis || analyzeEvent(event);
  const referrerParts = extractUrlParts(event.referrer || event.referer_header || "");
  const pageParts = extractUrlParts(event.page_url || APP_ORIGIN);
  const indicatorSet = new Set(analysis.reasons);

  const indicators = [];
  if (referrerParts) {
    indicators.push({
      type: "referrer_origin",
      value: referrerParts.origin,
    });
    indicators.push({
      type: "referrer_path",
      value: referrerParts.pathname,
    });
  }

  if (event.campaign_token) {
    indicators.push({
      type: "campaign_token_present",
      value: true,
    });
  }

  if (event.user_agent_header || event.user_agent) {
    indicators.push({
      type: "user_agent",
      value: event.user_agent_header || event.user_agent,
    });
  }

  const evidence = {
    page_origin: pageParts ? pageParts.origin : event.page_url || APP_ORIGIN,
    page_path: pageParts ? pageParts.pathname : "/",
    referrer_origin: referrerParts ? referrerParts.origin : "",
    referrer_path: referrerParts ? referrerParts.pathname : "",
    campaign_token_present: Boolean(event.campaign_token),
    observed_at: event.received_at || event.timestamp || "",
    network: extractNetworkContext(event),
  };

  const recommendedActions = [];
  if (analysis.risk_level === "high") {
    recommendedActions.push("open_takedown_case");
    recommendedActions.push("notify_waf_and_brand_protection");
  } else if (analysis.risk_level === "medium") {
    recommendedActions.push("collect_additional_evidence");
    recommendedActions.push("continue_monitoring");
  } else {
    recommendedActions.push("keep_under_watch");
  }

  return {
    dossier_id: `dossier_${crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          page_url: event.page_url || APP_ORIGIN,
          referrer: event.referrer || event.referer_header || "",
          received_at: event.received_at || event.timestamp || "",
          risk_level: analysis.risk_level,
          score: analysis.score,
        })
      )
      .digest("hex")
      .slice(0, 16)}`,
    created_at: new Date().toISOString(),
    risk_level: analysis.risk_level,
    score: analysis.score,
    summary:
      analysis.risk_level === "high"
        ? "High-risk redirect or impersonation event"
        : analysis.risk_level === "medium"
          ? "Suspicious event requiring follow-up"
          : "Low-risk event",
    indicators,
    indicator_codes: Array.from(indicatorSet),
    evidence,
    recommended_actions: recommendedActions,
    source_event: {
      event_type: event.event_type,
      received_at: event.received_at || event.timestamp || "",
      page_url: event.page_url || APP_ORIGIN,
      campaign_token_present: Boolean(event.campaign_token),
    },
    operational_notes: [
      "Use geo fields only when supplied by trusted WAF or edge headers.",
      "Do not rely on geo alone for enforcement decisions.",
    ],
  };
}

function analyzeEvent(event) {
  const reasons = [];
  let score = 0;
  let riskLevel = "low";
  const effectiveReferrer = event.referrer || event.referer_header || "";
  const referrerParts = extractUrlParts(effectiveReferrer);

  if (
    event.event_type === "official_page_view" ||
    event.event_type === "official_login_submit" ||
    event.event_type === "official_login_post"
  ) {
    if (!effectiveReferrer) {
      reasons.push("referrer_absente");
      score += 25;
    } else if (!referrerParts) {
      reasons.push("referrer_invalido");
      score += 20;
    } else {
      if (referrerParts.hostname !== APP_HOSTNAME) {
        reasons.push("referrer_externo");
        score += 20;

        if (isIPv4Hostname(referrerParts.hostname)) {
          reasons.push("origin_ip");
          score += 15;
        }

        if (SUSPICIOUS_TLDS.some((tld) => referrerParts.hostname.endsWith(tld))) {
          reasons.push("origin_tld_suspeito");
          score += 15;
        }

        if (
          SUSPICIOUS_HOST_KEYWORDS.some((keyword) => referrerParts.hostname.includes(keyword))
        ) {
          reasons.push("origin_keyword_suspeito");
          score += 20;
        }

        if (/\/(go|redirect|redir|out|auth|login)\b/i.test(referrerParts.pathname)) {
          reasons.push("origin_path_redirect");
          score += 10;
        }
      }
    }

    if (event.campaign_token) {
      reasons.push("token_presente");
      score += 15;
    }

    if (event.event_type === "official_login_submit") {
      if (event.form && event.form.username_present) {
        reasons.push("submit_com_usuario");
        score += 5;
      }
      if (event.form && event.form.password_present) {
        reasons.push("submit_com_senha");
        score += 5;
      }
    }
  }

  if (score >= 50) {
    riskLevel = "high";
  } else if (score >= 25) {
    riskLevel = "medium";
  }

  return {
    score,
    risk_level: riskLevel,
    reasons,
  };
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendText(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

function resolveFile(requestPath) {
  const normalized = requestPath === "/" ? "/index.html" : requestPath;
  const candidate = path.normalize(path.join(ROOT, normalized));
  if (!candidate.startsWith(ROOT)) return null;
  return candidate;
}

function serveStatic(req, res) {
  const filePath = resolveFile(url.parse(req.url).pathname || "/");
  if (!filePath) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, 404, "Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  if (req.method === "GET" && parsed.pathname === "/api/events") {
    try {
      const events = readEvents();
      sendJson(res, 200, { events });
    } catch (error) {
      sendJson(res, 500, { error: "failed_to_read_events" });
    }
    return;
  }

  if (req.method === "GET" && parsed.pathname === "/api/cases") {
    try {
      const events = readEvents();
      const cases = events.map((event) => ({
        ...event,
        analysis: analyzeEvent(event),
      }));
      sendJson(res, 200, { cases });
    } catch (error) {
      sendJson(res, 500, { error: "failed_to_read_cases" });
    }
    return;
  }

  if (req.method === "GET" && parsed.pathname === "/api/dossiers") {
    try {
      const minRisk = String(parsed.query.min_risk || "low").toLowerCase();
      const minRank = getRiskRank(minRisk);
      const dossiers = readEvents()
        .map((event) => ({
          ...event,
          analysis: analyzeEvent(event),
        }))
        .filter((event) => getRiskRank(event.analysis.risk_level) >= minRank)
        .map((event) => buildDossier(event));
      sendJson(res, 200, { dossiers });
    } catch (error) {
      sendJson(res, 500, { error: "failed_to_build_dossiers" });
    }
    return;
  }

  if (req.method === "POST" && parsed.pathname === "/api/events") {
    try {
      const event = await readJson(req);
      const storedEvent = {
        ...event,
        received_at: new Date().toISOString(),
        remote_address: req.socket.remoteAddress || "",
        user_agent_header: req.headers["user-agent"] || "",
        referer_header: req.headers.referer || "",
        headers: extractTrustedHeaders(req),
      };
      const analysis = analyzeEvent(storedEvent);
      const dossier = buildDossier({
        ...storedEvent,
        analysis,
      });
      const exportPaths =
        getRiskRank(dossier.risk_level) >= getRiskRank("medium")
          ? writeDossierExports(dossier)
          : null;
      appendEvent({
        ...storedEvent,
        analysis,
        dossier,
        export_paths: exportPaths,
      });
      sendJson(res, 202, { ok: true, analysis, dossier, export_paths: exportPaths });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: "invalid_json" });
    }
    return;
  }

  if (req.method === "POST" && parsed.pathname === "/login") {
    try {
      const body = await readJson(req);
      const loginEvent = {
        event_type: "official_login_submit",
        page_url: APP_ORIGIN,
        referrer: req.headers.referer || "",
        campaign_token: "",
        form: {
          username_present: Boolean((body.username || "").toString().trim()),
          password_present: Boolean((body.password || "").toString().trim()),
        },
        received_at: new Date().toISOString(),
        remote_address: req.socket.remoteAddress || "",
        user_agent_header: req.headers["user-agent"] || "",
        referer_header: req.headers.referer || "",
        headers: extractTrustedHeaders(req),
      };
      const analysis = analyzeEvent(loginEvent);
      const dossier = buildDossier({
        ...loginEvent,
        analysis,
      });
      const exportPaths =
        getRiskRank(dossier.risk_level) >= getRiskRank("medium")
          ? writeDossierExports(dossier)
          : null;
      appendEvent({
        ...loginEvent,
        analysis,
        dossier,
        export_paths: exportPaths,
      });
      sendJson(res, 200, { ok: true, analysis, dossier, export_paths: exportPaths });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: "invalid_json" });
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`phishalert local server running at http://${HOST}:${PORT}`);
});
