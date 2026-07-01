(function (global) {
  function getSiteBasePath() {
    const el = document.querySelector('script[src*="page-path.js"]');
    if (!el) return "";
    const url = new URL(el.src, global.location.href);
    const match = url.pathname.match(/^(.*)\/js\/page-path\.js$/);
    return match ? match[1] : "";
  }

  function normalizePagePath(pathname) {
    let p = pathname || global.location.pathname;
    const base = getSiteBasePath();
    if (base && p.startsWith(base)) {
      p = p.slice(base.length) || "/";
    }
    if (!p || p === "/") return "/index.html";
    if (!p.startsWith("/")) p = "/" + p;
    return p;
  }

  global.getSiteBasePath = getSiteBasePath;
  global.normalizePagePath = normalizePagePath;
  document.documentElement.dataset.layoutPage = normalizePagePath();
})(window);
