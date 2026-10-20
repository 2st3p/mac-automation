// Settings for auto-close, the list of tabs it closed, and the names you set.
const DEFAULT_SETTINGS = { autoClose: true, hours: 24 };
const $ = (id) => document.getElementById(id);

async function render() {
  const { settings, closed = [], names = {} } = await chrome.storage.local.get(["settings", "closed", "names"]);
  const s = { ...DEFAULT_SETTINGS, ...settings };
  $("autoClose").checked = s.autoClose;
  $("hours").value = s.hours;

  $("closed").replaceChildren(
    closed.length
      ? table(closed.map((c) => [link(c.title || c.url, c.url), text(new Date(c.closedAt).toLocaleString(), "when")]))
      : text("No tabs closed yet.", "empty")
  );

  const entries = Object.entries(names).sort(([, a], [, b]) => a.localeCompare(b));
  $("names").replaceChildren(
    entries.length
      ? table(entries.map(([key, name]) => [text(name), text(key, "url"), removeButton(key)]))
      : text("No names set.", "empty")
  );
}

function table(rows) {
  const t = document.createElement("table");
  for (const cells of rows) t.insertRow().append(...cells.map((c) => (c.tagName === "TD" ? c : wrap(c))));
  return t;
}
function wrap(node) {
  const td = document.createElement("td");
  td.append(node);
  return td;
}
function text(value, cls) {
  const td = document.createElement("td");
  td.textContent = value;
  if (cls) td.className = cls;
  return td;
}
function link(label, url) {
  const a = document.createElement("a");
  a.href = url;
  a.textContent = label;
  a.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url });
  });
  return a;
}
function removeButton(key) {
  const b = document.createElement("button");
  b.textContent = "Remove";
  b.addEventListener("click", async () => {
    const { names = {} } = await chrome.storage.local.get("names");
    delete names[key];
    await chrome.storage.local.set({ names });
  });
  return b;
}

async function saveSettings() {
  const hours = Math.max(1, Math.round(Number($("hours").value) || DEFAULT_SETTINGS.hours));
  await chrome.storage.local.set({ settings: { autoClose: $("autoClose").checked, hours } });
}

$("autoClose").addEventListener("change", saveSettings);
$("hours").addEventListener("change", saveSettings);
$("clearClosed").addEventListener("click", () => chrome.storage.local.set({ closed: [] }));
// The auto-close timer writes every 15 minutes. Only redraw for what this page shows,
// so a redraw does not wipe an hours value you are typing.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.closed || changes.names)) render();
});
render();
