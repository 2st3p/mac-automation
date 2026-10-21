// Pure naming rules shared by the service worker, the content script, and tests.

// Query parameters that track a click and never change which page loads.
// "ref" stays because some sites use it to pick a branch or version.
const TRACKING_PARAM = /^(utm_.*|fbclid|gclid|mc_cid|mc_eid|_ga|_gl|ref_src|usp)$/i;

// Words that say nothing about which page a tab shows.
const GENERIC_WORDS = new Set([
  "home", "dashboard", "dashboards", "untitled", "loading", "new", "tab", "page",
  "app", "welcome", "overview", "explore", "settings", "login", "sign", "in",
  "the", "of", "and", "a", "my", "workspace", "inbox",
  // Dates, so a heading like "Tue, Oct 20" is not taken for a page name.
  "today", "yesterday", "tomorrow",
  "mon", "tue", "wed", "thu", "fri", "sat", "sun",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
  "january", "february", "march", "april", "june", "july", "august", "september",
  "october", "november", "december",
]);

// Home pages greet you ("Good afternoon, Erik", "Welcome to Drive"). A short
// greeting says nothing about the page.
const GREETING = /^\s*(good (morning|afternoon|evening)|hello|hi|hey|welcome)\b/i;

// Host parts that name no site.
const HOST_NOISE = new Set(["www", "com", "net", "org", "io", "app", "co", "dev", "cloud"]);

// Turns a URL into the key that a name is stored under. Two URLs share a key
// only when they load the same page.
function urlKey(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  if (!/^https?:$/.test(u.protocol)) return rawUrl;
  const params = [...u.searchParams]
    .filter(([k]) => !TRACKING_PARAM.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  let path = u.pathname.replace(/\/+$/, "") || "/";
  // Google Docs serves one file at /edit, /view, and /preview.
  if (u.hostname === "docs.google.com") path = path.replace(/\/(edit|view|preview)$/, "");
  // Apps like Gmail route by hash ("#inbox/abc"). Plain anchors ("#heading=h.1") do not.
  const hash = /^#(!|.*\/)/.test(u.hash) ? u.hash : "";
  const query = params.length ? "?" + new URLSearchParams(params).toString() : "";
  return `${u.protocol}//${u.hostname.toLowerCase()}${u.port ? ":" + u.port : ""}${path}${query}${hash}`;
}

// Splits on anything that is not a letter or digit in any script, so a
// Japanese or Greek title still has words.
function words(text) {
  return (text || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// The words that name the site: host parts without digits, plus the site's own name.
function siteWords(rawUrl, siteName) {
  const set = new Set(words(siteName));
  try {
    for (const part of new URL(rawUrl).hostname.split(/[.-]/)) {
      const w = part.toLowerCase().replace(/\d+/g, "");
      if (w && !HOST_NOISE.has(w)) set.add(w);
    }
  } catch {}
  return set;
}

// A title is vague when it is empty, a greeting of at most 5 words, or at most
// 3 words that are each the site's name, a generic word, or a number.
function isVague(title, rawUrl, siteName) {
  const w = words(title);
  if (!w.length) return true;
  if (w.length <= 5 && GREETING.test(title)) return true;
  if (w.length > 3) return false;
  const site = siteWords(rawUrl, siteName);
  return w.every((x) => site.has(x) || GENERIC_WORDS.has(x) || /^\d+$/.test(x));
}

// Finds the most specific ID in a URL and the kind of page it names.
// "/experiments/44024" gives { id: "44024", type: "Experiment" }.
function urlId(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  // Issue keys are upper case ("DDD-2439"), which keeps slugs like "q3-2026" out.
  const isId = (s) => /^[A-Z][A-Z0-9]{1,9}-\d+$/.test(s) || /^\d{3,}$/.test(s);
  const segs = u.pathname.split("/").filter(Boolean).map(safeDecode);
  for (let i = segs.length - 1; i >= 0; i--) {
    if (isId(segs[i]) && !isDatePart(segs, i)) return { id: segs[i], type: typeName(segs[i - 1]) };
  }
  for (const [k, v] of u.searchParams) {
    // Matches "id", "experiment_id", and "experimentId".
    if ((/(^|_)id$/i.test(k) || /[a-z]Id$/.test(k)) && isId(v)) {
      return { id: v, type: typeName(k.replace(/_?id$/i, "")) };
    }
  }
  return null;
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// "/2026/10/20/story" holds a date, not an ID.
function isDatePart(segs, i) {
  return /^(19|20)\d\d$/.test(segs[i]) && /^\d{1,2}$/.test(segs[i + 1] || "");
}

function typeName(segment) {
  if (!segment || isIdLike(segment)) return "";
  let w = segment.replace(/[-_]+/g, " ").trim();
  if (/ies$/i.test(w)) w = w.slice(0, -3) + "y";
  else if (/s$/i.test(w) && !/(ss|us|is|news|series)$/i.test(w)) w = w.slice(0, -1);
  return w ? w[0].toUpperCase() + w.slice(1) : "";
}

function isIdLike(s) {
  return /\d/.test(s) && !/[a-z]{4,}/i.test(s);
}

// Builds a name for a tab whose own title is vague. The description comes
// first, and the URL's ID follows in parentheses. Returns null when the page
// offers nothing better than its own title.
// page: { url, title, siteName, headings, subheadings, shareTitles }
//   headings: h1 text. subheadings: large h2 and h3 text near the top.
//   shareTitles: og:title and twitter:title.
// Subheadings are often section names ("Folders", "Tue, Oct 20"), so they
// count only on pages whose URL has an ID, and only with 2 or more words.
// With needHeading set, a page without a usable heading gets no name.
function autoName(page, needHeading = false) {
  const ref = urlId(page.url);
  const subheadings = ref ? (page.subheadings || []).filter((h) => words(h).length >= 2) : [];
  const descriptor = [...(page.headings || []), ...subheadings, ...(page.shareTitles || [])]
    .map((h) => (h || "").replace(/\s+/g, " ").trim())
    .find((h) => h && h.length <= 120 && !isVague(h, page.url, page.siteName) && h !== page.title);
  if (descriptor) {
    if (!ref) return descriptor;
    if (new RegExp(`(?<![\\w])${escapeRe(ref.id)}(?![\\w])`).test(descriptor)) return idLast(descriptor, ref.id);
    return `${descriptor} (${ref.id})`;
  }
  if (ref && !needHeading) return ref.type ? `${ref.type} ${ref.id}` : ref.id;
  return null;
}

// Moves an ID at the start or end of a heading to the end, in parentheses:
// "(44749) Launch review" and "44749 - Launch review" give "Launch review (44749)".
// An ID in the middle stays where it is.
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function idLast(text, id) {
  const esc = escapeRe(id);
  const sep = "[-:|–—]";
  const lead = new RegExp(`^[\\s(\\[#]*${esc}(?![\\w])[\\s)\\]]*${sep}?\\s*`);
  const tail = new RegExp(`\\s*${sep}?[\\s(\\[#]*(?<![\\w])${esc}[\\s)\\]]*$`);
  const rest = text.replace(lead, "").replace(tail, "").trim();
  return rest && rest !== text ? `${rest} (${id})` : text;
}

if (typeof module !== "undefined") module.exports = { urlKey, isVague, urlId, autoName };
