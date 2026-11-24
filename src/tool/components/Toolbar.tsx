'use client';

import React from 'react';
import type { HashExtractorState } from '../types';

interface ToolbarProps {
  state: HashExtractorState;
  onChange: (next: HashExtractorState) => void;
  onClear: () => void;
  onCopy?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ state, onChange, onClear, onCopy }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Hash extractor controls"
      >
        <label className="flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={state.dedupe}
            onChange={(e) => onChange({ ...state, dedupe: e.target.checked })}
            data-testid="toggle-dedupe"
          />
          Dedupe
        </label>
        <input
          type="text"
          placeholder="Search hashes…"
          value={state.filter}
          onChange={(e) => onChange({ ...state, filter: e.target.value })}
          data-testid="filter-input"
          className="w-44 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <select
          value={state.sortBy}
          onChange={(e) =>
            onChange({ ...state, sortBy: e.target.value as HashExtractorState['sortBy'] })
          }
          data-testid="sort-select"
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          aria-label="Sort by"
        >
          <option value="firstSeen">First seen</option>
          <option value="length">Length</option>
          <option value="algorithm">Algorithm</option>
        </select>
        <select
          value={state.exportFormat}
          onChange={(e) =>
            onChange({
              ...state,
              exportFormat: e.target.value as HashExtractorState['exportFormat'],
            })
          }
          data-testid="export-format"
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          aria-label="Export format"
        >
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
          <option value="list">Plain list</option>
        </select>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            data-testid="btn-copy-result"
            className="rounded-md bg-violet-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
          >
            Copy filtered list
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClear}
          data-testid="btn-clear"
          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear
        </button>
        {state.history.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange({ ...state, history: [] })}
            data-testid="btn-clear-history"
            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Clear history
          </button>
        ) : null}
      </div>
    </div>
  );
};
