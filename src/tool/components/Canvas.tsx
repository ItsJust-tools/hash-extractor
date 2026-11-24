'use client';

import React from 'react';
import type { HashEntry, HashExtractorState } from '../types';

interface CanvasProps {
  state: HashExtractorState;
  onChange?: (state: HashExtractorState) => void;
  onSaveHistory?: (text: string) => void;
  onScan?: () => void;
  onReset?: () => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
      aria-label="Copy hash"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function visibleEntries(state: HashExtractorState): HashEntry[] {
  const f = state.filter.toLowerCase();
  const filtered = state.entries.filter(
    (e) =>
      !f ||
      e.hash.toLowerCase().includes(f) ||
      e.label.toLowerCase().includes(f) ||
      e.algorithm.toLowerCase().includes(f)
  );
  const sorted = [...filtered];
  if (state.sortBy === 'length')
    sorted.sort((a, b) => a.hash.length - b.hash.length || a.firstSeen - b.firstSeen);
  else if (state.sortBy === 'algorithm')
    sorted.sort((a, b) => a.algorithm.localeCompare(b.algorithm) || a.firstSeen - b.firstSeen);
  else sorted.sort((a, b) => a.firstSeen - b.firstSeen);
  return sorted;
}

export const Canvas: React.FC<CanvasProps> = ({
  state,
  onChange,
  onSaveHistory,
  onScan,
  onReset,
}) => {
  const [showingResults, setShowingResults] = React.useState(false);
  const visible = visibleEntries(state);

  const families = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of state.entries) counts.set(e.algorithm, (counts.get(e.algorithm) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [state.entries]);

  const triggerScan = React.useCallback(() => {
    if (onScan) {
      onScan();
      setShowingResults(true);
      if (onSaveHistory) onSaveHistory(`Scanned ${state.sourceText.length} characters`);
    }
  }, [onScan, onSaveHistory, state.sourceText]);

  const handleLabel = (hash: string, label: string) => {
    if (!onChange) return;
    const labels = { ...state.labels };
    if (label) labels[hash] = label;
    else delete labels[hash];
    onChange({
      ...state,
      labels,
      entries: state.entries.map((e) => (e.hash === hash ? { ...e, label } : e)),
    });
  };

  return (
    <div className="p-4" data-testid="hash-extractor-canvas">
      <textarea
        value={state.sourceText}
        onChange={(e) =>
          onChange && onChange({ ...state, sourceText: e.target.value, entries: [] })
        }
        placeholder="Paste text or a file dump to scan for hashes…"
        data-testid="source-text"
        className={inputClass + ' min-h-40 font-mono'}
        aria-label="Source text"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={triggerScan}
          data-testid="btn-scan"
          className="rounded-md bg-violet-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-600"
        >
          Scan
        </button>
        <button
          type="button"
          onClick={() => {
            setShowingResults(false);
            onReset?.();
          }}
          data-testid="btn-reset"
          className="rounded-md bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Reset
        </button>
      </div>

      {families.length > 0 ? (
        <div
          className="mt-4 rounded-md border border-gray-200 p-3 dark:border-gray-800"
          data-testid="summary-panel"
        >
          <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            Summary — {state.entries.length} hashes, {state.sourceText.length} characters scanned
          </h3>
          <ul className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
            {families.map(([algo, count]) => (
              <li key={algo} data-testid={`summary-${algo}`}>
                {algo}: {count}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(showingResults || state.entries.length > 0) && (
        <div className="mt-4 space-y-2" data-testid="results-list">
          {visible.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400" data-testid="no-results">
              No hashes match the current filter.
            </p>
          ) : (
            visible.map((e) => (
              <div
                key={e.id}
                data-testid="result-row"
                className="rounded-md border border-gray-200 p-3 dark:border-gray-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs break-all text-gray-900 dark:text-gray-100">
                      {e.hash}
                    </p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      <strong>{e.algorithm}</strong> · {e.confidence}% confidence · {e.description}
                      {e.label ? ` · ${e.label}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyButton value={e.hash} />
                  </div>
                </div>
                {onChange ? (
                  <input
                    type="text"
                    placeholder="Add a label…"
                    value={e.label}
                    onChange={(ev) => handleLabel(e.hash, ev.target.value)}
                    data-testid={`label-input-${e.firstSeen}`}
                    className={inputClass + ' mt-2 text-xs'}
                    aria-label="Hash label"
                  />
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
