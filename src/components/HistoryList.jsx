import React, { useState } from "react";
import Markdown from "./Markdown.jsx";
import { formatTimestamp } from "../lib/parse.js";

/*
 * Read-only, reverse-chronological session history. Entries: {ts, label, raw}.
 */
export default function HistoryList({ entries }) {
  const [openTs, setOpenTs] = useState(null);

  if (!entries || !entries.length) {
    return <p className="text-sm text-faint font-mono px-1 py-2">No previous queries recorded.</p>;
  }

  return (
    <div className="space-y-1.5">
      {entries.map((entry) => {
        const open = openTs === entry.ts;
        return (
          <div key={entry.ts} className="border border-edge bg-panel2">
            <button
              type="button"
              onClick={() => setOpenTs(open ? null : entry.ts)}
              className="w-full flex items-center justify-between px-3 py-2 text-left"
              aria-expanded={open}
            >
              <span className="font-mono text-[12px] text-dim">
                {formatTimestamp(entry.ts)}
                {entry.label ? <span className="text-amber ml-2">{entry.label}</span> : null}
              </span>
              <span className="font-mono text-faint text-sm">{open ? "[-]" : "[+]"}</span>
            </button>
            {open && (
              <div className="px-3 pb-3 border-t border-edge max-h-96 overflow-y-auto">
                <p className="text-[10px] uppercase tracking-wider text-faint font-mono mt-2 mb-1">
                  Read-only archive
                </p>
                <Markdown text={entry.raw} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
