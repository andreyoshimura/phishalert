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

function dossierToMarkdown(dossier) {
  const indicators = dossier.indicators
    .map((indicator) => `- ${indicator.type}: ${indicator.value}`)
    .join("\n");
  const actions = dossier.recommended_actions.map((action) => `- ${action}`).join("\n");
  const codes = dossier.indicator_codes.map((code) => `- ${code}`).join("\n");

  return [
    `# ${dossier.dossier_id}`,
    "",
    `- Created at: ${dossier.created_at}`,
    `- Risk level: ${dossier.risk_level}`,
    `- Score: ${dossier.score}`,
    `- Summary: ${dossier.summary}`,
    "",
    "## Indicators",
    indicators || "- none",
    "",
    "## Indicator Codes",
    codes || "- none",
    "",
    "## Evidence",
    `- Page origin: ${dossier.evidence.page_origin}`,
    `- Page path: ${dossier.evidence.page_path}`,
    `- Referrer origin: ${dossier.evidence.referrer_origin || "n/a"}`,
    `- Referrer path: ${dossier.evidence.referrer_path || "n/a"}`,
    `- Campaign token present: ${dossier.evidence.campaign_token_present}`,
    `- Observed at: ${dossier.evidence.observed_at}`,
    "",
    "## Recommended Actions",
    actions || "- none",
    "",
    "## Source Event",
    `- Event type: ${dossier.source_event.event_type}`,
    `- Received at: ${dossier.source_event.received_at}`,
    `- Page URL: ${dossier.source_event.page_url}`,
    `- Campaign token present: ${dossier.source_event.campaign_token_present}`,
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
