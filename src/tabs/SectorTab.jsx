import React, { useEffect, useState } from "react";
import Markdown from "../components/Markdown.jsx";
import HistoryList from "../components/HistoryList.jsx";
import { Collapsible, Spinner, ErrorNote, Button, NotesField, HowToUse, inputClass } from "../components/ui.jsx";
import { runResearchQuery } from "../lib/api.js";
import { SECTOR_SYSTEM_PROMPT, sectorUserMessage, SECTOR_SECTIONS } from "../lib/prompts.js";
import { splitSections, formatTimestamp, daysSince, markdownToPlain, copyToClipboard } from "../lib/parse.js";
import { storageGet, storageAppend, storageSet, KEYS } from "../lib/storage.js";
import { SECTORS } from "../data/nse.js";

function SectorResult({ raw }) {
  const sections = splitSections(raw, SECTOR_SECTIONS);
  const labels = [
    "1. Sector Developments",
    "2. Relative Value Framework",
    "3. Key Movers",
    "4. Sector Thesis",
    "5. Watchlist Flag",
  ];
  return (
    <div className="space-y-2">
      {SECTOR_SECTIONS.map((title, i) => (
        <Collapsible key={title} title={labels[i]} defaultOpen={i === 0}>
          <Markdown text={sections[title] || "Section not found in output."} />
        </Collapsible>
      ))}
    </div>
  );
}

function PinnedSectorCard({ sector, lastQueried, onRefresh, onUnpin, loading, error }) {
  const [latest, setLatest] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    storageGet(KEYS.sectorLatest(sector), null).then((v) => {
      if (active) setLatest(v);
    });
    return () => {
      active = false;
    };
  }, [sector, lastQueried, loading]);

  useEffect(() => {
    if (!showHistory) return;
    let active = true;
    storageGet(KEYS.sectorHistory(sector), []).then((v) => {
      if (active) setHistory(Array.isArray(v) ? v : []);
    });
    return () => {
      active = false;
    };
  }, [showHistory, sector, lastQueried]);

  const stale = daysSince(lastQueried) > 7;

  return (
    <div className="border border-edge bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-edge">
        <div className="min-w-0">
          <span className="text-[12px] font-semibold tracking-[0.18em] uppercase text-amber">{sector}</span>
          <p className="font-mono text-[11px] mt-0.5">
            {lastQueried ? (
              <span className={stale ? "text-amber" : "text-faint"}>
                Last queried {formatTimestamp(lastQueried)}
                {stale ? " (stale, over 7 days)" : ""}
              </span>
            ) : (
              <span className="text-faint">Never queried</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? "Hide History" : "History"}
          </Button>
          <Button onClick={() => onRefresh(sector)} disabled={loading}>
            {loading ? "Running..." : "Refresh"}
          </Button>
          <Button variant="ghost" onClick={() => onUnpin(sector)}>
            Unpin
          </Button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {loading && <Spinner label={`Querying ${sector} sector...`} />}
        {error && <ErrorNote message={error} onRetry={() => onRefresh(sector)} />}

        {showHistory && (
          <Collapsible title="Session History (read-only, newest first)" defaultOpen>
            <HistoryList entries={history} />
          </Collapsible>
        )}

        {latest && !loading && (
          <div className="border border-edge bg-panel2">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2 text-left"
              aria-expanded={open}
            >
              <span className="text-[11px] uppercase tracking-wider text-dim">
                Latest output <span className="font-mono text-faint">{formatTimestamp(latest.ts)}</span>
              </span>
              <span className="font-mono text-faint text-sm">{open ? "[-]" : "[+]"}</span>
            </button>
            {open && (
              <div className="px-3 pb-3 border-t border-edge">
                <SectorResult raw={latest.raw} />
              </div>
            )}
          </div>
        )}

        {!latest && !loading && !error && (
          <p className="font-mono text-[12px] text-faint">No data yet. Hit Refresh to pull current sector intelligence.</p>
        )}

        <NotesField storageKey={KEYS.sectorNotes(sector)} label={`${sector} Notes`} placeholder="Sector view, relative value ideas, names to dig into. Autosaves." />
      </div>
    </div>
  );
}

