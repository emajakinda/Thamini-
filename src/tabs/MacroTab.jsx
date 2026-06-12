import React, { useEffect, useRef, useState } from "react";
import Markdown from "../components/Markdown.jsx";
import { Collapsible, Spinner, ErrorNote, Button, NotesField, HowToUse, inputClass } from "../components/ui.jsx";
import { runResearchQuery, extractJson } from "../lib/api.js";
import {
  MACRO_CORE_SYSTEM_PROMPT,
  MACRO_THEME_SYSTEM_PROMPT,
  macroCoreUserMessage,
  macroThemeUserMessage,
} from "../lib/prompts.js";
import { formatTimestamp, markdownToPlain, copyToClipboard } from "../lib/parse.js";
import { storageGet, KEYS } from "../lib/storage.js";

const REFRESH_THRESHOLD_MS = 10 * 60 * 1000;

const INDICATOR_LAYOUT = [
  { key: "cbkRate", label: "CBK Policy Rate", metaKeys: ["lastDecision", "direction"] },
  { key: "inflation", label: "Inflation (CPI)", metaKeys: ["trend3m", "drivers"] },
  { key: "tbill91", label: "91-Day T-Bill", metaKeys: ["direction"] },
  { key: "tbill182", label: "182-Day T-Bill", metaKeys: ["direction"] },
  { key: "tbill364", label: "364-Day T-Bill", metaKeys: ["direction"] },
  { key: "tbond", label: "Latest T-Bond Auction", metaKeys: ["subscription"] },
  { key: "kesUsd", label: "KES / USD", metaKeys: ["move30d", "intervention"] },
  { key: "yieldCurve", label: "Yield Curve Shape", metaKeys: ["signal"] },
];

const META_LABELS = {
  lastDecision: "Last MPC",
  direction: "Direction",
  trend3m: "3m trend",
  drivers: "Drivers",
  subscription: "Subscription",
  move30d: "30d move",
  intervention: "CBK action",
  signal: "Signal",
};

function IndicatorCell({ label, data }) {
  if (!data) {
    return (
      <div className="border border-edge bg-panel2 p-3">
        <p className="text-[10px] uppercase tracking-wider text-faint">{label}</p>
        <p className="font-mono text-sm text-faint mt-1">not loaded</p>
      </div>
    );
  }
  const material = Boolean(data.material);
  return (
    <div className={`border p-3 ${material ? "border-amber bg-amberdim" : "border-edge bg-panel2"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-[10px] uppercase tracking-wider ${material ? "text-amber" : "text-dim"}`}>{label}</p>
        {material && (
          <span className="text-[9px] font-mono uppercase bg-amber text-ink px-1 py-0.5 shrink-0">moved</span>
        )}
      </div>
      <p className="font-mono text-lg text-fg mt-1 leading-tight">{data.value || "not found"}</p>
      <div className="mt-1.5 space-y-0.5">
        {Object.entries(META_LABELS).map(([k, lbl]) =>
          data[k] ? (
            <p key={k} className="font-mono text-[11px] text-dim leading-snug">
              <span className="text-faint">{lbl}:</span> {data[k]}
            </p>
          ) : null
        )}
        {data.source && <p className="font-mono text-[10px] text-faint leading-snug mt-1">Src: {data.source}</p>}
      </div>
    </div>
  );
}

