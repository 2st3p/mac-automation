// Copies the active tab's URL when the copy-url command fires.

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "copy-url") return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  let ok = await copyText(tab.url).catch(() => false);
  if (!ok) ok = await copyInPage(tab.id, tab.url);
  showToast(tab.id, ok ? "Copied URL" : "Could not copy URL");
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
  const reply = await chrome.runtime.sendMessage({ type: "copy", text });
  return reply?.ok === true;
}

// Fallback: write from the page itself. Fails on chrome:// pages and the Web Store.
async function copyInPage(tabId, text) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (t) => navigator.clipboard.writeText(t).then(() => true, () => false),
      args: [text],
    });
    return result?.result === true;
  } catch {
    return false;
  }
}

// Chrome blocks scripts on chrome:// pages and the Web Store, so the toast is best effort.
async function showToast(tabId, message) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (text) => {
        const el = document.createElement("div");
        el.textContent = text;
        el.style.cssText =
          "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;" +
          "padding:8px 14px;border-radius:8px;background:#222;color:#fff;" +
          "font:13px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3);" +
          "transition:opacity .3s;";
        document.documentElement.appendChild(el);
        setTimeout(() => (el.style.opacity = "0"), 1200);
        setTimeout(() => el.remove(), 1600);
      },
      args: [message],
    });
  } catch {}
}
