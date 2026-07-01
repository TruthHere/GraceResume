(function () {
  document.querySelectorAll(".video-lazy").forEach(function (wrap) {
    var video = wrap.querySelector("video");
    var btn = wrap.querySelector(".video-play-btn");
    if (!video || !btn) return;

    var src = wrap.getAttribute("data-video-src");
    if (!src) return;

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
    }

    btn.addEventListener("click", function () {
      if (!video.getAttribute("src")) {
        video.setAttribute("src", src);
        showLoading();
        video.addEventListener(
          "loadeddata",
          function () {
            showReady();
            video.play().catch(function () {
              btn.hidden = false;
              wrap.classList.remove("is-playing");
            });
          },
          { once: true }
        );
        video.addEventListener(
          "error",
          function () {
            showError();
            btn.hidden = false;
          },
          { once: true }
        );
        video.load();
        return;
      }

      video.play().catch(function () {});
    });

    video.addEventListener("pause", function () {
      if (video.currentTime > 0 && !video.ended) return;
      if (!video.getAttribute("src")) return;
      btn.hidden = false;
      wrap.classList.remove("is-playing");
    });
  });
})();
