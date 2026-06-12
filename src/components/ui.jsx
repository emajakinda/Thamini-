import React, { useEffect, useState } from "react";
import { storageGet, storageSet, KEYS } from "../lib/storage.js";

export function Collapsible({ title, defaultOpen = true, children, badge = null }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-edge bg-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-panel2 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-amber truncate">
            {title}
          </span>
          {badge}
        </span>
        <span className="font-mono text-dim text-sm shrink-0 ml-2">{open ? "[-]" : "[+]"}</span>
      </button>
      {open && <div className="px-3 pb-3 pt-2 border-t border-edge">{children}</div>}
    </div>
  );
}

export function Spinner({ label = "Searching the web and compiling..." }) {
  return (
    <div className="flex items-center gap-2 px-3 py-4 text-dim text-sm font-mono">
      <span className="loading-dot text-amber">&#9608;</span>
      <span>{label}</span>
    </div>
  );
}

export function ErrorNote({ message, onRetry }) {
  return (
    <div className="border border-red/50 bg-red/10 px-3 py-2.5 text-sm text-red flex items-start justify-between gap-3">
      <span className="font-mono text-[13px]">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 text-[11px] uppercase tracking-wider border border-red/50 px-2 py-1 hover:bg-red/20"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function Button({ children, onClick, disabled, variant = "primary", className = "", type = "button" }) {
  const base = "text-[11px] uppercase tracking-wider font-semibold px-3 py-2 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-amber text-ink border-amber hover:bg-amber/85",
    ghost: "bg-transparent text-dim border-edge hover:text-fg hover:border-dim",
    green: "bg-transparent text-green border-green/50 hover:bg-green/10",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Field({ children }) {
  return <div className="flex flex-col gap-1">{children}</div>;
}

export const inputClass =
  "bg-panel2 border border-edge text-fg text-sm px-3 py-2 font-mono placeholder:text-faint focus:outline-none focus:border-amber w-full";

/* Autosaving notes field keyed to a storage key. Saves on every keystroke. */
export function NotesField({ storageKey, label = "Your Thesis Notes", placeholder = "Capture your own view here. Autosaves as you type." }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    setValue("");
    storageGet(storageKey, "").then((v) => {
      if (active) setValue(typeof v === "string" ? v : "");
    });
    return () => {
      active = false;
    };
  }, [storageKey]);

  const handleChange = async (e) => {
    const next = e.target.value;
    setValue(next);
    const ok = await storageSet(storageKey, next);
    setStatus(ok ? "saved" : "save failed");
  };

  return (
    <div className="border border-edge bg-panel">
      <div className="flex items-center justify-between px-3 py-2 border-b border-edge">
        <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-green">{label}</span>
        <span className="text-[10px] font-mono text-faint uppercase">{status}</span>
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={4}
        className="w-full bg-panel text-sm text-fg/90 px-3 py-2 font-sans resize-y focus:outline-none placeholder:text-faint"
      />
    </div>
  );
}

const ONBOARDING_COPY = {
  company:
    "Search any NSE-listed company, select your valuation methodology, and receive news mapped directly to your model assumptions. Add companies to your watchlist to track narrative evolution over time. Use the notes field to capture your own thesis.",
  sector:
    "Banking, Telco, and Energy are pinned by default. Query any sector on demand. Use the relative value framework to identify asymmetric opportunities within sectors.",
  macro:
    "Core indicators load automatically. Use thematic deep dives to explore specific macro risks. The Watchlist Exposure panel connects macro conditions directly to your tracked companies.",
};

export function HowToUse({ tab }) {
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let active = true;
    storageGet(KEYS.onboarding(tab), false).then((v) => {
      if (active) setDismissed(Boolean(v));
    });
    return () => {
      active = false;
    };
  }, [tab]);

  if (dismissed) return null;

  return (
    <div className="border border-green/40 bg-green/5">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-[11px] font-semibold tracking-[0.18em] uppercase text-green"
          aria-expanded={open}
        >
          How to Use {open ? "[-]" : "[+]"}
        </button>
        <button
          type="button"
          onClick={async () => {
            setDismissed(true);
            await storageSet(KEYS.onboarding(tab), true);
          }}
          className="text-[11px] uppercase tracking-wider text-dim hover:text-fg border border-edge px-2 py-1"
        >
          Dismiss
        </button>
      </div>
      {open && <p className="px-3 pb-3 text-sm text-fg/85 leading-relaxed">{ONBOARDING_COPY[tab]}</p>}
    </div>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-green text-ink text-sm font-semibold px-4 py-2.5 border border-green shadow-lg">
      {message}
    </div>
  );
}
