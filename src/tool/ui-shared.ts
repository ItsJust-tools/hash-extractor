import { DEFAULT_STATE, MAX_HISTORY } from './types';

export const MODES: { value: string; label: string; hint: string }[] = [
  { value: 'scan', label: 'Scan', hint: 'paste text and detect hashes' },
  { value: 'review', label: 'Review', hint: 'filter, label, and export detected hashes' },
];

export function summaryText(state = DEFAULT_STATE): string {
  const total = state.entries.length;
  const visible = state.entries.filter((e) => matchesFilter(e, state.filter)).length;
  const families = new Set(state.entries.map((e) => e.algorithm)).size;
  return `${visible}/${total} hashes · ${families} families`;
}

function matchesFilter(
  entry: { hash: string; label: string; algorithm: string },
  filter: string
): boolean {
  if (!filter) return true;
  const f = filter.toLowerCase();
  return (
    entry.hash.toLowerCase().includes(f) ||
    entry.label.toLowerCase().includes(f) ||
    entry.algorithm.toLowerCase().includes(f)
  );
}

export function historyText(state = DEFAULT_STATE): string {
  return state.history.map((h) => h.text).join('; ');
}

export { DEFAULT_STATE, MAX_HISTORY };
