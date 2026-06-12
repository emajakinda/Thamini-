# Thamini

NSE market intelligence and independent valuation research tool. Built for an equity analyst covering the Nairobi Securities Exchange who wants raw material for forming their own views, never target prices or valuation conclusions.

## What it does

Three tabs, all grounded in live web search on every query (model: `claude-sonnet-4-6` with the `web_search_20250305` tool, chosen for cost efficiency):

- **Company**: search any NSE-listed name or ticker, pick a valuation methodology (DCF, DDM, EV/EBITDA, P/E Relative, P/B Relative, Sum-of-Parts), and get news mapped to model assumptions, an assumption dashboard, exactly four open questions (with a persisted answer checklist), price context, and a 91-day T-bill discount rate flag. Persistent watchlist, thesis notes, and read-only session history per company.
- **Sector**: Banking, Telco, and Energy pinned by default. Pinned sectors track last-queried timestamps and go stale after 7 days. On-demand sector queries render in a temporary panel. Per-sector notes and history.
- **Macro**: core Kenya indicators auto-load on tab open (CBK rate, CPI, 91/182/364-day T-bills, latest T-bond auction, KES/USD, yield curve shape) with amber highlights on material moves, always-visible equity implications and fixed income positioning panels, on-demand thematic deep dives, and a watchlist exposure bridge.

A cross-tab alert strip at the very top fires on 91-day T-bill moves over 50bps in 30 days, KES/USD moves over 2% in 30 days, and stale pinned sectors. Every tab has a Compile to Report button that copies a clean plain text block to the clipboard.

## Persistence

All user data (watchlist, pinned sectors, notes, question answers, history, dismissed alerts and onboarding panels, macro snapshot) persists via the artifact storage API (`window.storage`) when running inside the Claude artifact environment. Outside that environment it falls back to in-memory storage for the session. No localStorage or sessionStorage is used.

## Running locally

```sh
npm install
npm run dev
```

Open the Settings panel in the header and paste an Anthropic API key. Inside the Claude artifact environment no key is needed.

## Build

```sh
npm run build
```

## Stack

React 18, Vite, Tailwind CSS 4. No backend, no database. Everything runs client-side.
