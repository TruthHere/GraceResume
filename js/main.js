(function () {
  const STORAGE_KEY = "gracecareer-lang";
  const DEFAULT_LANG = "zh";
  const LABELS = { zh: "中文", en: "EN" };

  const switcher = document.querySelector(".lang-switcher");
  if (!switcher) return;

  const trigger = switcher.querySelector(".lang-switcher-trigger");
  const currentEl = switcher.querySelector(".lang-switcher-current");
  const menu = switcher.querySelector(".lang-switcher-menu");
  const options = menu.querySelectorAll("button[data-lang]");
  const i18nElements = document.querySelectorAll("[data-zh][data-en]");

  function openMenu() {
    switcher.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
  }

  function closeMenu() {
    switcher.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  }

  function setLang(lang, keepMenuClosed) {
    if (lang !== "zh" && lang !== "en") lang = DEFAULT_LANG;

    document.body.setAttribute("data-lang", lang);
    document.documentElement.setAttribute("lang", lang === "zh" ? "zh-CN" : "en");

    i18nElements.forEach((el) => {
      const text = el.dataset[lang];
      if (text !== undefined) {
        el.textContent = text;
      }
    });

    currentEl.textContent = LABELS[lang];
    options.forEach((btn) => {
      btn.setAttribute("aria-selected", btn.dataset.lang === lang ? "true" : "false");
    });

    if (!keepMenuClosed) {
      closeMenu();
    }

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {
      /* ignore */
    }
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  options.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setLang(btn.dataset.lang);
    });
  });

  document.addEventListener("click", () => closeMenu());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  let saved = DEFAULT_LANG;
  try {
    saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
  } catch (_) {
    /* ignore */
  }

  setLang(saved, true);
})();
