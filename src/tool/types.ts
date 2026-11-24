export type Mode = 'scan' | 'review';

export interface HashEntry {
  /** Unique id for this entry (stable per source hash + occurrence). */
  id: string;
  /** The detected hash-like string. */
  hash: string;
  /** Best-guess algorithm family, e.g. MD5, bcrypt, JWT. */
  algorithm: string;
  /** Confidence bucket for the classification, 0-100. */
  confidence: number;
  /** Short description of what this hash format is and where it is used. */
  description: string;
  /** Optional user label (source / context). */
  label: string;
  /** First-seen order in the source text (0-based). */
  firstSeen: number;
}

export type ScanExportFormat = 'json' | 'csv' | 'list';

export interface HistoryEntry {
  /** Short human readable description of the entry. */
  text: string;
  /** ISO timestamp when the entry was saved. */
  createdAt: string;
}

export interface HashExtractorState {
  /** Raw text scanned by the tool. */
  sourceText: string;
  /** Detected entries, newest scan replaces the list unless labels merge. */
  entries: HashEntry[];
  /** User-editable label keyed by exact hash string; survives edits/rescans. */
  labels: Record<string, string>;
  /** Search/filter substring over hash and label. */
  filter: string;
  /** Sort key for display. */
  sortBy: 'firstSeen' | 'length' | 'algorithm';
  /** Deduplicate identical hash values and merge labels when true. */
  dedupe: boolean;
  /** Export format used for the filtered list. */
  exportFormat: ScanExportFormat;
  /** Saved history, newest first. */
  history: HistoryEntry[];
}

export const DEFAULT_STATE: HashExtractorState = {
  sourceText: '',
  entries: [],
  labels: {},
  filter: '',
  sortBy: 'firstSeen',
  dedupe: true,
  exportFormat: 'json',
  history: [],
};

export const MAX_HISTORY = 20;

/** Classify a single candidate token. Returns null when not a confidence-worthy hash. */
export function classifyHash(
  token: string
): { algorithm: string; confidence: number; description: string } | null {
  const t = token.trim();

  // JWT: header.payload.signature (base64url segments)
  if (/^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}$/.test(t)) {
    return {
      algorithm: 'JWT',
      confidence: 95,
      description:
        'JSON Web Token: base64url header.payload.signature, used for stateless API auth.',
    };
  }

  // Argon2 encoded form
  if (/^\$argon2(id|i|d)\$/.test(t)) {
    return {
      algorithm: 'Argon2',
      confidence: 99,
      description:
        'Argon2 (PHC string format): modern memory-hard password hashing, used in new applications.',
    };
  }

  // bcrypt
  if (/^\$2[abxy]?\$/.test(t)) {
    return {
      algorithm: 'bcrypt',
      confidence: 99,
      description:
        'bcrypt: adaptive password hash with cost factor, common in web apps and databases.',
    };
  }

  // scrypt PHC form
  if (/^\$scrypt\$/.test(t)) {
    return {
      algorithm: 'scrypt',
      confidence: 99,
      description: 'scrypt (PHC string format): memory-hard KDF, used for password storage.',
    };
  }

  // PBKDF2 PHC form
  if (/^\$pbkdf2(-sha\d+)?\$/.test(t)) {
    return {
      algorithm: 'PBKDF2',
      confidence: 99,
      description: 'PBKDF2 (PHC string format): iterated key derivation for password storage.',
    };
  }

  // PHPass (portable, WordPress)
  if (/^\$P\$[A-Za-z0-9./]{27,}/.test(t)) {
    return {
      algorithm: 'PHPASS',
      confidence: 97,
      description: 'PHPass portable hash: used by WordPress and some PHP apps.',
    };
  }

  // LDAP / SHA crypt variants
  if (/^\{(SSHA256|SSHA512|SSHA|SHA|SMD5|MD5)\}/i.test(t)) {
    return {
      algorithm: 'LDAP',
      confidence: 99,
      description: 'LDAP salted/digest password format ({SSHA} etc.), used in LDAP directories.',
    };
  }

  // SHA-1 PHC form
  if (/^\$sha1\$/.test(t)) {
    return {
      algorithm: 'SHA-1',
      confidence: 98,
      description: 'SHA-1 (PHC string format): deprecated digest, legacy password storage.',
    };
  }

  // PHC generic: unknown id
  if (/^\$[a-z0-9-]+\$[=A-Za-z0-9./+-]*\$?[A-Za-z0-9./+]+\$?/i.test(t)) {
    return {
      algorithm: 'Other',
      confidence: 90,
      description: 'PHC-formatted hash with a non-standard or uncommon algorithm identifier.',
    };
  }

  // bcrypt $2a$ etc done; crypt MD5 $1$
  if (/^\$1\$[A-Za-z0-9./]{8}\$[A-Za-z0-9./]{22}$/.test(t)) {
    return {
      algorithm: 'MD5',
      confidence: 95,
      description: 'MD5 crypt (glibc/FreeBSD $1$ salted): legacy Unix password hash.',
    };
  }

  // SHA-256 crypt $5$
  if (/^\$5\$[A-Za-z0-9./]{8,16}\$[A-Za-z0-9./]{43,86}$/.test(t)) {
    return {
      algorithm: 'SHA-256',
      confidence: 95,
      description: 'SHA-256 crypt ($5$ salted, with rounds): Linux shadow password hash.',
    };
  }

  // SHA-512 crypt $6$
  if (/^\$6\$[A-Za-z0-9./]{8,16}\$[A-Za-z0-9./]{86,}$/.test(t)) {
    return {
      algorithm: 'SHA-512',
      confidence: 95,
      description: 'SHA-512 crypt ($6$ salted, with rounds): Linux shadow password hash.',
    };
  }

  // Juniper/other: skip

  // Cisco type 7: simple obfuscation, not a password hash per se but included

  // MSSQL 2012+ : 0x0200...
  if (/^0x0200[A-Fa-f0-9]{128}$/.test(t)) {
    return {
      algorithm: 'MSSQL',
      confidence: 90,
      description: 'Microsoft SQL Server 2012+ password hash (salted SHA-512, 0x0200 prefix).',
    };
  }

  // MySQL 4.1 / MySQL 5: 16-byte hex uppercase
  if (/^\*[A-F0-9]{40}$/.test(t)) {
    return {
      algorithm: 'MySQL',
      confidence: 90,
      description:
        'MySQL 4.1+/5.x password hash (SHA-1 double, * prefix), used in mysql.user tables.',
    };
  }

  // NTLM: 32 hex chars, typically from SAM/pwdump or ntlm-style lists
  if (/^[A-Fa-f0-9]{32}$/.test(t)) {
    return {
      algorithm: 'NTLM',
      confidence: 85,
      description:
        'NTLM / MD4-based Windows password hash (or generic MD5 digest of a short string).',
    };
  }

  // SHA-512 hex
  if (/^[A-Fa-f0-9]{128}$/.test(t))
    return {
      algorithm: 'SHA-512',
      confidence: 95,
      description:
        'SHA-512 digest: long 128-char hex, used for file integrity and legacy password storage.',
    };
  // SHA-384 hex
  if (/^[A-Fa-f0-9]{96}$/.test(t))
    return {
      algorithm: 'SHA-384',
      confidence: 90,
      description: 'SHA-384 digest: 96-char hex, truncated SHA-512, used in some protocols.',
    };
  // SHA-256 hex
  if (/^[A-Fa-f0-9]{64}$/.test(t))
    return {
      algorithm: 'SHA-256',
      confidence: 95,
      description: 'SHA-256 digest: 64-char hex, very common for integrity and key derivation.',
    };
  // SHA-224
  if (/^[A-Fa-f0-9]{56}$/.test(t))
    return {
      algorithm: 'SHA-224',
      confidence: 85,
      description: 'SHA-224 digest: 56-char hex, rare truncated SHA-2 variant.',
    };
  // SHA-1 hex
  if (/^[A-Fa-f0-9]{40}$/.test(t))
    return {
      algorithm: 'SHA-1',
      confidence: 90,
      description:
        'SHA-1 digest: 40-char hex, deprecated but still seen in legacy systems and git object ids.',
    };
  // RIPEMD-160 is also 40 hex; low confidence distinction
  // MD5 hex
  if (/^[A-Fa-f0-9]{32}$/.test(t)) {
    // Already handled above by NTLM branch (first match wins).
    return {
      algorithm: 'MD5',
      confidence: 90,
      description: 'MD5 digest: 32-char hex, legacy checksum and password hash.',
    };
  }
  // MD4 hex same length as MD5; not distinguished.

  // SHAKE128 hex is 32; not distinguished.

  // SHA3-224 (56) handled as SHA-224 (indistinguishable by length alone).
  // SHA3-256 (64) indistinguishable from SHA-256.
  // SHA3-384 (96) indistinguishable from SHA-384.
  // SHA3-512 (128) indistinguishable from SHA-512.

  // Base64 hex-style not supported.

  return null;
}

