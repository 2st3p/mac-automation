// Writes text to the clipboard on request from the service worker.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "copy") return;
  const buffer = document.getElementById("buffer");
  buffer.value = msg.text;
  buffer.select();
  document.execCommand("copy");
});
