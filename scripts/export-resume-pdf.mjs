import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const DEFAULT_BASE = "https://truthhere.github.io/GraceResume";
const DEFAULT_OUT = path.join(ROOT, "assets", "grace-he-resume.pdf");
const PORT = Number(process.env.PDF_PORT || 8902);

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
  ".woff2": "font/woff2",
};

function parseArgs(argv) {
  const opts = {
    lang: "zh",
    baseUrl: process.env.RESUME_BASE_URL || DEFAULT_BASE,
    output: DEFAULT_OUT,
    port: PORT,
  };

  argv.forEach(function (arg) {
    if (arg.startsWith("--lang=")) opts.lang = arg.slice(7);
    else if (arg.startsWith("--base-url=")) opts.baseUrl = arg.slice(11).replace(/\/$/, "");
    else if (arg.startsWith("--out=")) opts.output = path.resolve(arg.slice(6));
    else if (arg.startsWith("--port=")) opts.port = Number(arg.slice(7));
  });

  return opts;
}

function resolveFile(urlPath) {
  let pathname = decodeURIComponent(urlPath.split("?")[0]);
  if (pathname === "/") pathname = "/index.html";
  const normalized = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.join(ROOT, normalized);
  if (!full.startsWith(ROOT)) return null;
  return full;
}

function startStaticServer(port) {
  return new Promise(function (resolve, reject) {
    const server = http.createServer(function (req, res) {
      const filePath = resolveFile(req.url || "/");
      if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      const stream = fs.createReadStream(filePath);
      stream.on("error", function () {
        res.writeHead(500);
        res.end();
      });
      stream.pipe(res);
    });

    server.on("error", reject);
    server.listen(port, "127.0.0.1", function () {
      resolve(server);
    });
  });
}

function findChromeExecutable() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];

  return candidates.find(function (p) {
    return fs.existsSync(p);
  });
}

async function loadPuppeteer() {
  try {
    return await import("puppeteer");
  } catch (_) {
    try {
      return await import("puppeteer-core");
    } catch (err) {
      throw new Error(
        "Missing puppeteer. Run: npm install puppeteer --save-dev\n" + err.message
      );
    }
  }
}

async function exportPdf(opts) {
  const puppeteerModule = await loadPuppeteer();
  const puppeteer = puppeteerModule.default || puppeteerModule;
  const launchOpts = {
    headless: true,
    args: ["--font-render-hinting=medium", "--disable-dev-shm-usage"],
  };

  const envChrome = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envChrome && fs.existsSync(envChrome)) {
    launchOpts.executablePath = envChrome;
  } else if (typeof puppeteer.executablePath === "function") {
    launchOpts.executablePath = await puppeteer.executablePath();
  } else {
    const executablePath = findChromeExecutable();
    if (executablePath) launchOpts.executablePath = executablePath;
  }

  const server = await startStaticServer(opts.port);
  const pageUrl = "http://127.0.0.1:" + opts.port + "/index.html?pdf=1";

  let browser;
  try {
    browser = await puppeteer.launch(launchOpts);
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.emulateMediaType("print");
    await page.goto(pageUrl, { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForFunction(function () {
      return document.fonts && document.fonts.ready;
    });
    await page.evaluate(function (lang, baseUrl) {
      document.documentElement.classList.add("pdf-export");
      document.body.setAttribute("data-lang", lang);
      document.querySelectorAll("a[href]").forEach(function (a) {
        var href = a.getAttribute("href");
        if (!href || href.charAt(0) === "#") return;
        if (/^(mailto:|tel:|https?:)/i.test(href)) return;
        a.setAttribute("href", new URL(href, baseUrl + "/").href);
      });
    }, opts.lang, opts.baseUrl);

    fs.mkdirSync(path.dirname(opts.output), { recursive: true });
    await page.pdf({
      path: opts.output,
      format: "A4",
      printBackground: true,
      tagged: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate:
        '<div style="width:100%;font-family:Inter,system-ui,sans-serif;font-size:9px;color:#5a5a5a;text-align:center;padding-top:2mm;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: "10mm", right: "10mm", bottom: "14mm", left: "10mm" },
    });
  } finally {
    if (browser) await browser.close();
    await new Promise(function (resolve) {
      server.close(resolve);
    });
  }
}

const opts = parseArgs(process.argv.slice(2));

exportPdf(opts)
  .then(function () {
    console.log("Resume PDF saved → " + opts.output);
    console.log("Language: " + opts.lang + " · Links base: " + opts.baseUrl);
  })
  .catch(function (err) {
    console.error(err.message || err);
    process.exit(1);
  });