/** Extract candidate hash-like tokens from free text. */
export function extractCandidates(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const patterns = [
    /\{(?:SSHA256|SSHA512|SSHA|SHA|SMD5|MD5)\}[^"',\s<>]+/gi,
    /\$argon2(?:id|i|d)\$[^"',\s<>]+/gi,
    /\$2[abxy]?\$[^"',\s<>]+/gi,
    /\$scrypt\$[^"',\s<>]+/gi,
    /\$pbkdf2(?:-sha\d+)?\$[^"',\s<>]+/gi,
    /\$P\$[A-Za-z0-9./]+/g,
    /\$sha1\$[^"',\s<>]+/gi,
    /\$1\$[A-Za-z0-9./]{8}\$[A-Za-z0-9./]{22}/g,
    /\$5\$[A-Za-z0-9./]{8,16}\$[A-Za-z0-9./]{43,86}/g,
    /\$6\$[A-Za-z0-9./]{8,16}\$[A-Za-z0-9./]{86,}/g,
    /0x0200[A-Fa-f0-9]{128}/g,
    /\*[A-F0-9]{40}/g,
    /(?<![A-Fa-f0-9])[A-Fa-f0-9]{96,128}(?![A-Fa-f0-9])/g, // sha-384/sha-512
    /(?<![A-Fa-f0-9])[A-Fa-f0-9]{64}(?![A-Fa-f0-9])/g, // sha-256
    /(?<![A-Fa-f0-9])[A-Fa-f0-9]{56}(?![A-Fa-f0-9])/g, // sha-224
    /(?<![A-Fa-f0-9])[A-Fa-f0-9]{40}(?![A-Fa-f0-9])/g, // sha-1
    /(?<![A-Fa-f0-9])[A-Fa-f0-9]{32}(?![A-Fa-f0-9])/g, // md5/ntlm
    /[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}/g, // JWT
  ];

  const found: string[] = [];
  for (const re of patterns) {
    const matches = text.match(re);
    if (matches) found.push(...matches);
  }
  return found;
}

/** Build a unique id for an entry occurrence. */
export function entryId(hash: string, firstSeen: number): string {
  return `${hash}::${firstSeen}`;
}

/** True when the value looks like a HashExtractorState. */
export function isState(value: unknown): value is HashExtractorState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<HashExtractorState>;
  return Array.isArray(v.entries) && typeof v.labels === 'object' && v.labels !== null;
}
