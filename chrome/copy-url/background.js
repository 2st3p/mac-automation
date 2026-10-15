// Copies the active tab's URL when the copy-url command fires.

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "copy-url") return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  await copyText(tab.url);
  showToast(tab.id);
});

// A service worker has no DOM, so the copy runs in an offscreen document.
async function copyText(text) {
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["CLIPBOARD"],
      justification: "Write the tab URL to the clipboard",
    });
  }
  await chrome.runtime.sendMessage({ type: "copy", text });
}

// Chrome blocks scripts on chrome:// pages and the Web Store, so the toast is best effort.
async function showToast(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const el = document.createElement("div");
        el.textContent = "Copied URL";
        el.style.cssText =
          "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;" +
          "padding:8px 14px;border-radius:8px;background:#222;color:#fff;" +
          "font:13px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3);" +
          "transition:opacity .3s;";
        document.documentElement.appendChild(el);
        setTimeout(() => (el.style.opacity = "0"), 1200);
        setTimeout(() => el.remove(), 1600);
      },
    });
  } catch {}
}
