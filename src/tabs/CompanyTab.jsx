import React, { useEffect, useMemo, useState } from "react";
import Markdown from "../components/Markdown.jsx";
import HistoryList from "../components/HistoryList.jsx";
import { Collapsible, Spinner, ErrorNote, Button, NotesField, HowToUse, inputClass } from "../components/ui.jsx";
import { runResearchQuery } from "../lib/api.js";
import { companySystemPrompt, companyUserMessage, METHODOLOGIES, COMPANY_SECTIONS } from "../lib/prompts.js";
import { splitSections, parseQuestions, formatTimestamp, markdownToPlain, copyToClipboard } from "../lib/parse.js";
import { storageGet, storageSet, storageAppend, KEYS } from "../lib/storage.js";
import { NSE_COMPANIES, resolveCompany } from "../data/nse.js";

function companyKeyOf(name) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, "-");
}

/* Open Questions checklist with persisted per-question answers. */
function OpenQuestions({ questions, companyKey, queryTs }) {
  const storageKey = KEYS.questionAnswers(companyKey, queryTs);
  const [answers, setAnswers] = useState({});
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    let active = true;
    storageGet(storageKey, {}).then((v) => {
      if (active) setAnswers(v && typeof v === "object" ? v : {});
    });
    return () => {
      active = false;
    };
  }, [storageKey]);

  const update = async (idx, patch) => {
    const next = { ...answers, [idx]: { ...(answers[idx] || {}), ...patch } };
    setAnswers(next);
    await storageSet(storageKey, next);
  };

  if (!questions.length) {
    return <p className="text-sm text-faint font-mono">No questions parsed from this output.</p>;
  }

  return (
    <ol className="space-y-3 mt-1">
      {questions.map((q, idx) => {
        const a = answers[idx] || {};
        const open = expanded[idx] || Boolean(a.answer);
        return (
          <li key={idx} className="border border-edge bg-panel2 px-3 py-2.5">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => update(idx, { answered: !a.answered })}
                className={`shrink-0 mt-0.5 w-5 h-5 border font-mono text-[12px] leading-none flex items-center justify-center ${
                  a.answered ? "border-green text-green bg-green/10" : "border-edge text-faint hover:border-dim"
                }`}
                aria-pressed={Boolean(a.answered)}
                aria-label={a.answered ? "Mark question as open" : "Mark question as answered"}
              >
                {a.answered ? "x" : ""}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm leading-relaxed ${a.answered ? "text-faint line-through decoration-faint/60" : "text-fg/90"}`}>
                  <span className="font-mono text-amber mr-1.5">{idx + 1}.</span>
                  {q}
                </p>
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [idx]: !open }))}
                  className="mt-1.5 text-[11px] uppercase tracking-wider text-dim hover:text-amber"
                >
                  {open ? "Hide answer field" : "Add your answer"}
                </button>
                {open && (
                  <textarea
                    value={a.answer || ""}
                    onChange={(e) => update(idx, { answer: e.target.value })}
                    placeholder="Type your answer. Autosaves."
                    rows={2}
                    className="mt-1.5 w-full bg-ink border border-edge text-sm text-fg/90 px-2.5 py-2 resize-y focus:outline-none focus:border-amber placeholder:text-faint"
                  />
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function WatchlistPanel({ watchlist, onAdd, onRemove, onSelect, activeKey }) {
  const [input, setInput] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(true);

  const submit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const resolved = resolveCompany(input);
    const entry = resolved
      ? { ...resolved }
      : { name: input.trim(), ticker: "", sector: "" };
    onAdd(entry);
    setNote(
      resolved
        ? `Added ${resolved.name}. Sector pinned: ${resolved.sector}.`
        : `Added ${input.trim()}. Sector unknown, not auto-pinned.`
    );
    setInput("");
  };

  return (
    <aside className="border border-edge bg-panel lg:sticky lg:top-3 self-start w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 lg:cursor-default"
        aria-expanded={open}
      >
        <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-amber">Watchlist</span>
        <span className="font-mono text-dim text-sm lg:hidden">{open ? "[-]" : "[+]"}</span>
      </button>
      <div className={`${open ? "" : "hidden"} lg:block border-t border-edge`}>
        <form onSubmit={submit} className="p-3 flex flex-col gap-2">
          <input
            list="nse-companies"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add name or ticker"
            className={inputClass}
            aria-label="Add company to watchlist"
          />
          <datalist id="nse-companies">
            {NSE_COMPANIES.map((c) => (
              <option key={c.ticker} value={c.name}>{`${c.ticker} | ${c.sector}`}</option>
            ))}
          </datalist>
          <Button type="submit" variant="ghost">
            Add to Watchlist
          </Button>
          {note && <p className="text-[11px] font-mono text-faint leading-snug">{note}</p>}
        </form>
        <ul className="border-t border-edge max-h-[50vh] overflow-y-auto">
          {watchlist.length === 0 && (
            <li className="px-3 py-3 text-[12px] font-mono text-faint">Watchlist is empty.</li>
          )}
          {watchlist.map((c) => {
            const key = companyKeyOf(c.name);
            const active = key === activeKey;
            return (
              <li key={key} className={`flex items-center border-b border-edge/60 ${active ? "bg-amberdim" : ""}`}>
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  className="flex-1 min-w-0 text-left px-3 py-2 hover:bg-panel2"
                >
                  <span className="block text-sm text-fg truncate">{c.name}</span>
                  <span className="block font-mono text-[11px] text-dim">
                    {c.ticker || "no ticker"}
                    {c.sector ? <span className="text-faint"> | {c.sector}</span> : null}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(c)}
                  className="shrink-0 px-2.5 py-2 font-mono text-faint hover:text-red"
                  aria-label={`Remove ${c.name} from watchlist`}
                >
                  x
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

export default function CompanyTab({ watchlist, onAddToWatchlist, onRemoveFromWatchlist, discountAlert, apiKey, showToast }) {
  const [companyInput, setCompanyInput] = useState("");
  const [methodology, setMethodology] = useState(METHODOLOGIES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // {ts, company, ticker, methodology, raw, sections}
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);

  const activeCompany = result?.company || companyInput;
  const companyKey = companyKeyOf(result?.company || companyInput);

  useEffect(() => {
    if (!showHistory || !companyKey) return;
    let active = true;
    storageGet(KEYS.companyHistory(companyKey), []).then((v) => {
      if (active) setHistory(Array.isArray(v) ? v : []);
    });
    return () => {
      active = false;
    };
  }, [showHistory, companyKey, result]);

  const runQuery = async (companyOverride) => {
    const target = (companyOverride || companyInput).trim();
    if (!target || loading) return;
    const resolved = resolveCompany(target);
    const display = resolved ? `${resolved.name} (${resolved.ticker})` : target;
    setLoading(true);
    setError(null);
    try {
      const raw = await runResearchQuery({
        system: companySystemPrompt(methodology),
        userMessage: companyUserMessage(display, methodology),
        apiKey,
        maxTokens: 6000,
      });
      const ts = new Date().toISOString();
      const sections = splitSections(raw, COMPANY_SECTIONS);
      const entry = {
        ts,
        company: resolved ? resolved.name : target,
        ticker: resolved ? resolved.ticker : "",
        methodology,
        raw,
        sections,
      };
      setResult(entry);
      setShowHistory(false);
      const key = companyKeyOf(entry.company);
      await storageAppend(KEYS.companyHistory(key), { ts, label: methodology, raw }, 20);
    } catch (err) {
      setError(err.message || "Query failed.");
    } finally {
      setLoading(false);
    }
  };

  const selectFromWatchlist = async (c) => {
    setCompanyInput(c.name);
    setError(null);
    setShowHistory(false);
    const key = companyKeyOf(c.name);
    try {
      const entries = await storageGet(KEYS.companyHistory(key), []);
      if (Array.isArray(entries) && entries.length) {
        const latest = entries[0];
        setResult({
          ts: latest.ts,
          company: c.name,
          ticker: c.ticker,
          methodology: latest.label || methodology,
          raw: latest.raw,
          sections: splitSections(latest.raw, COMPANY_SECTIONS),
        });
      } else {
        setResult(null);
      }
    } catch {
      setResult(null);
    }
  };

  const questions = useMemo(
    () => (result ? parseQuestions(result.sections[COMPANY_SECTIONS[2]]) : []),
    [result]
  );

  const discountFlagBody = result?.sections[COMPANY_SECTIONS[4]] || "";
  const discountFlagHot = /shifted materially/i.test(discountFlagBody);

  const compileReport = async () => {
    if (!result) return;
    const answers = (await storageGet(KEYS.questionAnswers(companyKey, result.ts), {})) || {};
    const notes = (await storageGet(KEYS.companyNotes(companyKey), "")) || "";
    const lines = [];
    lines.push("THAMINI RESEARCH COMPILATION - COMPANY");
    lines.push(`Company: ${result.company}${result.ticker ? ` (${result.ticker})` : ""}`);
    lines.push(`Methodology: ${result.methodology}`);
    lines.push(`Query run: ${formatTimestamp(result.ts)}`);
    lines.push(`Compiled: ${formatTimestamp(new Date().toISOString())}`);
    lines.push("");
    COMPANY_SECTIONS.forEach((title) => {
      if (title === "OPEN QUESTIONS") return;
      const body = result.sections[title];
      if (!body) return;
      lines.push(`=== ${title} ===`);
      lines.push(markdownToPlain(body));
      lines.push("");
    });
    if (questions.length) {
      lines.push("=== OPEN QUESTIONS ===");
      questions.forEach((q, idx) => {
        const a = answers[idx] || {};
        lines.push(`${idx + 1}. [${a.answered ? "ANSWERED" : "OPEN"}] ${q}`);
        if (a.answer) lines.push(`   Analyst answer: ${a.answer}`);
      });
      lines.push("");
    }
    lines.push("=== YOUR THESIS NOTES ===");
    lines.push(notes || "(none)");
    const ok = await copyToClipboard(lines.join("\n"));
    showToast(ok ? "Report copied to clipboard." : "Copy failed. Clipboard unavailable.");
  };

  return (
    <div className="flex flex-col gap-3">
      <HowToUse tab="company" />

      {discountAlert && (
        <div className="border-l-2 border-amber bg-amberdim px-3 py-2 text-[13px] font-mono text-amber">
          Risk-free rate has shifted materially. Review discount rate assumptions across your watchlist.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[270px_1fr] gap-3 items-start">
        <WatchlistPanel
          watchlist={watchlist}
          onAdd={onAddToWatchlist}
          onRemove={onRemoveFromWatchlist}
          onSelect={selectFromWatchlist}
          activeKey={companyKey}
        />

        <div className="flex flex-col gap-3 min-w-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runQuery();
            }}
            className="border border-edge bg-panel p-3 flex flex-col sm:flex-row gap-2"
          >
            <input
              list="nse-companies"
              value={companyInput}
              onChange={(e) => setCompanyInput(e.target.value)}
              placeholder="Company name or ticker, e.g. Safaricom or SCOM"
              className={inputClass}
              aria-label="Company to research"
            />
            <select
              value={methodology}
              onChange={(e) => setMethodology(e.target.value)}
              className="bg-panel2 border border-edge text-fg text-sm px-3 py-2 font-mono focus:outline-none focus:border-amber sm:w-44"
              aria-label="Valuation methodology"
            >
              {METHODOLOGIES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={loading || !companyInput.trim()} className="sm:w-32 shrink-0">
              {loading ? "Running..." : "Run Query"}
            </Button>
          </form>

          {loading && <Spinner label={`Researching ${activeCompany || "company"} under ${methodology}...`} />}
          {error && <ErrorNote message={error} onRetry={() => runQuery()} />}

          {result && !loading && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border border-edge bg-panel px-3 py-2">
                <p className="font-mono text-[12px] text-dim">
                  <span className="text-fg">{result.company}</span>
                  {result.ticker && <span className="text-amber ml-2">{result.ticker}</span>}
                  <span className="ml-2">| {result.methodology}</span>
                  <span className="ml-2 text-faint">{formatTimestamp(result.ts)}</span>
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setShowHistory((s) => !s)}>
                    {showHistory ? "Hide History" : "History"}
                  </Button>
                  <Button variant="green" onClick={compileReport}>
                    Compile to Report
                  </Button>
                </div>
              </div>

              {showHistory && (
                <Collapsible title="Session History (read-only, newest first)" defaultOpen>
                  <HistoryList entries={history} />
                </Collapsible>
              )}

              <Collapsible title="1. Valuation-Relevant News">
                <Markdown text={result.sections[COMPANY_SECTIONS[0]] || "Section not found in output."} />
              </Collapsible>

              <Collapsible title="2. Assumption Dashboard">
                <Markdown text={result.sections[COMPANY_SECTIONS[1]] || "Section not found in output."} />
              </Collapsible>

              <Collapsible title="3. Open Questions">
                <OpenQuestions questions={questions} companyKey={companyKey} queryTs={result.ts} />
              </Collapsible>

              <Collapsible title="4. Price Context">
                <Markdown text={result.sections[COMPANY_SECTIONS[3]] || "Section not found in output."} />
              </Collapsible>

              <Collapsible
                title="5. Discount Rate Flag"
                badge={
                  discountFlagHot ? (
                    <span className="text-[10px] font-mono uppercase bg-amber text-ink px-1.5 py-0.5">shifted</span>
                  ) : null
                }
              >
                <Markdown text={discountFlagBody || "Section not found in output."} />
              </Collapsible>
            </>
          )}

          {companyKey && (
            <NotesField storageKey={KEYS.companyNotes(companyKey)} label="Your Thesis Notes" />
          )}

          {!result && !loading && !error && (
            <div className="border border-edge bg-panel px-3 py-6 text-center">
              <p className="font-mono text-sm text-faint">
                Run a query or select a watchlist company to load its latest research.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
