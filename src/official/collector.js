(function () {
  const ENDPOINT = "/api/events";

  function getToken() {
    try {
      return new URL(window.location.href).searchParams.get("token") || "";
    } catch {
      return "";
    }
  }

  function send(payload) {
    const body = JSON.stringify(payload);
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, blob)) return;
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  function capturePageView() {
    send({
      event_type: "official_page_view",
      page_url: window.location.href,
      referrer: document.referrer || "",
      campaign_token: getToken(),
      user_agent: navigator.userAgent || "",
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      timestamp: new Date().toISOString(),
    });
  }

  window.addEventListener("DOMContentLoaded", capturePageView);
})();
