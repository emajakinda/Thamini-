import React from "react";

/*
 * Lightweight markdown renderer tuned for research output: tables, headings,
 * lists, bold, inline code, and links. Figures inside tables render in
 * monospace per the terminal design language.
 */

function renderInline(text, keyPrefix) {
  const nodes = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b${i}`} className="text-fg font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={`${keyPrefix}-c${i}`} className="font-mono text-amber text-[0.92em]">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const lm = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      nodes.push(
        <a
          key={`${keyPrefix}-l${i}`}
          href={lm[2]}
          target="_blank"
          rel="noreferrer"
          className="text-amber underline decoration-amber/40 hover:decoration-amber"
        >
          {lm[1]}
        </a>
      );
    }
    last = m.index + token.length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function isTableLine(line) {
  return line.trim().startsWith("|") || (line.includes("|") && line.split("|").length > 2);
}

function isSeparatorLine(line) {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");
}

function splitRow(line) {
  let l = line.trim();
  if (l.startsWith("|")) l = l.slice(1);
  if (l.endsWith("|")) l = l.slice(0, -1);
  return l.split("|").map((c) => c.trim());
}

function Table({ lines, keyPrefix }) {
  const rows = lines.filter((l) => !isSeparatorLine(l)).map(splitRow);
  if (!rows.length) return null;
  const [header, ...body] = rows;
  return (
    <div className="overflow-x-auto my-3 border border-edge">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-panel2">
            {header.map((cell, i) => (
              <th
                key={`${keyPrefix}-h${i}`}
                className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-amber border-b border-edge whitespace-nowrap"
              >
                {renderInline(cell, `${keyPrefix}-h${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={`${keyPrefix}-r${r}`} className={r % 2 ? "bg-panel2/60" : ""}>
              {row.map((cell, c) => (
                <td
                  key={`${keyPrefix}-r${r}c${c}`}
                  className="px-3 py-2 align-top border-b border-edge/50 font-mono text-[13px] text-fg/90"
                >
                  {renderInline(cell, `${keyPrefix}-r${r}c${c}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Markdown({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  const blocks = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (isTableLine(line) && i + 1 < lines.length && (isSeparatorLine(lines[i + 1]) || isTableLine(lines[i + 1]))) {
      const tableLines = [];
      while (i < lines.length && (isTableLine(lines[i]) || isSeparatorLine(lines[i]))) {
        tableLines.push(lines[i]);
        i += 1;
      }
      blocks.push(<Table key={`t${key++}`} lines={tableLines} keyPrefix={`t${key}`} />);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)/);
    if (heading) {
      blocks.push(
        <div key={`h${key++}`} className="mt-4 mb-1 text-[12px] uppercase tracking-widest text-amber font-semibold">
          {renderInline(heading[2], `h${key}`)}
        </div>
      );
      i += 1;
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)/);
    const numbered = line.match(/^\s*(\d+)\s*[.)]\s+(.*)/);
    if (bullet || numbered) {
      const items = [];
      while (i < lines.length) {
        const b = lines[i].match(/^\s*[-*]\s+(.*)/);
        const n = lines[i].match(/^\s*(\d+)\s*[.)]\s+(.*)/);
        if (b) items.push({ marker: "-", text: b[1] });
        else if (n) items.push({ marker: `${n[1]}.`, text: n[2] });
        else if (lines[i].trim() && items.length && /^\s{2,}/.test(lines[i])) {
          items[items.length - 1].text += " " + lines[i].trim();
        } else break;
        i += 1;
      }
      blocks.push(
        <ul key={`u${key++}`} className="my-2 space-y-1.5">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 text-sm leading-relaxed">
              <span className="text-amber font-mono shrink-0">{item.marker}</span>
              <span className="text-fg/90">{renderInline(item.text, `u${key}-${j}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    blocks.push(
      <p key={`p${key++}`} className="my-2 text-sm leading-relaxed text-fg/90">
        {renderInline(line.trim(), `p${key}`)}
      </p>
    );
    i += 1;
  }

  return <div>{blocks}</div>;
}
