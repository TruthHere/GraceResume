(function () {
  const layoutEnabled = new URLSearchParams(window.location.search).get("layout") === "1";
  if (!layoutEnabled) return;

  const isLocalDev =
    location.hostname === "localhost" || location.hostname === "127.0.0.1";

  const PROPS = [
    { key: "marginTop", label: "上外边距", prop: "margin-top", min: 0, max: 120, step: 4 },
    { key: "marginBottom", label: "下外边距", prop: "margin-bottom", min: 0, max: 120, step: 4 },
    { key: "paddingTop", label: "上内边距", prop: "padding-top", min: 0, max: 80, step: 4 },
    { key: "paddingBottom", label: "下内边距", prop: "padding-bottom", min: 0, max: 80, step: 4 },
    { key: "gap", label: "子元素间距", prop: "gap", min: 0, max: 64, step: 4 },
    { key: "height", label: "高度（0=自动）", prop: "height", min: 0, max: 1200, step: 8, autoAtZero: true },
    { key: "minHeight", label: "最小高度", prop: "min-height", min: 0, max: 600, step: 8, autoAtZero: true },
  ];

  const TARGET_SELECTOR = [
    "aside",
    "main",
    "section",
    "footer",
    "header.product-header",
    ".product-page",
    ".product-showcase-grid",
    ".product-showcase-stacked",
    ".product-story",
    ".product-story-block",
    ".product-demo",
    ".product-demo-frame",
    ".product-demo-screen",
    "p.product-demo-caption",
    ".back-link",
    ".research-topbar",
    "article.job",
    ".photo-wrap",
    ".tags",
    ".contact",
    ".entry-heading",
  ].join(", ");

  let overrides = {};
  let selectedEl = null;
  let selectedSelector = null;
  let highlightEl = null;
  let hoverEl = null;

  function getRoot() {
    return (
      document.querySelector(".layout") ||
      document.querySelector(".product-page") ||
      document.querySelector(".research-page")
    );
  }

  function buildSelector(el) {
    const root = getRoot();
    if (!root || !root.contains(el)) return null;

    const rootClass = root.classList.contains("layout")
      ? "layout"
      : root.classList.contains("product-page")
        ? "product-page"
        : "research-page";

    const parts = [];
    let cur = el;

    while (cur && cur !== root) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        parts.unshift("#" + cur.id);
        break;
      }
      const classes = [...cur.classList].filter(function (c) {
        return c && !c.startsWith("layout-");
      });
      if (classes.length) part += "." + classes.join(".");
      const parent = cur.parentElement;
      if (parent && !cur.id) {
        const same = [...parent.children].filter(function (child) {
          if (child.tagName !== cur.tagName) return false;
          if (!classes.length) return true;
          return classes.every(function (c) {
            return child.classList.contains(c);
          });
        });
        if (same.length > 1) {
          part += ":nth-of-type(" + (same.indexOf(cur) + 1) + ")";
        }
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }

    return (
      'html[data-layout-page="' +
      normalizePagePath() +
      '"] .' +
      rootClass +
      " " +
      parts.join(" > ")
    );
  }

  function labelFor(el) {
    const h = el.querySelector("h1, h2, h3");
    if (h && h.textContent.trim()) return h.textContent.trim().slice(0, 24);
    if (el.classList.length) return el.className.split(/\s+/)[0];
    return el.tagName.toLowerCase();
  }

  function pxToNum(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }

  function readComputed(el) {
    const cs = getComputedStyle(el);
    const heightPx = pxToNum(cs.height);
    const minHeightPx = pxToNum(cs.minHeight);
    return {
      marginTop: pxToNum(cs.marginTop),
      marginBottom: pxToNum(cs.marginBottom),
      paddingTop: pxToNum(cs.paddingTop),
      paddingBottom: pxToNum(cs.paddingBottom),
      gap: pxToNum(cs.gap) || pxToNum(cs.rowGap) || 0,
      height: cs.height === "auto" ? 0 : heightPx,
      minHeight: cs.minHeight === "auto" || minHeightPx === 0 ? 0 : minHeightPx,
    };
  }

  function applyStyleValue(el, propDef, value) {
    if (propDef.autoAtZero && value === 0) {
      el.style.removeProperty(propDef.prop);
      return;
    }
    el.style.setProperty(propDef.prop, value + "px");
  }

  function getOverride(selector) {
    return overrides[selector] || {};
  }

  function applyOverridesToDom() {
    Object.keys(overrides).forEach(function (selector) {
      const rules = overrides[selector];
      try {
        const el = document.querySelector(selector);
        if (!el) return;
        PROPS.forEach(function (p) {
          if (rules[p.key] == null) return;
          if (p.autoAtZero && rules[p.key] === 0) {
            el.style.removeProperty(p.prop);
            return;
          }
          el.style.setProperty(p.prop, rules[p.key] + "px");
        });
      } catch (_) {
        /* ignore invalid selector */
      }
    });
  }

  async function loadOverrides() {
    try {
      const res = await fetch("/data/layout-overrides.json");
      if (!res.ok) return;
      const data = await res.json();
      overrides = data[normalizePagePath()] || {};
      applyOverridesToDom();
    } catch (_) {
      /* ignore */
    }
  }

  function injectUI() {
    highlightEl = document.createElement("div");
    highlightEl.className = "layout-highlight";
    highlightEl.hidden = true;

    const panel = document.createElement("aside");
    panel.className = "layout-panel";
    panel.innerHTML =
      '<h3>布局调整</h3>' +
      '<p class="layout-panel-empty">点击页面上的模块（区块、侧边栏、章节等）开始调节间距。</p>' +
      '<div class="layout-controls" hidden></div>' +
      '<div class="layout-panel-actions">' +
      '<button type="button" class="layout-reset">重置</button>' +
      '<button type="button" class="layout-save primary">保存</button>' +
      "</div>";

    const toast = document.createElement("div");
    toast.className = "layout-toast";
    toast.hidden = true;

    document.body.appendChild(highlightEl);
    document.body.appendChild(panel);
    document.body.appendChild(toast);
    document.body.classList.add("layout-enabled");

    return { panel, toast };
  }

  function showToast(ui, msg, type) {
    ui.toast.textContent = msg;
    ui.toast.className = "layout-toast layout-toast--" + (type || "success");
    ui.toast.hidden = false;
    clearTimeout(ui.toast._t);
    ui.toast._t = setTimeout(function () {
      ui.toast.hidden = true;
    }, 3200);
  }

  function positionHighlight(el, mode) {
    if (!el || !highlightEl) return;
    const r = el.getBoundingClientRect();
    highlightEl.hidden = false;
    highlightEl.style.top = r.top + "px";
    highlightEl.style.left = r.left + "px";
    highlightEl.style.width = r.width + "px";
    highlightEl.style.height = r.height + "px";
    highlightEl.classList.toggle("is-hover", mode === "hover");
    highlightEl.classList.toggle("is-selected", mode === "selected");
  }

  function renderControls(ui, el, selector) {
    const empty = ui.panel.querySelector(".layout-panel-empty");
    const controls = ui.panel.querySelector(".layout-controls");
    const merged = Object.assign({}, readComputed(el), getOverride(selector));

    empty.hidden = true;
    controls.hidden = false;
    controls.innerHTML =
      '<p class="layout-panel-target">' +
      labelFor(el) +
      "<br><code>" +
      selector.split(" ").slice(-2).join(" ") +
      "</code></p>";

    if (el.classList.contains("product-story-block")) {
      const hint = document.createElement("p");
      hint.className = "layout-panel-hint";
      hint.textContent =
        "Why / What / How 之间的间距由外层 product-story 的「子元素间距」控制，请点选整块 story 区域调节 gap。";
      controls.appendChild(hint);
    } else if (el.matches(".product-demo, .product-demo-frame, .product-demo-screen")) {
      const hint = document.createElement("p");
      hint.className = "layout-panel-hint";
      hint.textContent =
        "演示区下方空白：点选 product-demo，将「高度」滑到 0（自动）；或调 product-demo-screen 的「最小高度」。";
      controls.appendChild(hint);
    } else if (el.matches("section")) {
      const hint = document.createElement("p");
      hint.className = "layout-panel-hint";
      hint.textContent = "章节之间的空白主要用「下外边距」调节。";
      controls.appendChild(hint);
    }

    PROPS.forEach(function (p) {
      const val = merged[p.key] != null ? merged[p.key] : 0;
      const displayVal = p.autoAtZero && val === 0 ? "自动" : val + "px";
      const row = document.createElement("label");
      row.innerHTML =
        p.label +
        ' <span class="layout-value">' +
        displayVal +
        "</span>" +
        '<input type="range" min="' +
        p.min +
        '" max="' +
        p.max +
        '" step="' +
        p.step +
        '" value="' +
        val +
        '" data-key="' +
        p.key +
        '" data-prop="' +
        p.prop +
        '">';
      controls.appendChild(row);
    });

    controls.querySelectorAll("input[type=range]").forEach(function (input) {
      input.addEventListener("input", function () {
        const key = input.dataset.key;
        const propDef = PROPS.find(function (p) {
          return p.key === key;
        });
        const num = Number(input.value);
        const displayVal =
          propDef && propDef.autoAtZero && num === 0 ? "自动" : input.value + "px";
        input.parentElement.querySelector(".layout-value").textContent = displayVal;
        applyStyleValue(el, propDef || { prop: input.dataset.prop }, num);
        if (!overrides[selector]) overrides[selector] = {};
        if (propDef && propDef.autoAtZero && num === 0) {
          overrides[selector][key] = 0;
        } else {
          overrides[selector][key] = num;
        }
      });
    });
  }

  function selectTarget(ui, el) {
    const selector = buildSelector(el);
    if (!selector) return;
    selectedEl = el;
    selectedSelector = selector;
    positionHighlight(el, "selected");
    renderControls(ui, el, selector);
  }

  function isLayoutTarget(el) {
    if (!el || el.closest(".layout-panel, .lang-switcher, .edit-toggle, .edit-hotzone")) {
      return false;
    }
    const root = getRoot();
    if (!root || !root.contains(el)) return false;
    try {
      return el.matches(TARGET_SELECTOR) || !!el.closest(TARGET_SELECTOR);
    } catch (_) {
      return false;
    }
  }

  function resolveTarget(el) {
    if (el.matches(TARGET_SELECTOR)) return el;
    return el.closest(TARGET_SELECTOR);
  }

  async function saveOverrides(ui) {
    if (!isLocalDev) {
      showToast(ui, "公开站点无法保存，请用 npm run dev 本地编辑", "error");
      return;
    }
    try {
      const res = await fetch("/api/save-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagePath: normalizePagePath(),
          overrides: overrides,
        }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.ok) {
        throw new Error(
          data.error ||
            (res.status === 404
              ? "布局保存接口不存在。请重启 npm run dev 后再试。"
              : "保存失败。请确认使用 npm run dev 启动。")
        );
      }
      showToast(ui, "间距已保存，部署后也会生效", "success");
    } catch (err) {
      showToast(ui, err.message || "保存失败", "error");
    }
  }

  const ui = injectUI();
  const root = getRoot();
  if (!root) return;

  loadOverrides().then(function () {
    if (selectedEl) renderControls(ui, selectedEl, selectedSelector);
  });

  root.addEventListener(
    "mouseover",
    function (e) {
      const t = resolveTarget(e.target);
      if (!t || t === selectedEl) return;
      hoverEl = t;
      t.classList.add("layout-target-hover");
      positionHighlight(t, "hover");
    },
    true
  );

  root.addEventListener(
    "mouseout",
    function (e) {
      const t = resolveTarget(e.target);
      if (t) t.classList.remove("layout-target-hover");
      if (!selectedEl && highlightEl) highlightEl.hidden = true;
      if (selectedEl) positionHighlight(selectedEl, "selected");
    },
    true
  );

  root.addEventListener(
    "click",
    function (e) {
      const t = resolveTarget(e.target);
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      selectTarget(ui, t);
    },
    true
  );

  ui.panel.querySelector(".layout-reset").addEventListener("click", function () {
    if (!selectedSelector) return;
    delete overrides[selectedSelector];
    PROPS.forEach(function (p) {
      selectedEl.style.removeProperty(p.prop);
    });
    renderControls(ui, selectedEl, selectedSelector);
  });

  ui.panel.querySelector(".layout-save").addEventListener("click", function () {
    saveOverrides(ui);
  });

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveOverrides(ui);
    }
  });

  window.addEventListener("scroll", function () {
    if (selectedEl) positionHighlight(selectedEl, "selected");
    else if (hoverEl) positionHighlight(hoverEl, "hover");
  }, true);

  window.addEventListener("resize", function () {
    if (selectedEl) positionHighlight(selectedEl, "selected");
  });
})();
