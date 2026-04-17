const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const url = require("node:url");

const PORT = Number(process.env.PORT || 3003);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = path.join(__dirname, "official");
const DATA_DIR = path.join(__dirname, "..", "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.jsonl");
const APP_ORIGIN = `http://${HOST}:${PORT}`;

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

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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

function analyzeEvent(event) {
  const reasons = [];
  let score = 0;
  let riskLevel = "low";

  if (
    event.event_type === "official_page_view" ||
    event.event_type === "official_login_submit" ||
    event.event_type === "official_login_post"
  ) {
    if (!event.referrer) {
      reasons.push("referrer_absente");
      score += 25;
    } else {
      try {
        const referrerOrigin = new URL(event.referrer).origin;
        if (referrerOrigin !== APP_ORIGIN) {
          reasons.push("referrer_externo");
          score += 40;
        }
      } catch {
        reasons.push("referrer_invalido");
        score += 20;
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
      const raw = fs.existsSync(EVENTS_FILE) ? fs.readFileSync(EVENTS_FILE, "utf8") : "";
      const events = raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      sendJson(res, 200, { events });
    } catch (error) {
      sendJson(res, 500, { error: "failed_to_read_events" });
    }
    return;
  }

  if (req.method === "GET" && parsed.pathname === "/api/cases") {
    try {
      const raw = fs.existsSync(EVENTS_FILE) ? fs.readFileSync(EVENTS_FILE, "utf8") : "";
      const events = raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
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
      appendEvent({
        ...storedEvent,
        analysis,
      });
      sendJson(res, 202, { ok: true, analysis });
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
      };
      appendEvent({
        ...loginEvent,
        analysis: analyzeEvent(loginEvent),
      });
      sendJson(res, 200, { ok: true });
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