export default function MacroTab({ active, watchlist, apiKey, showToast, snapshot, onSnapshot }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [themeInput, setThemeInput] = useState("");
  const [themeLoading, setThemeLoading] = useState(false);
  const [themeError, setThemeError] = useState(null);
  const [themeResult, setThemeResult] = useState(null); // {theme, ts, raw}

  const loadingRef = useRef(false);

  const loadCore = async (force = false) => {
    if (loadingRef.current) return;
    if (!force && snapshot && Date.now() - new Date(snapshot.ts).getTime() < REFRESH_THRESHOLD_MS) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const raw = await runResearchQuery({
        system: MACRO_CORE_SYSTEM_PROMPT,
        userMessage: macroCoreUserMessage(watchlist),
        apiKey,
        maxTokens: 5000,
        maxWebSearches: 10,
      });
      const data = extractJson(raw);
      const next = { ts: new Date().toISOString(), data };
      onSnapshot(next);
    } catch (err) {
      setError(err.message || "Macro load failed.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  /* Auto-load core indicators each time the tab is opened (skips if fresh). */
  useEffect(() => {
    if (active) loadCore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const runTheme = async (e) => {
    e.preventDefault();
    const theme = themeInput.trim();
    if (!theme || themeLoading) return;
    setThemeLoading(true);
    setThemeError(null);
    try {
      const raw = await runResearchQuery({
        system: MACRO_THEME_SYSTEM_PROMPT,
        userMessage: macroThemeUserMessage(theme),
        apiKey,
        maxTokens: 5000,
      });
      setThemeResult({ theme, ts: new Date().toISOString(), raw });
    } catch (err) {
      setThemeError(err.message || "Deep dive failed.");
    } finally {
      setThemeLoading(false);
    }
  };

  const data = snapshot?.data;
  const indicators = data?.indicators || {};
  const discountAlert = Boolean(data?.discountRateAlert);

  const compileReport = async () => {
    const notes = (await storageGet(KEYS.macroNotes, "")) || "";
    const lines = [];
    lines.push("THAMINI RESEARCH COMPILATION - MACRO");
    lines.push(`Compiled: ${formatTimestamp(new Date().toISOString())}`);
    if (snapshot) lines.push(`Core indicators as of: ${formatTimestamp(snapshot.ts)} (data date: ${data?.asOf || "n/a"})`);
    lines.push("");
    if (data) {
      lines.push("=== CORE INDICATORS ===");
      INDICATOR_LAYOUT.forEach(({ key, label }) => {
        const d = indicators[key];
        if (!d) return;
        const meta = Object.entries(META_LABELS)
          .filter(([k]) => d[k])
          .map(([k, lbl]) => `${lbl}: ${d[k]}`)
          .join(" | ");
        lines.push(`${label}: ${d.value || "not found"}${d.material ? " [MOVED MATERIALLY]" : ""}`);
        if (meta) lines.push(`  ${meta}`);
        if (d.source) lines.push(`  Source: ${d.source}`);
      });
      lines.push("");
      lines.push("=== EQUITY IMPLICATIONS ===");
      lines.push(markdownToPlain(data.equityImplications || "(none)"));
      lines.push("");
      lines.push("=== FIXED INCOME POSITIONING SIGNAL ===");
      lines.push(markdownToPlain(data.fixedIncomeSignal || "(none)"));
      lines.push("");
      if (Array.isArray(data.watchlistExposure) && data.watchlistExposure.length) {
        lines.push("=== WATCHLIST EXPOSURE ===");
        data.watchlistExposure.forEach((w) => {
          lines.push(`${w.company}${w.ticker ? ` (${w.ticker})` : ""} [${(w.flag || "").toUpperCase()}]: ${w.exposure}`);
        });
        lines.push("");
      }
    }
    if (themeResult) {
      lines.push(`=== THEMATIC DEEP DIVE: ${themeResult.theme.toUpperCase()} ===`);
      lines.push(`Run: ${formatTimestamp(themeResult.ts)}`);
      lines.push(markdownToPlain(themeResult.raw));
      lines.push("");
    }
    lines.push("=== MACRO NOTES ===");
    lines.push(notes || "(none)");
    const ok = await copyToClipboard(lines.join("\n"));
    showToast(ok ? "Report copied to clipboard." : "Copy failed. Clipboard unavailable.");
  };

  const flagColor = (flag) => {
    const f = (flag || "").toLowerCase();
    if (f === "high") return "text-amber border-amber/60";
    if (f === "moderate") return "text-fg border-edge";
    return "text-dim border-edge";
  };

  return (
    <div className="flex flex-col gap-3">
      <HowToUse tab="macro" />

      {discountAlert && (
        <div className="border-l-2 border-amber bg-amberdim px-3 py-2 text-[13px] font-mono text-amber">
          Risk-free rate has shifted materially. Review discount rate assumptions across your watchlist.
        </div>
      )}

      <div className="border border-edge bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-edge">
          <div>
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-amber">Core Indicators</span>
            <p className="font-mono text-[11px] text-faint mt-0.5">
              {snapshot
                ? `Retrieved ${formatTimestamp(snapshot.ts)}${data?.asOf ? ` | data as of ${data.asOf}` : ""}`
                : "Not loaded yet"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => loadCore(true)} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
            <Button variant="green" onClick={compileReport}>
              Compile to Report
            </Button>
          </div>
        </div>
        <div className="p-3">
          {loading && <Spinner label="Pulling current Kenya macro data from the web..." />}
          {error && <ErrorNote message={error} onRetry={() => loadCore(true)} />}
          {data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              {INDICATOR_LAYOUT.map(({ key, label }) => (
                <IndicatorCell key={key} label={label} data={indicators[key]} />
              ))}
            </div>
          )}
          {!data && !loading && !error && (
            <p className="font-mono text-sm text-faint py-2">Core indicators load automatically when this tab opens.</p>
          )}
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="border border-edge bg-panel">
            <div className="px-3 py-2.5 border-b border-edge">
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-green">
                Equity Implications
              </span>
            </div>
            <div className="p-3">
              <Markdown text={data.equityImplications || "Not available."} />
            </div>
          </div>
          <div className="border border-edge bg-panel">
            <div className="px-3 py-2.5 border-b border-edge">
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-green">
                Fixed Income Positioning Signal
              </span>
            </div>
            <div className="p-3">
              <Markdown text={data.fixedIncomeSignal || "Not available."} />
            </div>
          </div>
        </div>
      )}

      <div className="border border-edge bg-panel p-3 flex flex-col gap-2">
        <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-amber">
          On-Demand Thematic Deep Dive
        </span>
        <form onSubmit={runTheme} className="flex flex-col sm:flex-row gap-2">
          <input
            value={themeInput}
            onChange={(e) => setThemeInput(e.target.value)}
            placeholder='e.g. "KES depreciation impact on NSE importers"'
            className={inputClass}
            aria-label="Macro theme to research"
          />
          <Button type="submit" disabled={themeLoading || !themeInput.trim()} className="sm:w-32 shrink-0">
            {themeLoading ? "Running..." : "Run Deep Dive"}
          </Button>
        </form>
        {themeLoading && <Spinner label={`Researching theme: ${themeInput}...`} />}
        {themeError && <ErrorNote message={themeError} onRetry={runTheme} />}
        {themeResult && !themeLoading && (
          <div className="border border-edge bg-panel2 p-3 mt-1">
            <p className="font-mono text-[11px] text-faint mb-2 uppercase tracking-wider">
              Temporary panel: {themeResult.theme} | {formatTimestamp(themeResult.ts)}
            </p>
            <Markdown text={themeResult.raw} />
          </div>
        )}
      </div>

      <Collapsible title="Watchlist Exposure" defaultOpen>
        {!watchlist.length && (
          <p className="font-mono text-[12px] text-faint">
            Your watchlist is empty. Add companies on the Company tab to map macro exposure.
          </p>
        )}
        {watchlist.length > 0 && !data && (
          <p className="font-mono text-[12px] text-faint">Loads with the core indicators panel.</p>
        )}
        {Array.isArray(data?.watchlistExposure) && data.watchlistExposure.length > 0 && (
          <ul className="space-y-1.5 mt-1">
            {data.watchlistExposure.map((w, i) => (
              <li key={i} className="border border-edge bg-panel2 px-3 py-2 flex flex-col sm:flex-row sm:items-start gap-2">
                <span className={`shrink-0 font-mono text-[10px] uppercase border px-1.5 py-0.5 ${flagColor(w.flag)}`}>
                  {w.flag || "n/a"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-fg">
                    {w.company}
                    {w.ticker && <span className="font-mono text-amber text-[12px] ml-2">{w.ticker}</span>}
                    {w.sector && <span className="font-mono text-faint text-[11px] ml-2">{w.sector}</span>}
                  </p>
                  <p className="text-[13px] text-dim leading-snug mt-0.5">{w.exposure}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Collapsible>

      <NotesField storageKey={KEYS.macroNotes} label="Macro Notes" placeholder="Your macro read, rate path view, FX view. Autosaves." />
    </div>
  );
}
