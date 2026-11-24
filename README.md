# Hash Extractor

Extract, label, and classify password/API hashes from any pasted text or file dump — entirely in your browser.

**Live:** [hash-extractor.itsjust.tools](https://hash-extractor.itsjust.tools)

## Features

- Paste text or drop a file and auto-detect hash-looking strings via tuned regexes: hex of common lengths (32/40/56/64/96/128), `$1$`/`$2b$`/`$5$`/`$6$`/`$argon2$`/`$scrypt$`/`$pbkdf2$`/`$P$` prefixed patterns, `{SSHA}` LDAP envelopes, MySQL `*`-prefixed digests, MSSQL `0x0200` blobs, and bare base64 JWTs
- Classify each detected hash by algorithm family with confidence and a short description of what it is and where it is typically used
- Label each hash with a user-editable tag/source label; labels are remembered across edits and rescans
- Copy a single hash or export the full filtered list as JSON, CSV, or a plain newline list
- Summary panel with counts per algorithm family and total characters scanned
- Filter/search box over detected hashes plus sort by length, algorithm, or first-seen order
- Deduplication toggle that merges identical hash values and aggregates their labels
- All processing strictly client-side; nothing leaves the browser, and state survives page reloads via shareable URL state

## Supported families

MD5, NTLM, SHA-1, SHA-224, SHA-256, SHA-384, SHA-512, bcrypt, scrypt, argon2, PBKDF2, PHPASS, LDAP `{SSHA}` envelopes, MySQL, MSSQL, SHA-crypt (`$1$`/`$5$`/`$6$`), and JWT.

## Development

```bash
npm ci
npm run dev
npm test
npm run build
```

## License

MIT
