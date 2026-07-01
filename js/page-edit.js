(function () {
  const editEnabled = new URLSearchParams(window.location.search).get("edit") === "1";
  if (!editEnabled) return;

  const isLocalDev =
    location.hostname === "localhost" || location.hostname === "127.0.0.1";

  function getEditRoot() {
    return (
      document.querySelector(".layout") ||
      document.querySelector(".product-page") ||
      document.querySelector(".research-page")
    );
  }

  function getRootSelector() {
    if (document.querySelector(".layout")) return ".layout";
    if (document.querySelector(".product-page")) return ".product-page";
    if (document.querySelector(".research-page")) return ".research-page";
    return null;
  }

  function getEditableSelector() {
    return [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "p",
      "li",
      "figcaption",
      "td",
      "th",
      ".subtitle span",
      ".product-tag",
      ".product-story-label",
      ".product-story-lead",
      ".product-story-highlight",
      ".target-cities",
      ".name-alt",
      ".research-lead",
      ".research-thesis",
      ".back-link",
      ".research-back",
      "footer span",
      ".contact strong",
      ".contact span",
      ".product-meta span",
      "span[data-zh]",
      "span[data-en]",
    ].join(", ");
  }

  function injectEditUI() {
    const hotzone = document.createElement("div");
    hotzone.className = "edit-hotzone";
    hotzone.setAttribute("aria-hidden", "true");

    const toggle = document.createElement("button");
    toggle.className = "edit-toggle";
    toggle.id = "editToggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "切换编辑模式，快捷键 E");
    toggle.setAttribute("aria-pressed", "false");
    toggle.title = "编辑模式 (E)";
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>' +
      '<span class="edit-label">编辑</span>';

    const toast = document.createElement("div");
    toast.className = "edit-toast";
    toast.hidden = true;

    document.body.prepend(hotzone, toggle);
    document.body.appendChild(toast);
    return { toggle, hotzone, toast };
  }

  function showToast(ui, message, type) {
    ui.toast.textContent = message;
    ui.toast.className = "edit-toast edit-toast--" + (type || "info");
    ui.toast.hidden = false;
    clearTimeout(ui.toast._timer);
    ui.toast._timer = setTimeout(function () {
      ui.toast.hidden = true;
    }, 3200);
  }

  function syncI18nDatasets(root) {
    const lang = document.body.getAttribute("data-lang") || "zh";
    root.querySelectorAll("[data-zh][data-en]").forEach(function (el) {
      el.dataset[lang] = el.textContent.trim();
    });
  }

  function collectEditableNodes(root) {
    const selector = getEditableSelector();
    const nodes = [];
    root.querySelectorAll(selector).forEach(function (el) {
      if (el.closest(".lang-switcher")) return;
      if (el.closest(".tags") || el.closest(".certs")) return;
      nodes.push(el);
    });
    return nodes;
  }

  function serializeRootHtml(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll("[contenteditable]").forEach(function (el) {
      el.removeAttribute("contenteditable");
    });
    return clone.innerHTML;
  }

  document.body.classList.add("edit-enabled");
  const root = getEditRoot();
  const rootSelector = getRootSelector();
  if (!root || !rootSelector) return;

  const ui = injectEditUI();
  const label = ui.toggle.querySelector(".edit-label");
  let active = false;
  let saving = false;

  async function saveEdits() {
    if (saving) return false;
    syncI18nDatasets(root);

    if (!isLocalDev) {
      showToast(
        ui,
        "公开站点无法在线保存。请在本地运行 npm run dev 编辑后再部署。",
        "error"
      );
      return false;
    }

    saving = true;
    label.textContent = "保存中…";

    try {
      const res = await fetch("/api/save-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagePath: normalizePagePath(),
          rootSelector: rootSelector,
          html: serializeRootHtml(root),
        }),
      });

      const data = await res.json().catch(function () {
        return {};
      });

      if (!res.ok || !data.ok) {
        throw new Error(
          data.error ||
            (res.status === 404
              ? "保存接口不存在。请在项目目录运行 npm run dev 并重启服务器。"
              : "保存失败。请确认使用 npm run dev 启动（不是 python -m http.server）。")
        );
      }

      showToast(ui, "已保存到网站文件，公开访问也会看到最新文案", "success");
      return true;
    } catch (err) {
      showToast(ui, err.message || "保存失败", "error");
      return false;
    } finally {
      saving = false;
      if (active) {
        label.textContent = "完成";
      } else {
        label.textContent = "编辑";
      }
    }
  }

  async function setEdit(on) {
    if (!on && active) {
      await saveEdits();
    }

    active = on;
    document.body.classList.toggle("edit-mode", on);
    ui.toggle.classList.toggle("active", on);
    ui.toggle.setAttribute("aria-pressed", on ? "true" : "false");
    if (!saving) {
      label.textContent = on ? "完成" : "编辑";
    }

    collectEditableNodes(root).forEach(function (el) {
      el.contentEditable = on ? "true" : "false";
    });
  }

  ui.toggle.addEventListener("click", function () {
    setEdit(!active);
  });
  ui.hotzone.addEventListener("click", function () {
    setEdit(!active);
  });

  document.addEventListener("keydown", function (e) {
    if ((e.key === "e" || e.key === "E") && !e.target.isContentEditable) {
      setEdit(!active);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (active) saveEdits();
    }
  });

  setEdit(true);
})();
