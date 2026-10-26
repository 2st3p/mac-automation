// Copies the active tab's URL, names tabs whose titles are vague, lets you
// rename a tab, and closes tabs you have not opened for a set time.
importScripts("names.js");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TICK_MINUTES = 15;
const MAX_CLOSED = 50;
const DEFAULT_SETTINGS = { autoClose: true, hours: 24 };
const NO_GROUP = -1;

// ---------- Setup

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() =>
    chrome.contextMenus.create({ id: "rename-tab", title: "Rename tab…", contexts: ["all"] })
  );
  ensureAlarm();
  // Chrome adds content scripts only to pages loaded after install, so add them to open tabs now.
  for (const tab of await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] })) {
    chrome.scripting
      .executeScript({ target: { tabId: tab.id }, files: ["content.js"] })
      .catch(() => {});
  }
});

// Chrome may drop alarms when it restarts, so check each time the worker starts.
ensureAlarm();
chrome.runtime.onStartup.addListener(ensureAlarm);

async function ensureAlarm() {
  if (!(await chrome.alarms.get("auto-close"))) {
    chrome.alarms.create("auto-close", { periodInMinutes: TICK_MINUTES });
  }
  if (!(await chrome.alarms.get("bookmark-plan"))) {
    chrome.alarms.create("bookmark-plan", { periodInMinutes: 1 });
  }
  applyBookmarkPlan();
  // Tabs count as unused only from the time auto-close first ran, so the
  // first run after install does not close every old tab at once.
  const { watchStart } = await chrome.storage.local.get("watchStart");
  if (!watchStart) await chrome.storage.local.set({ watchStart: Date.now() });
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  if (command === "copy-url") copyUrl(tab);
  else if (command === "rename-tab") promptRename(tab);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "rename-tab" && tab) promptRename(tab);
});

// ---------- Copy URL

async function copyUrl(tab) {
  if (!tab.url) return;
  let ok = await copyText(tab.url).catch(() => false);
  if (!ok) ok = await copyInPage(tab.id, tab.url);
  showToast(tab.id, ok ? "Copied URL" : "Could not copy URL");
}

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

// ---------- Tab names

// What each tab's content script last reported, by tab ID. Session storage
// keeps it while the service worker sleeps and clears it when Chrome quits.
let pages;
let pagesReady;
function loadPages() {
  pagesReady ??= chrome.storage.session.get("pages").then((r) => (pages = r.pages || {}));
  return pagesReady;
}
function savePages() {
  chrome.storage.session.set({ pages });
}

async function manualNames() {
  return (await chrome.storage.local.get("names")).names || {};
}

const sameTitle = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// A manual name wins. Otherwise a tab gets an automatic name when its title is
// vague, or when another tab with a different URL has the same title.
function pickName(tabId, names) {
  const page = pages[tabId];
  if (!page) return null;
  if (names[page.key]) return names[page.key];
  if (isVague(page.title, page.url, page.siteName)) return autoName(page);
  const twins = Object.entries(pages)
    .filter(([id, p]) => id !== String(tabId) && p.key !== page.key && sameTitle(p.title, page.title))
    .map(([, p]) => p);
  if (!twins.length) return null;
  // A clear title shared by two tabs is replaced only by a heading that tells them apart.
  const name = autoName(page, true);
  if (!name || twins.some((p) => autoName(p, true) === name)) return null;
  return name;
}

async function applyNames(tabIds) {
  const names = await manualNames();
  for (const id of tabIds) {
    chrome.tabs.sendMessage(Number(id), { type: "apply", name: pickName(id, names) }).catch(() => {});
  }
}

// Tabs whose name can change when a tab with one of these titles appears or goes away.
function tabsTitled(...titles) {
  return Object.keys(pages).filter((id) =>
    titles.some((t) => t != null && sameTitle(pages[id].title, t))
  );
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "page" && sender.tab) onPage(sender.tab.id, msg.page);
  else if (msg?.type === "set-name") setName(msg.url, msg.name);
});

async function onPage(tabId, page) {
  await loadPages();
  const before = pages[tabId]?.title;
  pages[tabId] = { ...page, key: urlKey(page.url) };
  savePages();
  applyNames(new Set([String(tabId), ...tabsTitled(page.title, before)]));
}

