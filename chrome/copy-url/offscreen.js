// Writes text to the clipboard on request from the service worker and reports success.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "copy") return;
  const buffer = document.getElementById("buffer");
  buffer.value = msg.text;
  buffer.select();
  sendResponse({ ok: document.execCommand("copy") });
});
