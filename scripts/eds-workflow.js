(function () {
  const STORAGE_KEY = "eds-approval-state";

  // Read/write workflow state (pure localStorage)
  function getState() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  }

  function setStatus(path, status, comments = "") {
    const s = getState();
    s[path] = { status, comments, updated: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  function getStatus(path) {
    const s = getState();
    return s[path] || { status: "draft" };
  }

  function getPagePath() {
    return window.location.pathname;
  }

  function openEditorNotice() {
    alert("EDIT MODE:\n\nOpen your Google Doc / Word file manually.\n(This is a pure JS workflow; no backend available.)");
  }

  function openPreview() {
    const previewUrl = window.location.href
      .replace(".live", ".page")
      .replace(".html", ".html");
    window.open(previewUrl, "_blank");
  }

  function publishToLive() {
    const liveUrl = window.location.href
      .replace(".page", ".live")
      .replace(".html", ".html");
    window.open(liveUrl, "_blank");
  }

  // Main Sidekick event registration
  function registerSidekick() {
    const sk = document.querySelector("aem-sidekick");

    const attach = (root) => {
      // Edit
      root.addEventListener("custom:eds-edit", () => {
        openEditorNotice();
      });

      // Preview
      root.addEventListener("custom:eds-preview", () => {
        openPreview();
      });

      // Publish live (approval required)
      root.addEventListener("custom:eds-publish-live", () => {
        const path = getPagePath();
        const st = getStatus(path);

        if (st.status !== "approved") {
          alert("Cannot publish.\nPreview must be APPROVED first.");
          return;
        }

        publishToLive();
      });

      // Palette requests SK state
      window.addEventListener("message", (e) => {
        if (e.data?.type === "getState") {
          window.parent.postMessage(
            {
              sidekick: {
                location: getPagePath(),
                status: getStatus(getPagePath())
              }
            },
            "*"
          );
        }
      });
    };

    if (sk) attach(sk);
    else {
      document.addEventListener(
        "sidekick-ready",
        () => {
          const sk2 = document.querySelector("aem-sidekick");
          if (sk2) attach(sk2);
        },
        { once: true }
      );
    }
  }

  // Initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", registerSidekick);
  } else {
    registerSidekick();
  }

  // expose for palette (optional)
  window.__EDS_WORKFLOW__ = { setStatus, getStatus };
})();