async function setName(url, name) {
  const names = await manualNames();
  const key = urlKey(url);
  if (name) names[key] = name;
  else delete names[key];
  await chrome.storage.local.set({ names });
}

// Covers renames from a tab and edits on the options page.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local" || !changes.names) return;
  await loadPages();
  applyNames(Object.keys(pages));
});

// Drops a tab from duplicate-title checks and renames the tabs that shared its title.
async function forgetTab(tabId) {
  await loadPages();
  const gone = pages[tabId];
  if (!gone) return;
  delete pages[tabId];
  savePages();
  applyNames(tabsTitled(gone.title));
}

chrome.tabs.onRemoved.addListener(forgetTab);
chrome.tabs.onReplaced.addListener((_added, removed) => forgetTab(removed));

chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (!change.url) return;
  // Single-page apps change the URL without loading a new page.
  if (/^https?:/.test(change.url)) chrome.tabs.sendMessage(tabId, { type: "refresh" }).catch(() => {});
  // A chrome:// or file page has no content script to report a title.
  else forgetTab(tabId);
});

async function promptRename(tab) {
  const msg = { type: "prompt-rename" };
  try {
    await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    // The page opened before install, or Chrome does not let scripts run on it.
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await chrome.tabs.sendMessage(tab.id, msg);
    } catch {
      showToast(tab.id, "Chrome does not allow renaming this page");
    }
  }
}

// ---------- Bookmark plans

// A bookmark-plan.json in this folder rearranges the bookmarks bar through Chrome's
// bookmarks API, so sync sees a normal change. An unpacked extension reads its files
// from disk, so a new plan is picked up within a minute without a reload. Each plan
// runs once, keyed by its id. The plan holds work URLs, so git ignores it.
//
// { "id": "...", "archive": "Archived 2026-10-23",
//   "remove": [{ "title": "Gmail", "url": "..." }, { "title": "Old folder" }],
//   "folders": [{ "title": "Experiments", "children": [{ "title", "url" } or a folder] }] }
//
// Nothing is deleted. Top-level bar items named in "remove" (a bookmark when url is
// given, a folder when not), and any bar folder that a "folders" entry replaces, move
// into the "archive" folder under Other bookmarks. New folders go on the bar in order.
// Worker startup and the alarm can both call this at once. Both would read "not run
// yet" before either recorded the plan, and apply it twice. One shared run prevents that.
let planRun = null;
function applyBookmarkPlan() {
  planRun ??= runBookmarkPlan().finally(() => (planRun = null));
  return planRun;
}

async function runBookmarkPlan() {
  let plan;
  try {
    const res = await fetch(chrome.runtime.getURL("bookmark-plan.json"), { cache: "no-store" });
    if (!res.ok) return;
    plan = await res.json();
  } catch {
    return; // No plan file.
  }
  const { bookmarkPlans = [] } = await chrome.storage.local.get("bookmarkPlans");
  if (!plan.id || bookmarkPlans.some((p) => p.id === plan.id)) return;
  // Record the plan before acting, so an overlapping alarm cannot run it twice.
  const result = { id: plan.id, at: new Date().toISOString(), archived: 0, created: 0, errors: [] };
  await chrome.storage.local.set({ bookmarkPlans: [result, ...bookmarkPlans].slice(0, 20) });

  const [root] = await chrome.bookmarks.getTree();
  const [bar, other] = root.children;
  const topLevel = () => chrome.bookmarks.getChildren(bar.id);
  let archiveId;
  const archive = async (node) => {
    try {
      if (!archiveId) {
        const name = plan.archive || `Archived ${result.at.slice(0, 10)}`;
        const existing = (await chrome.bookmarks.getChildren(other.id)).find((n) => !n.url && n.title === name);
        archiveId = (existing || (await chrome.bookmarks.create({ parentId: other.id, title: name }))).id;
      }
      await chrome.bookmarks.move(node.id, { parentId: archiveId });
      result.archived++;
    } catch (e) {
      result.errors.push(`archive ${node.title}: ${e.message}`);
    }
  };

  for (const r of plan.remove || []) {
    for (const node of await topLevel()) {
      if (node.title === r.title && (r.url ? node.url === r.url : !node.url)) await archive(node);
    }
  }
  for (const folder of plan.folders || []) {
    for (const node of await topLevel()) {
      if (!node.url && node.title === folder.title) await archive(node);
    }
    await createTree(bar.id, folder, result);
  }
  if (plan.dedupe) {
    await dedupe(bar.id, result);
    await dedupe(other.id, result);
  }

  const { bookmarkPlans: saved = [] } = await chrome.storage.local.get("bookmarkPlans");
  await chrome.storage.local.set({ bookmarkPlans: saved.map((p) => (p.id === plan.id ? result : p)) });
}

