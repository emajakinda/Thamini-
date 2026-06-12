import React from "react";

/*
 * Persistent cross-tab alert strip rendered above the tabs. Alert computation
 * lives in App.jsx; this component renders and dismisses.
 */
export default function AlertBanner({ alerts, onDismiss }) {
  if (!alerts.length) return null;
  return (
    <div className="border-b border-amber/50">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start justify-between gap-3 bg-amberdim border-l-2 border-amber px-3 py-2"
        >
          <p className="text-[13px] text-amber font-mono leading-snug">
            <span className="font-semibold uppercase tracking-wider mr-2">[Alert]</span>
            {alert.message}
          </p>
          <button
            type="button"
            onClick={() => onDismiss(alert.id)}
            className="shrink-0 text-[11px] uppercase tracking-wider text-amber/80 hover:text-amber border border-amber/40 px-2 py-0.5"
            aria-label={`Dismiss alert: ${alert.message}`}
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
