import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'web');

function envValue(name) {
  try {
    const text = readFileSync(path.join(root, '.env'), 'utf8');
    for (const line of text.split('\n')) {
      if (line.startsWith(`${name}=`)) return line.slice(name.length + 1).trim();
    }
  } catch {
    return '';
  }
  return '';
}

await rm(output, { recursive: true, force: true });

const child = spawn(
  'npx',
  ['expo', 'export', '--platform', 'web', '--output-dir', 'web', '--clear'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_GROUP_API_SAME_ORIGIN: '1',
      EXPO_PUBLIC_TMDB_PROXY: '1',
      EXPO_PUBLIC_TMDB_API_KEY: '',
      EXPO_PUBLIC_GROUP_API_URL: '',
    },
  },
);

const code = await new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('exit', resolve);
});
if (code !== 0) process.exit(code ?? 1);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

const files = await walk(output);
for (const file of files) {
  if (file.endsWith('.map')) await rm(file);
}

const secret = envValue('EXPO_PUBLIC_TMDB_API_KEY');
if (secret) {
  const remaining = await walk(output);
  for (const file of remaining) {
    const text = await readFile(file);
    if (text.includes(Buffer.from(secret))) {
      console.error('The web export contains the TMDB key. Refusing to keep it.');
      await rm(output, { recursive: true, force: true });
      process.exit(1);
    }
  }
}

console.log(`Exported ${files.length} web files to web/`);
