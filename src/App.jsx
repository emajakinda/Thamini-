import React, { useEffect, useMemo, useRef, useState } from "react";
import CompanyTab from "./tabs/CompanyTab.jsx";
import SectorTab from "./tabs/SectorTab.jsx";
import MacroTab from "./tabs/MacroTab.jsx";
import AlertBanner from "./components/AlertBanner.jsx";
import { Toast, inputClass, Button } from "./components/ui.jsx";
import { storageGet, storageSet, isPersistent, KEYS } from "./lib/storage.js";
import { daysSince } from "./lib/parse.js";

const TABS = [
  { id: "company", label: "Company" },
  { id: "sector", label: "Sector" },
  { id: "macro", label: "Macro" },
];

const DEFAULT_SECTORS = ["Banking", "Telco", "Energy"];

export default function App() {
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState("company");
  const [watchlist, setWatchlist] = useState([]);
  const [pinnedSectors, setPinnedSectors] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState({});
  const [macroSnapshot, setMacroSnapshot] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  /* Initial hydration from storage. */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [wl, pins, dismissed, snapshot, key] = await Promise.all([
          storageGet(KEYS.watchlist, []),
          storageGet(KEYS.pinnedSectors, null),
          storageGet(KEYS.dismissedAlerts, {}),
          storageGet(KEYS.macroSnapshot, null),
          storageGet(KEYS.apiKey, ""),
        ]);
        if (!active) return;
        setWatchlist(Array.isArray(wl) ? wl : []);
        if (pins === null) {
          const seeded = DEFAULT_SECTORS.map((name) => ({
            name,
            lastQueried: null,
            pinnedAt: new Date().toISOString(),
          }));
          setPinnedSectors(seeded);
          await storageSet(KEYS.pinnedSectors, seeded);
        } else {
          setPinnedSectors(Array.isArray(pins) ? pins : []);
        }
        setDismissedAlerts(dismissed && typeof dismissed === "object" ? dismissed : {});
        setMacroSnapshot(snapshot || null);
        setApiKey(typeof key === "string" ? key : "");
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const showToast = (message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  };

  const persistWatchlist = async (next) => {
    setWatchlist(next);
    await storageSet(KEYS.watchlist, next);
  };

  const persistPins = async (next) => {
    setPinnedSectors(next);
    await storageSet(KEYS.pinnedSectors, next);
  };

  const pinSector = async (name) => {
    if (!name || pinnedSectors.some((p) => p.name === name)) return;
    await persistPins([...pinnedSectors, { name, lastQueried: null, pinnedAt: new Date().toISOString() }]);
  };

  const unpinSector = async (name) => {
    await persistPins(pinnedSectors.filter((p) => p.name !== name));
  };

  const addToWatchlist = async (entry) => {
    const exists = watchlist.some((c) => c.name.toLowerCase() === entry.name.toLowerCase());
    if (!exists) {
      await persistWatchlist([...watchlist, entry]);
    }
    /* Watchlist additions automatically pin the company's sector. */
    if (entry.sector) await pinSector(entry.sector);
  };

  const removeFromWatchlist = async (entry) => {
    await persistWatchlist(watchlist.filter((c) => c.name.toLowerCase() !== entry.name.toLowerCase()));
  };

  const onSectorQueried = async (sector, ts) => {
    const next = pinnedSectors.map((p) => (p.name === sector ? { ...p, lastQueried: ts } : p));
    await persistPins(next);
  };

  const onSnapshot = async (snapshot) => {
    setMacroSnapshot(snapshot);
    await storageSet(KEYS.macroSnapshot, snapshot);
  };

  const dismissAlert = async (id) => {
    const next = { ...dismissedAlerts, [id]: true };
    setDismissedAlerts(next);
    await storageSet(KEYS.dismissedAlerts, next);
  };

  const saveApiKey = async (value) => {
    setApiKey(value);
    await storageSet(KEYS.apiKey, value);
  };

  const discountAlertActive = Boolean(macroSnapshot?.data?.discountRateAlert);

  /* Cross-tab alert computation. */
  const alerts = useMemo(() => {
    const list = [];
    if (macroSnapshot?.data) {
      const ts = macroSnapshot.ts;
      if (macroSnapshot.data.discountRateAlert) {
        list.push({
          id: `tbill91:${ts}`,
          message:
            "The 91-day T-bill has moved more than 50bps in 30 days. Review discount rate assumptions across your watchlist.",
        });
      }
      if (macroSnapshot.data.kesAlert) {
        list.push({
          id: `kes:${ts}`,
          message: "KES/USD has moved more than 2% in 30 days. Review FX exposure across your coverage.",
        });
      }
    }
    pinnedSectors.forEach((p) => {
      const ref = p.lastQueried || p.pinnedAt;
      if (ref && daysSince(ref) > 7) {
        list.push({
          id: `stale:${p.name}:${ref}`,
          message: `Stale data warning: pinned sector ${p.name} has not been refreshed in more than 7 days.`,
        });
      }
    });
    return list.filter((a) => !dismissedAlerts[a.id]);
  }, [macroSnapshot, pinnedSectors, dismissedAlerts]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-dim text-sm">
          <span className="loading-dot text-amber mr-2">&#9608;</span>Loading Thamini...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AlertBanner alerts={alerts} onDismiss={dismissAlert} />

      <header className="border-b border-edge bg-panel2">
        <div className="max-w-7xl mx-auto px-3 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-mono text-lg tracking-[0.3em] text-fg font-semibold leading-none">
              THAMINI<span className="text-amber">_</span>
            </h1>
            <p className="text-[11px] text-faint mt-1 tracking-wide uppercase">
              NSE Market Intelligence &amp; Valuation Research
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:block font-mono text-[10px] uppercase text-faint">
              {isPersistent() ? "storage: persistent" : "storage: session only"}
            </span>
            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              className="font-mono text-[11px] uppercase tracking-wider text-dim border border-edge px-2.5 py-1.5 hover:text-fg hover:border-dim"
              aria-expanded={showSettings}
            >
              Settings
            </button>
          </div>
        </div>
        {showSettings && (
          <div className="border-t border-edge">
            <div className="max-w-7xl mx-auto px-3 py-3 flex flex-col sm:flex-row gap-2 sm:items-center">
              <label className="text-[11px] uppercase tracking-wider text-dim shrink-0" htmlFor="api-key">
                Anthropic API key
              </label>
              <input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => saveApiKey(e.target.value)}
                placeholder="Optional. Leave blank inside the Claude artifact environment."
                className={inputClass}
              />
              <Button variant="ghost" onClick={() => setShowSettings(false)} className="shrink-0">
                Close
              </Button>
            </div>
          </div>
        )}
      </header>

      <nav className="border-b border-edge bg-panel sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-left sm:text-center border-b-2 transition-colors ${
                  active
                    ? "border-amber text-amber bg-panel2"
                    : "border-transparent text-dim hover:text-fg"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 w-full max-w-7xl mx-auto px-3 py-3">
        <div className={activeTab === "company" ? "" : "hidden"}>
          <CompanyTab
            watchlist={watchlist}
            onAddToWatchlist={addToWatchlist}
            onRemoveFromWatchlist={removeFromWatchlist}
            discountAlert={discountAlertActive}
            apiKey={apiKey}
            showToast={showToast}
          />
        </div>
        <div className={activeTab === "sector" ? "" : "hidden"}>
          <SectorTab
            pinnedSectors={pinnedSectors}
            onPin={pinSector}
            onUnpin={unpinSector}
            onSectorQueried={onSectorQueried}
            apiKey={apiKey}
            showToast={showToast}
          />
        </div>
        <div className={activeTab === "macro" ? "" : "hidden"}>
          <MacroTab
            active={activeTab === "macro"}
            watchlist={watchlist}
            apiKey={apiKey}
            showToast={showToast}
            snapshot={macroSnapshot}
            onSnapshot={onSnapshot}
          />
        </div>
      </main>

      <footer className="border-t border-edge bg-panel2">
        <div className="max-w-7xl mx-auto px-3 py-2.5">
          <p className="font-mono text-[10px] text-faint leading-relaxed">
            Research aid only. All figures are web-retrieved and date-stamped at query time. This tool never produces
            target prices or valuation conclusions; the analyst forms their own view.
          </p>
        </div>
      </footer>

      <Toast message={toast} />
    </div>
  );
}
