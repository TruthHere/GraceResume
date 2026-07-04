(function () {
  var CDN_REPO = "TruthHere/GraceResume@main";

  function resolveVideoUrl(src) {
    if (!src || /^https?:\/\//i.test(src)) return src;
    if (location.hostname.endsWith("github.io")) {
      var clean = src.replace(/^(\.\.\/)+/, "");
      return "https://cdn.jsdelivr.net/gh/" + CDN_REPO + "/" + clean;
    }
    return src;
  }

  function sourceCandidates(wrap) {
    var ordered = [];
    var primary = wrap.getAttribute("data-video-src");
    var mobile = wrap.getAttribute("data-video-src-mobile");
    var useMobile = mobile && window.matchMedia("(max-width: 820px)").matches;

    if (useMobile) ordered.push(mobile);
    if (primary) ordered.push(primary);

    var urls = [];
    ordered.forEach(function (src) {
      var cdn = resolveVideoUrl(src);
      if (cdn && urls.indexOf(cdn) === -1) urls.push(cdn);
      if (src && urls.indexOf(src) === -1) urls.push(src);
    });
    return urls;
  }

  function attach(wrap) {
    var video = wrap.querySelector("video");
    var btn = wrap.querySelector(".video-play-btn");
    if (!video || !btn) return;

    var candidates = sourceCandidates(wrap);
    if (!candidates.length) return;

    var loadPromise = null;
    var prefetched = false;

    function showLoading() {
      wrap.classList.add("is-loading");
      wrap.classList.remove("is-error");
    }

    function showReady() {
      wrap.classList.remove("is-loading");
      wrap.classList.add("is-playing");
      btn.hidden = true;
    }

    function showError() {
      wrap.classList.remove("is-loading");
      wrap.classList.add("is-error");
      btn.hidden = false;
    }

    function waitForCanPlay() {
      return new Promise(function (resolve, reject) {
        if (video.readyState >= 2) {
          resolve();
          return;
        }

        function cleanup() {
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("loadeddata", onLoadedData);
          video.removeEventListener("error", onError);
        }

        function onCanPlay() {
          cleanup();
          resolve();
        }

        function onLoadedData() {
          cleanup();
          resolve();
        }

        function onError() {
          cleanup();
          reject(new Error("video load failed"));
        }

        video.addEventListener("canplay", onCanPlay, { once: true });
        video.addEventListener("loadeddata", onLoadedData, { once: true });
        video.addEventListener("error", onError, { once: true });
      });
    }

    function setSource(src) {
      if (video.getAttribute("src") === src) return;
      video.setAttribute("src", src);
      video.preload = "auto";
      video.load();
    }

    function loadVideo() {
      if (loadPromise) return loadPromise;

      var index = 0;

      loadPromise = new Promise(function (resolve, reject) {
        function tryNext() {
          if (index >= candidates.length) {
            reject(new Error("all sources failed"));
            return;
          }

          var src = candidates[index++];
          setSource(src);
          waitForCanPlay().then(resolve).catch(tryNext);
        }

        tryNext();
      }).catch(function (err) {
        loadPromise = null;
        throw err;
      });

      return loadPromise;
    }

    function prefetch() {
      if (prefetched || video.getAttribute("src")) return;
      if (navigator.connection && navigator.connection.saveData) return;
      prefetched = true;
      loadVideo().catch(function () {
        prefetched = false;
      });
    }

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              observer.disconnect();
              prefetch();
            }
          });
        },
        { rootMargin: "320px 0px" }
      );
      observer.observe(wrap);
    } else {
      prefetch();
    }

    btn.addEventListener("click", function () {
      showLoading();
      loadVideo()
        .then(function () {
          showReady();
          return video.play();
        })
        .catch(function () {
          showError();
        });
    });

    video.addEventListener("pause", function () {
      if (video.currentTime > 0 && !video.ended) return;
      if (!video.getAttribute("src")) return;
      btn.hidden = false;
      wrap.classList.remove("is-playing");
    });
  }

  document.querySelectorAll(".video-lazy").forEach(attach);
})();
