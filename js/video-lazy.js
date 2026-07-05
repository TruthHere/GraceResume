(function () {
  var CDN_REPO = "TruthHere/GraceResume@main";
  var PLAYBACK_VOLUME = 0.6;

  function resolveVideoUrl(src) {
    if (!src || /^https?:\/\//i.test(src)) return src;
    try {
      return new URL(src, document.baseURI || location.href).href;
    } catch (err) {
      return src;
    }
  }

  function cdnVideoUrl(src) {
    if (!src || /^https?:\/\//i.test(src)) return null;
    if (!location.hostname.endsWith("github.io")) return null;
    var clean = src.replace(/^(\.\.\/)+/, "");
    return "https://cdn.jsdelivr.net/gh/" + CDN_REPO + "/" + clean;
  }

  function sourceCandidates(wrap) {
    var ordered = [];
    var primary = wrap.getAttribute("data-video-src");
    var mobile = wrap.getAttribute("data-video-src-mobile");
    var useMobile = mobile && window.matchMedia("(max-width: 640px)").matches;

    if (useMobile) ordered.push(mobile);
    if (primary) ordered.push(primary);

    var urls = [];
    ordered.forEach(function (src) {
      var cdn = cdnVideoUrl(src);
      var origin = resolveVideoUrl(src);
      if (cdn && urls.indexOf(cdn) === -1) urls.push(cdn);
      if (origin && urls.indexOf(origin) === -1) urls.push(origin);
    });
    return urls;
  }

  function unlockAudio(video) {
    video.muted = false;
    video.defaultMuted = false;
    video.removeAttribute("muted");
    video.volume = PLAYBACK_VOLUME;
  }

  function startPlayback(video) {
    video.muted = true;
    video.defaultMuted = true;
    return video.play().then(function () {
      unlockAudio(video);
    });
  }

  function attach(wrap) {
    var video = wrap.querySelector("video");
    var btn = wrap.querySelector(".video-play-btn");
    if (!video || !btn) return;

    var candidates = sourceCandidates(wrap);
    if (!candidates.length) return;

    var loadPromise = null;
    var prefetched = false;

    video.controls = false;
    video.removeAttribute("controls");

    function showLoading() {
      wrap.classList.add("is-loading");
      wrap.classList.remove("is-error");
    }

    function showReady() {
      wrap.classList.remove("is-loading");
      wrap.classList.add("is-playing");
      btn.hidden = true;
      video.controls = true;
    }

    function showError() {
      wrap.classList.remove("is-loading");
      wrap.classList.add("is-error");
      btn.hidden = false;
      video.controls = false;
    }

    function waitForCanPlay(timeoutMs) {
      return new Promise(function (resolve, reject) {
        if (video.readyState >= 2) {
          resolve();
          return;
        }

        var settled = false;

        function finish(ok) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          cleanup();
          if (ok) resolve();
          else reject(new Error("video load failed"));
        }

        function cleanup() {
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("loadeddata", onLoadedData);
          video.removeEventListener("error", onError);
        }

        function onCanPlay() {
          finish(true);
        }

        function onLoadedData() {
          finish(true);
        }

        function onError() {
          finish(false);
        }

        var timer = setTimeout(function () {
          if (video.readyState >= 2) finish(true);
          else if (video.readyState >= 1) finish(true);
          else finish(false);
        }, timeoutMs || 12000);

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
          waitForCanPlay(12000).then(resolve).catch(tryNext);
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

    function schedulePrefetch() {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(function () {
          prefetch();
        }, { timeout: 800 });
      } else {
        setTimeout(prefetch, 120);
      }
    }

    schedulePrefetch();

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
        { rootMargin: "480px 0px" }
      );
      observer.observe(wrap);
    }

    btn.addEventListener("click", function () {
      showLoading();
      loadVideo()
        .then(function () {
          showReady();
          return startPlayback(video);
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
      video.controls = false;
    });
  }

  document.querySelectorAll(".video-lazy").forEach(attach);
})();