// Removes a top-level folder only when it loses nothing: it is an exact copy of an
// earlier folder with the same title, or it is empty and a same-titled folder has content.
async function dedupe(parentId, result) {
  const [parent] = await chrome.bookmarks.getSubTree(parentId);
  const sig = (n) => JSON.stringify([n.title, n.url || null, (n.children || []).map(sig)]);
  const kept = new Map();
  result.deduped ??= 0;
  const folders = (parent.children || []).filter((n) => !n.url);
  for (const node of folders) {
    const same = folders.filter((f) => f !== node && f.title === node.title);
    const isCopy = (kept.get(node.title) || []).some((k) => sig(k) === sig(node));
    const isEmptyTwin = !node.children.length && same.some((f) => f.children.length);
    if (isCopy || isEmptyTwin) {
      try {
        await chrome.bookmarks.removeTree(node.id);
        result.deduped++;
      } catch (e) {
        result.errors.push(`dedupe ${node.title}: ${e.message}`);
      }
    } else {
      kept.set(node.title, [...(kept.get(node.title) || []), node]);
    }
  }
}

async function createTree(parentId, node, result) {
  try {
    const made = await chrome.bookmarks.create({ parentId, title: node.title, url: node.url });
    result.created++;
    for (const child of node.children || []) await createTree(made.id, child, result);
  } catch (e) {
    result.errors.push(`create ${node.title}: ${e.message}`);
  }
}

// ---------- Auto-close

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "auto-close") autoClose();
  else if (alarm.name === "bookmark-plan") applyBookmarkPlan();
});

async function autoClose() {
  const now = Date.now();
  const stored = await chrome.storage.local.get(["settings", "gaps", "lastTick", "watchStart"]);
  const settings = { ...DEFAULT_SETTINGS, ...stored.settings };

  // Time while the Mac sleeps or Chrome is closed does not count as unused.
  // A missed alarm shows that time as a gap between two ticks.
  const gaps = (stored.gaps || []).filter(([, end]) => now - end < 30 * DAY);
  if (stored.lastTick && now - stored.lastTick > 2 * TICK_MINUTES * MINUTE) {
    gaps.push([stored.lastTick + TICK_MINUTES * MINUTE, now]);
  }
  await chrome.storage.local.set({ gaps, lastTick: now });

  // Chrome's lastAccessed is when a tab became active, not when you left it.
  // Each tick notes the tabs in front, so a tab used all day and then left
  // counts as unused from about when you left it.
  const tabs = await chrome.tabs.query({});
  const { seen: oldSeen = {} } = await chrome.storage.session.get("seen");
  const seen = {};
  for (const t of tabs) {
    if (t.active) seen[t.id] = now;
    else if (oldSeen[t.id]) seen[t.id] = oldSeen[t.id];
  }
  await chrome.storage.session.set({ seen });
  if (!settings.autoClose) return;

  const limit = settings.hours * HOUR;
  const stale = tabs.filter(
    (t) =>
      !t.pinned &&
      !t.audible &&
      !t.active &&
      t.groupId === NO_GROUP &&
      t.lastAccessed &&
      unusedTime(Math.max(t.lastAccessed, seen[t.id] || 0, stored.watchStart || now), now, gaps) > limit
  );
  if (!stale.length) return;

  // Close one at a time so a tab you closed a moment ago does not stop the rest.
  const done = [];
  for (const t of stale) {
    try {
      await chrome.tabs.remove(t.id);
      done.push({ url: t.url, title: t.title, closedAt: now });
    } catch {}
  }
  const { closed = [] } = await chrome.storage.local.get("closed");
  await chrome.storage.local.set({ closed: [...done, ...closed].slice(0, MAX_CLOSED) });
}

function unusedTime(lastAccessed, now, gaps) {
  let away = 0;
  for (const [start, end] of gaps) {
    away += Math.max(0, Math.min(end, now) - Math.max(start, lastAccessed));
  }
  return now - lastAccessed - away;
}
