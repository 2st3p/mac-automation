// Reports the page's title and headings to the service worker, shows the name
// it picks, and keeps that name when the page changes its own title.
(() => {
  // A copy injected earlier, or left behind by a reloaded extension, stops here.
  document.dispatchEvent(new CustomEvent("tab-names:stop"));

  let pageTitle = document.title;
  let applied = null;
  let lastReport = "";
  let reportTimer = 0;
  let timers = [];
  // Times the page undid the name. A page that keeps undoing it wins, so the
  // two never trade title changes forever.
  let undos = [];
  let yielded = false;

  const meta = (sel) => document.querySelector(sel)?.content?.trim() || "";

  const visible = (sel) =>
    [...document.querySelectorAll(sel)].filter((el) => el.checkVisibility?.() !== false);
  const text = (el) => el.innerText || el.textContent;

  // Many apps put the page name in an h2 or h3 at the top instead of an h1.
  // Take the largest of those within the first 500 pixels of the page.
  function topHeadings() {
    return visible('h2, h3, [role="heading"][aria-level="2"]')
      .map((el) => ({ el, top: el.getBoundingClientRect().top + scrollY }))
      .filter((x) => x.top < 500)
      .sort((a, b) => parseFloat(getComputedStyle(b.el).fontSize) - parseFloat(getComputedStyle(a.el).fontSize) || a.top - b.top)
      .slice(0, 3)
      .map((x) => text(x.el));
  }

  function headings() {
    return [
      ...visible("h1").slice(0, 3).map(text),
      ...visible('[role="heading"][aria-level="1"]').slice(0, 3).map(text),
    ].filter(Boolean);
  }

  function send(msg) {
    try {
      chrome.runtime.sendMessage(msg).catch(() => {});
    } catch {
      stop(); // The extension was reloaded or removed.
    }
  }

  function report() {
    const page = {
      url: location.href,
      title: pageTitle,
      siteName: meta('meta[property="og:site_name"]') || meta('meta[name="application-name"]'),
      headings: headings(),
      subheadings: topHeadings().filter(Boolean),
      shareTitles: [meta('meta[property="og:title"]'), meta('meta[name="twitter:title"]')].filter(Boolean),
    };
    const sig = JSON.stringify(page);
    if (sig === lastReport) return;
    lastReport = sig;
    send({ type: "page", page });
  }

  // Some pages change their title every second, so wait for a quiet second.
  function scheduleReport(delay = 1000) {
    clearTimeout(reportTimer);
    reportTimer = setTimeout(report, delay);
  }

  // Single-page apps fill in headings after load, so look again a few times.
  function reportSoon() {
    timers.forEach(clearTimeout);
    timers = [300, 1500, 4000, 10000].map((ms) => setTimeout(report, ms));
  }

  function apply(name) {
    applied = yielded ? null : name || null;
    const want = applied || pageTitle;
    if (document.title !== want) document.title = want;
  }

  const observer = new MutationObserver(() => {
    const now = document.title;
    if (now === (applied || pageTitle)) return;
    pageTitle = now;
    if (applied) {
      const t = Date.now();
      undos = undos.filter((u) => t - u < 5000).concat(t);
      if (undos.length > 10) {
        yielded = true;
        applied = null;
      } else {
        document.title = applied;
      }
    }
    scheduleReport();
  });
  observer.observe(document.head || document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
  });

  function onMessage(msg) {
    if (msg?.type === "apply") apply(msg.name);
    else if (msg?.type === "refresh") {
      lastReport = "";
      reportSoon();
    } else if (msg?.type === "prompt-rename") {
      const name = prompt("Tab name. Leave it empty to go back to the automatic name.", document.title);
      if (name === null) return;
      // A name you type yourself gets another try against a page that undid an automatic one.
      yielded = false;
      undos = [];
      send({ type: "set-name", url: location.href, name: name.trim() });
    }
  }
  chrome.runtime.onMessage.addListener(onMessage);

  // Puts the page's own title back so the next copy starts from it.
  function stop() {
    observer.disconnect();
    if (applied) document.title = pageTitle;
    clearTimeout(reportTimer);
    timers.forEach(clearTimeout);
    document.removeEventListener("tab-names:stop", stop);
    try {
      chrome.runtime.onMessage.removeListener(onMessage);
    } catch {}
  }
  document.addEventListener("tab-names:stop", stop);

  reportSoon();
})();
