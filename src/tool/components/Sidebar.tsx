'use client';

import React from 'react';
import { MODES, summaryText } from '../ui-shared';
import type { HashExtractorState } from '../types';

interface SidebarProps {
  state: HashExtractorState;
  onChange: (next: HashExtractorState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state }) => {
  return (
    <div
      className="h-full space-y-6 overflow-y-auto p-4 text-sm"
      data-testid="hash-extractor-sidebar"
    >
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Modes</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {MODES.map((mode) => (
            <li key={mode.value} className="flex justify-between gap-2">
              <span>{mode.label}</span>
              <span className="text-gray-500 dark:text-gray-400">{mode.hint}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Summary</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-summary">
          {summaryText(state)}
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">History</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-history-count">
          {state.history.length} entr{state.history.length === 1 ? 'y' : 'ies'} in history
          {state.history.length > 0 ? ' (newest first)' : ''}
        </p>
        <ul className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
          {state.history.slice(0, 5).map((h, i) => (
            <li key={`${h.createdAt}-${i}`} className="truncate">
              {h.text}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Privacy</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          All scanning and classification runs entirely in your browser. Nothing is uploaded or
          shared.
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Keyboard shortcuts</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            <kbd>Ctrl/Cmd+F</kbd> — focus the filter/search box
          </li>
          <li>
            <kbd>Ctrl/Cmd+Enter</kbd> — run the scan
          </li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Labels</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Labels are keyed by exact hash value and persist across rescans. Clearing a label removes
          it from remembered values.
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