export default function SectorTab({ pinnedSectors, onPin, onUnpin, onSectorQueried, apiKey, showToast }) {
  const [loadingSector, setLoadingSector] = useState(null);
  const [errors, setErrors] = useState({});
  const [pinSelect, setPinSelect] = useState(SECTORS[0]);

  const [adhocInput, setAdhocInput] = useState("");
  const [adhocLoading, setAdhocLoading] = useState(false);
  const [adhocError, setAdhocError] = useState(null);
  const [adhocResult, setAdhocResult] = useState(null); // {sector, ts, raw}

  const refreshSector = async (sector) => {
    if (loadingSector) return;
    setLoadingSector(sector);
    setErrors((e) => ({ ...e, [sector]: null }));
    try {
      const raw = await runResearchQuery({
        system: SECTOR_SYSTEM_PROMPT,
        userMessage: sectorUserMessage(sector),
        apiKey,
        maxTokens: 5000,
      });
      const ts = new Date().toISOString();
      await storageSet(KEYS.sectorLatest(sector), { ts, raw });
      await storageAppend(KEYS.sectorHistory(sector), { ts, raw }, 20);
      onSectorQueried(sector, ts);
    } catch (err) {
      setErrors((e) => ({ ...e, [sector]: err.message || "Query failed." }));
    } finally {
      setLoadingSector(null);
    }
  };

  const runAdhoc = async (e) => {
    e.preventDefault();
    const sector = adhocInput.trim();
    if (!sector || adhocLoading) return;
    setAdhocLoading(true);
    setAdhocError(null);
    try {
      const raw = await runResearchQuery({
        system: SECTOR_SYSTEM_PROMPT,
        userMessage: sectorUserMessage(sector),
        apiKey,
        maxTokens: 5000,
      });
      setAdhocResult({ sector, ts: new Date().toISOString(), raw });
    } catch (err) {
      setAdhocError(err.message || "Query failed.");
    } finally {
      setAdhocLoading(false);
    }
  };

  const compileReport = async () => {
    const lines = [];
    lines.push("THAMINI RESEARCH COMPILATION - SECTOR");
    lines.push(`Compiled: ${formatTimestamp(new Date().toISOString())}`);
    lines.push("");
    for (const p of pinnedSectors) {
      const latest = await storageGet(KEYS.sectorLatest(p.name), null);
      const notes = (await storageGet(KEYS.sectorNotes(p.name), "")) || "";
      lines.push(`==== PINNED SECTOR: ${p.name.toUpperCase()} ====`);
      lines.push(`Last queried: ${p.lastQueried ? formatTimestamp(p.lastQueried) : "never"}`);
      if (latest) {
        lines.push(markdownToPlain(latest.raw));
      } else {
        lines.push("(no data pulled yet)");
      }
      lines.push(`--- Analyst notes (${p.name}) ---`);
      lines.push(notes || "(none)");
      lines.push("");
    }
    if (adhocResult) {
      lines.push(`==== ON-DEMAND QUERY: ${adhocResult.sector.toUpperCase()} ====`);
      lines.push(`Run: ${formatTimestamp(adhocResult.ts)}`);
      lines.push(markdownToPlain(adhocResult.raw));
      lines.push("");
    }
    const ok = await copyToClipboard(lines.join("\n"));
    showToast(ok ? "Report copied to clipboard." : "Copy failed. Clipboard unavailable.");
  };

  const unpinned = SECTORS.filter((s) => !pinnedSectors.some((p) => p.name === s));

  return (
    <div className="flex flex-col gap-3">
      <HowToUse tab="sector" />

      <div className="border border-edge bg-panel p-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-1">
          <select
            value={pinSelect}
            onChange={(e) => setPinSelect(e.target.value)}
            className="bg-panel2 border border-edge text-fg text-sm px-3 py-2 font-mono focus:outline-none focus:border-amber flex-1 sm:max-w-64"
            aria-label="Sector to pin"
          >
            {(unpinned.length ? unpinned : SECTORS).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button variant="ghost" onClick={() => onPin(pinSelect)} disabled={pinnedSectors.some((p) => p.name === pinSelect)}>
            Pin Sector
          </Button>
        </div>
        <Button variant="green" onClick={compileReport}>
          Compile to Report
        </Button>
      </div>

      <div className="space-y-3">
        {pinnedSectors.map((p) => (
          <PinnedSectorCard
            key={p.name}
            sector={p.name}
            lastQueried={p.lastQueried}
            onRefresh={refreshSector}
            onUnpin={onUnpin}
            loading={loadingSector === p.name}
            error={errors[p.name]}
          />
        ))}
        {pinnedSectors.length === 0 && (
          <p className="font-mono text-sm text-faint border border-edge bg-panel px-3 py-4">
            No pinned sectors. Pin one above or add companies to your watchlist.
          </p>
        )}
      </div>

      <div className="border border-edge bg-panel p-3 flex flex-col gap-2">
        <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-amber">
          On-Demand Sector Query
        </span>
        <form onSubmit={runAdhoc} className="flex flex-col sm:flex-row gap-2">
          <input
            value={adhocInput}
            onChange={(e) => setAdhocInput(e.target.value)}
            placeholder="Any NSE sector, e.g. Insurance"
            className={inputClass}
            aria-label="Sector to query on demand"
          />
          <Button type="submit" disabled={adhocLoading || !adhocInput.trim()} className="sm:w-32 shrink-0">
            {adhocLoading ? "Running..." : "Run Query"}
          </Button>
        </form>
        {adhocLoading && <Spinner label={`Querying ${adhocInput} sector...`} />}
        {adhocError && <ErrorNote message={adhocError} onRetry={runAdhoc} />}
        {adhocResult && !adhocLoading && (
          <div className="border border-edge bg-panel2 p-3 mt-1">
            <p className="font-mono text-[11px] text-faint mb-2 uppercase tracking-wider">
              Temporary panel: {adhocResult.sector} | {formatTimestamp(adhocResult.ts)} | does not overwrite pinned data
            </p>
            <SectorResult raw={adhocResult.raw} />
          </div>
        )}
      </div>
    </div>
  );
}
