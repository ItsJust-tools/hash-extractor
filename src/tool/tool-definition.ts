import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  MAX_HISTORY,
  isState,
  type ScanExportFormat,
  type HashEntry,
  type HashExtractorState,
  type HistoryEntry,
} from './types';

const VALID_SORTS: HashExtractorState['sortBy'][] = ['firstSeen', 'length', 'algorithm'];
const VALID_EXPORTS: ScanExportFormat[] = ['json', 'csv', 'list'];

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function validEntry(value: unknown): HashEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Partial<HashEntry>;
  if (typeof v.hash !== 'string' || typeof v.algorithm !== 'string') return null;
  const confidence =
    typeof v.confidence === 'number' && Number.isFinite(v.confidence)
      ? Math.max(0, Math.min(100, Math.round(v.confidence)))
      : 0;
  const firstSeen =
    typeof v.firstSeen === 'number' && Number.isInteger(v.firstSeen) ? v.firstSeen : 0;
  return {
    id: stringOr(v.id, `${v.hash}::${firstSeen}`),
    hash: v.hash,
    algorithm: v.algorithm,
    confidence,
    description: stringOr(v.description, ''),
    label: stringOr(v.label, ''),
    firstSeen,
  };
}

function validEntries(value: unknown): HashEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map(validEntry).filter((e): e is HashEntry => e !== null);
}

function validLabels(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function validHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is HistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as HistoryEntry).text === 'string' &&
        typeof (entry as HistoryEntry).createdAt === 'string'
    )
    .slice(0, MAX_HISTORY);
}

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: HashExtractorState): string {
  return JSON.stringify(state);
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<HashExtractorState> {
  if (!isState(data)) {
    return { success: false, error: 'Invalid data format: expected hash extractor state object' };
  }
  const v = data as Partial<HashExtractorState>;
  const sortBy = VALID_SORTS.includes(v.sortBy as HashExtractorState['sortBy'])
    ? (v.sortBy as HashExtractorState['sortBy'])
    : DEFAULT_STATE.sortBy;
  const exportFormat = VALID_EXPORTS.includes(v.exportFormat as ScanExportFormat)
    ? (v.exportFormat as ScanExportFormat)
    : DEFAULT_STATE.exportFormat;
  const state: HashExtractorState = {
    sourceText: stringOr(v.sourceText, ''),
    entries: validEntries(v.entries),
    labels: validLabels(v.labels),
    filter: stringOr(v.filter, ''),
    sortBy,
    dedupe: typeof v.dedupe === 'boolean' ? v.dedupe : DEFAULT_STATE.dedupe,
    exportFormat,
    history: validHistory(v.history),
  };
  return { success: true, data: state };
}

/** Append a history entry to state, capped at MAX_HISTORY, newest first. */
export function withHistory(
  state: HashExtractorState,
  text: string,
  now = new Date()
): HashExtractorState {
  const entry: HistoryEntry = { text, createdAt: now.toISOString() };
  return { ...state, history: [entry, ...state.history].slice(0, MAX_HISTORY) };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: HashExtractorState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

const validRegex = /[\r\n"\\]|\0/;

function csvCell(value: string): string {
  if (validRegex.test(value)) return `"${value.replace(/"/g, '""')}"`;
  if (value.includes(',')) return `"${value}"`;
  return value;
}

/** Render the given entries as export text in the selected format. */
export function exportEntries(entries: HashEntry[], format: ScanExportFormat = 'json'): string {
  if (format === 'list') {
    return entries.map((e) => e.hash).join('\n');
  }
  if (format === 'csv') {
    const header = 'hash,algorithm,confidence,label,firstSeen';
    const rows = entries.map((e) =>
      [
        csvCell(e.hash),
        csvCell(e.algorithm),
        String(e.confidence),
        csvCell(e.label),
        String(e.firstSeen),
      ].join(',')
    );
    return [header, ...rows].join('\n');
  }
  return JSON.stringify(
    entries.map((e) => ({
      hash: e.hash,
      algorithm: e.algorithm,
      confidence: e.confidence,
      label: e.label,
      firstSeen: e.firstSeen,
    })),
    null,
    2
  );
}

/** Merge a user label into state.labels, keyed by exact hash string. */
export function setLabel(
  state: HashExtractorState,
  hash: string,
  label: string
): HashExtractorState {
  const labels = { ...state.labels };
  if (label) labels[hash] = label;
  else delete labels[hash];
  return {
    ...state,
    labels,
    entries: state.entries.map((e) => (e.hash === hash ? { ...e, label } : e)),
  };
}

/** Toggle dedupe: when on, identical hash values merge and their labels aggregate (first label kept). */
export function applyDedupe(entries: HashEntry[], dedupe: boolean): HashEntry[] {
  if (!dedupe) {
    return entries;
  }
  const byHash = new Map<string, HashEntry>();
  const firstLabelByHash = new Map<string, string>();
  const ordered: HashEntry[] = [];
  for (const e of entries) {
    const existing = byHash.get(e.hash);
    if (!existing) {
      byHash.set(e.hash, { ...e });
      if (e.label) firstLabelByHash.set(e.hash, e.label);
      ordered.push(byHash.get(e.hash)!);
    } else {
      if (e.confidence > existing.confidence) {
        existing.confidence = e.confidence;
        existing.algorithm = e.algorithm;
        existing.description = e.description;
      }
    }
  }
  for (const e of ordered) {
    e.label = firstLabelByHash.get(e.hash) ?? '';
  }
  return ordered;
}

/** Scan source text, producing entries (dedupe applied as configured) with remembered labels. */
export function scanText(state: HashExtractorState, text: string): HashExtractorState {
  const { extractCandidates, classifyHash, entryId } = typesLazy;
  const seen = new Set<string>();
  const entries: HashEntry[] = [];
  const candidates = extractCandidates(text);
  let order = 0;
  for (const token of candidates) {
    const result = classifyHash(token);
    if (!result) continue;
    const id = entryId(token, order);
    if (!seen.has(id)) {
      seen.add(id);
      entries.push({
        id,
        hash: token,
        algorithm: result.algorithm,
        confidence: result.confidence,
        description: result.description,
        label: state.labels[token] ?? '',
        firstSeen: order,
      });
    }
    order += 1;
  }
  return { ...state, sourceText: text, entries: applyDedupe(entries, state.dedupe) };
}

// Late-bound import to avoid a circular import between types and tool-definition.
import * as typesLazy from './types';

export const hashExtractorTool: Tool<HashExtractorState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};
