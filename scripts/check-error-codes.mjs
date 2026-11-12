#!/usr/bin/env node
// Verifies the error catalogs of all packages: a conduitCode may appear in more than
// one catalog only when every definition agrees on its gRPC status and message, i.e.
// when it really is the same error.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogs = [];
for (const group of ['modules', 'packages']) {
  for (const name of readdirSync(join(root, group))) {
    const file = join(root, group, name, 'src', 'errors.ts');
    if (existsSync(file)) catalogs.push({ owner: name, file });
  }
}
catalogs.push({
  owner: 'module-tools',
  file: join(root, 'libraries/module-tools/src/utilities/authErrors.ts'),
});

const ENTRY = /^ {2}([A-Z][A-Z0-9_]*): \{([\s\S]*?)^ {2}\},?$/gm;
const seen = new Map();
const problems = [];
let total = 0;
for (const { owner, file } of catalogs) {
  const source = readFileSync(file, 'utf8');
  for (const [, code, body] of source.matchAll(ENTRY)) {
    total++;
    const grpcCode = /grpcCode:\s*status\.([A-Z_]+)/.exec(body)?.[1];
    const message = /message:\s*(['"`])([\s\S]*?)\1/.exec(body)?.[2];
    const explicit = /conduitCode:\s*'([^']+)'/.exec(body)?.[1];
    if (!grpcCode) problems.push(`${owner}: ${code} has no grpcCode`);
    if (!/description:/.test(body)) problems.push(`${owner}: ${code} has no description`);
    if (explicit && explicit !== code) {
      problems.push(`${owner}: key ${code} declares conduitCode ${explicit}`);
    }
    const previous = seen.get(code);
    if (previous && (previous.grpcCode !== grpcCode || previous.message !== message)) {
      problems.push(
        `${code} is defined differently in ${previous.owner} and ${owner}; rename one or make them identical`,
      );
    }
    if (!previous) seen.set(code, { owner, grpcCode, message });
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(
  `${total} error definitions in ${catalogs.length} catalogs, ${seen.size} codes`,
);
