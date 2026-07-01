import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 8901);

const ALLOWED_ROOTS = new Set([".layout", ".product-page", ".research-page"]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function resolveFile(urlPath) {
  let pathname = decodeURIComponent(urlPath.split("?")[0]);
  if (pathname === "/") pathname = "/index.html";

  const normalized = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.join(ROOT, normalized);

  if (!full.startsWith(ROOT)) return null;
  return full;
}

function savePage(pagePath, rootSelector, innerHtml) {
  if (!ALLOWED_ROOTS.has(rootSelector)) {
    throw new Error("Invalid root selector");
  }

  const filePath = resolveFile(pagePath);
  if (!filePath || !filePath.endsWith(".html")) {
    throw new Error("Invalid page path");
  }

  const source = fs.readFileSync(filePath, "utf8");
  const doc = parse(source, { comment: true });
  const rootEl = doc.querySelector(rootSelector);

  if (!rootEl) {
    throw new Error(`Root element not found: ${rootSelector}`);
  }

  const beforeInner = rootEl.innerHTML;
  rootEl.innerHTML = innerHtml;
  rootEl.innerHTML = beforeInner;
  const beforeOuter = rootEl.outerHTML;

  const start = source.indexOf(beforeOuter);
  if (start !== -1) {
    const end = start + beforeOuter.length;
    const openEnd = beforeOuter.indexOf(">") + 1;
    const closeStart = beforeOuter.lastIndexOf("<");
    const updatedOuter =
      beforeOuter.slice(0, openEnd) + innerHtml + beforeOuter.slice(closeStart);
    fs.writeFileSync(
      filePath,
      source.slice(0, start) + updatedOuter + source.slice(end),
      "utf8"
    );
    return;
  }

  rootEl.innerHTML = innerHtml;
  fs.writeFileSync(filePath, doc.toString(), "utf8");
}

function cssFromOverrides(allOverrides) {
  const PROPS = [
    { key: "marginTop", prop: "margin-top" },
    { key: "marginBottom", prop: "margin-bottom" },
    { key: "paddingTop", prop: "padding-top" },
    { key: "paddingBottom", prop: "padding-bottom" },
    { key: "gap", prop: "gap" },
  ];
  const lines = [
    "/* GraceCareer layout overrides — auto-generated, do not edit by hand */",
    "",
  ];
  Object.keys(allOverrides).forEach(function (page) {
    const pageRules = allOverrides[page];
    Object.keys(pageRules).forEach(function (selector) {
      const rules = pageRules[selector];
      const decls = PROPS.filter(function (p) {
        return rules[p.key] != null;
      })
        .map(function (p) {
          return "  " + p.prop + ": " + rules[p.key] + "px !important;";
        })
        .join("\n");
      if (decls) {
        lines.push(selector + " {");
        lines.push(decls);
        lines.push("}");
        lines.push("");
      }
    });
  });
  return lines.join("\n");
}

function saveLayout(pagePath, pageOverrides) {
  const jsonPath = path.join(ROOT, "data/layout-overrides.json");
  const cssPath = path.join(ROOT, "css/layout-overrides.css");

  let all = {};
  if (fs.existsSync(jsonPath)) {
    try {
      all = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    } catch (_) {
      all = {};
    }
  }

  if (Object.keys(pageOverrides).length === 0) {
    delete all[pagePath];
  } else {
    all[pagePath] = pageOverrides;
  }

  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(all, null, 2) + "\n", "utf8");
  fs.writeFileSync(cssPath, cssFromOverrides(all), "utf8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/save-layout") {
    try {
      const raw = await readBody(req);
      const data = JSON.parse(raw);
      const { pagePath, overrides } = data;

      if (typeof pagePath !== "string" || typeof overrides !== "object" || overrides === null) {
        sendJson(res, 400, { ok: false, error: "Invalid payload" });
        return;
      }

      saveLayout(pagePath, overrides);
      sendJson(res, 200, { ok: true, pagePath });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err.message || "Save failed" });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/save-page") {
    try {
      const raw = await readBody(req);
      const data = JSON.parse(raw);
      const { pagePath, rootSelector, html } = data;

      if (
        typeof pagePath !== "string" ||
        typeof rootSelector !== "string" ||
        typeof html !== "string"
      ) {
        sendJson(res, 400, { ok: false, error: "Invalid payload" });
        return;
      }

      savePage(pagePath, rootSelector, html);
      sendJson(res, 200, { ok: true, pagePath, rootSelector });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err.message || "Save failed" });
    }
    return;
  }

  const filePath = resolveFile(req.url || "/");
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`GraceCareer dev server → http://127.0.0.1:${PORT}`);
  console.log(`Text edit:   append ?edit=1`);
  console.log(`Layout edit: append ?layout=1`);
});
