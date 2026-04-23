(function () {
  function readStatusNode() {
    return document.getElementById("status");
  }

  function setStatus(message) {
    const status = readStatusNode();
    if (status) {
      status.textContent = message;
      return;
    }
    document.body.textContent = message;
  }

  function decodePayload(encoded) {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const bytes = Uint8Array.from(window.atob(padded), function (char) {
      return char.charCodeAt(0);
    });
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  var body = document.body;
  var encodedPayload = body.dataset.authPayload || "";
  var returnTo = body.dataset.returnTo || "/";
  var fallbackMessage = body.dataset.message || "GitHub sign-in finished.";

  if (!encodedPayload) {
    setStatus(fallbackMessage);
    return;
  }

  var payload;
  try {
    payload = decodePayload(encodedPayload);
  } catch (error) {
    setStatus(fallbackMessage);
    return;
  }

  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(payload, window.location.origin);
    window.close();
    return;
  }

  if (payload && payload.type === "kickstart:github-auth:complete") {
    window.location.replace(returnTo);
    return;
  }

  setStatus(typeof payload.error === "string" ? payload.error : fallbackMessage);
})();
