const http = require("http");

const PORT = Number(process.env.ANTHROPIC_PROXY_PORT || 8787);
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

function writeJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    writeJson(res, 404, { error: "Not found." });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    writeJson(res, 200, {
      ok: true,
      configured: !!process.env.ANTHROPIC_API_KEY
    });
    return;
  }

  if (req.method !== "POST" || req.url !== "/anthropic/messages") {
    writeJson(res, 404, { error: "Not found." });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    writeJson(res, 500, {
      error: "ANTHROPIC_API_KEY is not set. Start the proxy with your Anthropic key in the environment."
    });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (err) {
    writeJson(res, 400, { error: err.message || "Invalid request body." });
    return;
  }

  try {
    const upstream = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION
      },
      body: JSON.stringify(payload)
    });
    const raw = await upstream.text();
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end(raw);
  } catch (err) {
    writeJson(res, 502, {
      error: err && err.message ? err.message : "Anthropic upstream request failed."
    });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Anthropic proxy listening on http://127.0.0.1:${PORT}`);
});
