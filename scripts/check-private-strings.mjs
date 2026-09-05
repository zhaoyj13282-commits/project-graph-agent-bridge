import { readdir, readFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const patterns = JSON.parse(process.env.BRIDGE_PRIVATE_PATTERNS ?? '[]');
if (!Array.isArray(patterns) || !patterns.length)
  throw Error('Supply private strings via BRIDGE_PRIVATE_PATTERNS; values are never printed.');
const needles = patterns
  .flatMap((p) => [p, p.replaceAll('\\', '/'), p.replaceAll('\\', '\\\\')])
  .flatMap((p) => [Buffer.from(p, 'utf8'), Buffer.from(p, 'utf16le')]);
let count = 0;
const failures = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile()) {
      count++;
      const bytes = await readFile(path);
      if (needles.some((n) => bytes.includes(n))) failures.push(relative(root, path));
    }
  }
}
await walk(root);
console.log(JSON.stringify({ filesScanned: count, filesWithPrivateStrings: failures }));
if (failures.length) process.exitCode = 1;
