import type { ExportFormat } from '@itsjust/core';

export const toolConfig = {
  id: 'hash-extractor',
  name: 'Hash Extractor',
  version: '1.0.0',
  category: 'Developer',
  description:
    'Extract, label, and classify password/API hashes (MD5, SHA-1, SHA-2, SHA-3, bcrypt, scrypt, argon2, NTLM, MySQL, JWT) from any pasted text or file dump.',
  features: {
    sidebar: true,
    export: true,
    autoSave: true,
    undoRedo: true,
    statusBar: true,
    darkMode: true,
  },
  exportFormats: ['png', 'jpeg', 'webp', 'pdf', 'json'] satisfies ExportFormat[],
  theme: {
    brand: 'Hash Extractor',
  },
};

export default toolConfig;
