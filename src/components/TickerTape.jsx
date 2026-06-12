import React, { useEffect, useRef, useState } from "react";
import { runResearchQuery, extractJson } from "../lib/api.js";
import { TICKER_SYSTEM_PROMPT, tickerUserMessage } from "../lib/prompts.js";
import { storageGet, storageSet } from "../lib/storage.js";

const TICKER_KEY = "thamini:tickerSnapshot";
const REFRESH_THRESHOLD_MS = 30 * 60 * 1000;

function TickerItem({ item }) {
  const dir = (item.direction || "flat").toLowerCase();
  const color = dir === "up" ? "text-green" : dir === "down" ? "text-red" : "text-dim";
  const arrow = dir === "up" ? "+" : dir === "down" ? "-" : "=";
  return (
    <span className="inline-flex items-baseline gap-1.5 px-4 whitespace-nowrap font-mono text-[12px]">
      <span className="text-amber font-semibold">{item.symbol}</span>
      <span className="text-fg/90">{item.price}</span>
      {item.changePct ? (
        <span className={color}>
          [{arrow}] {item.changePct}
        </span>
      ) : null}
      <span className="text-edge select-none">|</span>
    </span>
  );
}

export default function TickerTape({ apiKey, watchlist }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadingRef = useRef(false);
  const hasKey = Boolean((apiKey || "").trim()) || (typeof window !== "undefined" && Boolean(window.claude));

  const refresh = async (force = false) => {
    if (loadingRef.current || !hasKey) return;
    if (!force && snapshot && Date.now() - new Date(snapshot.ts).getTime() < REFRESH_THRESHOLD_MS) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const raw = await runResearchQuery({
        system: TICKER_SYSTEM_PROMPT,
        userMessage: tickerUserMessage(watchlist),
        apiKey,
        maxTokens: 1500,
        maxWebSearches: 4,
      });
      const data = extractJson(raw);
      const next = { ts: new Date().toISOString(), data };
      setSnapshot(next);
      await storageSet(TICKER_KEY, next);
    } catch (err) {
      setError(err.message || "Ticker refresh failed.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  /* Hydrate from storage, then refresh once on load if stale. */
  useEffect(() => {
    let active = true;
    storageGet(TICKER_KEY, null).then((stored) => {
      if (!active) return;
      if (stored) setSnapshot(stored);
      const stale = !stored || Date.now() - new Date(stored.ts).getTime() >= REFRESH_THRESHOLD_MS;
      if (stale) {
        /* Defer so the freshly hydrated snapshot state is respected. */
        setTimeout(() => refreshRef.current(false), 0);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasKey]);

  /* Keep a stable ref so the hydration effect can call the latest refresh. */
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const items = snapshot?.data?.items || [];

  return (
    <div className="border-b border-edge bg-panel2">
      <div className="flex items-center">
        <div className="shrink-0 px-3 py-1.5 border-r border-edge flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-amber">NSE</span>
          <button
            type="button"
            onClick={() => refresh(true)}
            disabled={loading || !hasKey}
            className="font-mono text-[10px] uppercase text-dim hover:text-fg disabled:opacity-40"
            title={snapshot ? `Quotes as of ${snapshot.data?.asOf || "unknown"}, fetched ${new Date(snapshot.ts).toLocaleTimeString()}` : "Refresh quotes"}
          >
            {loading ? "..." : "refresh"}
          </button>
        </div>

        <div className="ticker-viewport flex-1 overflow-hidden" aria-label="NSE market ticker, delayed quotes">
          {items.length > 0 ? (
            <div className="ticker-track inline-flex">
              {[0, 1].map((copy) => (
                <span key={copy} aria-hidden={copy === 1}>
                  {items.map((item, i) => (
                    <TickerItem key={`${copy}-${item.symbol}-${i}`} item={item} />
                  ))}
                  <span className="inline-flex px-4 font-mono text-[11px] text-faint whitespace-nowrap items-baseline">
                    as of {snapshot?.data?.asOf || "n/a"} (delayed)
                    <span className="text-edge select-none ml-4">|</span>
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <p className="px-3 py-1.5 font-mono text-[11px] text-faint truncate">
              {!hasKey
                ? "Ticker idle. Add your API key in Settings to load NSE quotes."
                : loading
                ? "Loading NSE quotes..."
                : error
                ? `Ticker error: ${error}`
                : "No quotes loaded yet."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
