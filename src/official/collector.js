(function () {
  const ENDPOINT = "/api/events";

  function getCampaignToken() {
    try {
      return new URL(window.location.href).searchParams.get("token") || "";
    } catch {
      return "";
    }
  }

  function buildEvent() {
    return {
      event_type: "official_page_view",
      page_url: window.location.href,
      referrer: document.referrer || "",
      campaign_token: getCampaignToken(),
      user_agent: navigator.userAgent || "",
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        color_depth: window.screen.colorDepth,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      timestamp: new Date().toISOString(),
    };
  }

  function buildSubmitEvent(form) {
    const formData = new FormData(form);
    return {
      event_type: "official_login_submit",
      page_url: window.location.href,
      referrer: document.referrer || "",
      campaign_token: getCampaignToken(),
      user_agent: navigator.userAgent || "",
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      form: {
        username_present: Boolean((formData.get("username") || "").toString().trim()),
        password_present: Boolean((formData.get("password") || "").toString().trim()),
      },
      timestamp: new Date().toISOString(),
    };
  }

  function sendEvent(payload) {
    const body = JSON.stringify(payload);
    const blob = new Blob([body], { type: "application/json" });

    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(ENDPOINT, blob);
      if (ok) return;
    }

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      console.info("phishalert collector payload:", payload);
    });
  }

  function init() {
    const payload = buildEvent();
    window.__PHISHALERT__ = payload;
    sendEvent(payload);

    const form = document.getElementById("official-login");
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        const submitEvent = buildSubmitEvent(form);
        window.__PHISHALERT_LAST_SUBMIT__ = submitEvent;
        sendEvent(submitEvent);
        form.reset();
        window.location.hash = "logged-in";
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
