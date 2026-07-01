(function () {
  var el = document.currentScript || document.querySelector('script[src*="load-dev-tools.js"]');
  if (!el) return;

  var match = el.src.match(/^(.*)\/js\/load-dev-tools\.js/);
  var base = match ? match[1] + "/" : "";

  var isLocal =
    location.hostname === "localhost" || location.hostname === "127.0.0.1";
  var qs = location.search;
  var wantsDev =
    isLocal || qs.indexOf("edit=1") !== -1 || qs.indexOf("layout=1") !== -1;
  if (!wantsDev) return;

  ["page-edit.css?v=3", "page-layout.css?v=1"].forEach(function (file) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = base + "css/" + file;
    document.head.appendChild(link);
  });

  function loadScripts() {
    ["page-edit.js?v=3", "page-layout.js?v=1"].forEach(function (file) {
      var script = document.createElement("script");
      script.src = base + "js/" + file;
      document.body.appendChild(script);
    });
  }

  if (document.body) loadScripts();
  else document.addEventListener("DOMContentLoaded", loadScripts);
})();
