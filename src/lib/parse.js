/* Parsing helpers for model output: section splitting and question extraction. */

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/*
 * Split a markdown response into named sections. Titles are matched with or
 * without their leading number, tolerant of heading markers and bold wrappers.
 * Returns an object keyed by title; sections that were not found are absent.
 */
export function splitSections(text, titles) {
  if (!text) return {};
  const found = [];
  titles.forEach((title, i) => {
    const escaped = escapeRegExp(title);
    const patterns = [
      new RegExp(`^[ \\t#>*_]*${i + 1}\\s*[.):-]?\\s*\\**\\s*${escaped}`, "im"),
      new RegExp(`^[ \\t#>*_]*\\**\\s*${escaped}`, "im"),
    ];
    for (const re of patterns) {
      const m = re.exec(text);
      if (m) {
        found.push({ title, index: m.index });
        return;
      }
    }
  });

  const ordered = found.sort((a, b) => a.index - b.index);
  const out = {};
  ordered.forEach((f, j) => {
    const end = j + 1 < ordered.length ? ordered[j + 1].index : text.length;
    let body = text.slice(f.index, end);
    body = body.replace(/^[^\n]*\n?/, "").trim();
    out[f.title] = body;
  });
  return out;
}

/* Pull individual questions out of the OPEN QUESTIONS section body. */
export function parseQuestions(body) {
  if (!body) return [];
  const lines = body.split("\n");
  const questions = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^\s*(?:\d+\s*[.)]|[-*])\s+(.*)/);
    if (m) {
      if (current) questions.push(current.trim());
      current = m[1];
    } else if (current !== null && line.trim()) {
      current += " " + line.trim();
    }
  }
  if (current) questions.push(current.trim());
  return questions.filter(Boolean).slice(0, 8);
}

export function formatTimestamp(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

export function daysSince(ts) {
  if (!ts) return Infinity;
  return (Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24);
}

/* Strip markdown decoration for plain text report export. */
export function markdownToPlain(md) {
  if (!md) return "";
  return md
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
