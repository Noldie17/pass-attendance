#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const releaseDir = path.resolve(projectDir, '..');
const version = JSON.parse(await readFile(path.join(projectDir, 'package.json'), 'utf8')).version;
const installerDir = path.resolve(process.cwd(), process.argv[2] ?? './release');
let files = [];
try {
  files = (await readdir(installerDir, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.exe'))
    .map(entry => entry.name).sort();
} catch {
  // An absent or empty artifact folder is reported by the same explicit guard below.
}
if (files.length === 0) {
  console.error(`No installer found: no .exe files in "${installerDir}". Download the GitHub Actions installer artifacts into the project release folder and retry.`);
  console.error('No Complete ZIP was created.');
  process.exit(1);
}
const installerTarget = path.join(releaseDir, '01_Installer');
await mkdir(installerTarget, { recursive: true });
const records = [];
let setupWritten = false, portableWritten = false, extra = 0;
for (const sourceName of files) {
  const lower = sourceName.toLowerCase();
  let targetName;
  if (lower.includes('portable') && !portableWritten) {
    targetName = `PASS-Portable-${version}.exe`; portableWritten = true;
  } else if (!lower.includes('portable') && !setupWritten && (lower.includes('nsis') || lower.includes('setup') || files.filter(n => !n.toLowerCase().includes('portable')).length === 1)) {
    targetName = `PASS-Setup-${version}.exe`; setupWritten = true;
  } else {
    targetName = `PASS-Artifact-${++extra}-${version}.exe`;
  }
  const targetPath = path.join(installerTarget, targetName);
  await copyFile(path.join(installerDir, sourceName), targetPath);
  const hash = createHash('sha256').update(await readFile(targetPath)).digest('hex');
  records.push(`${hash}  ${targetName}`);
}
await writeFile(path.join(installerTarget, 'CHECKSUMS.txt'), records.join('\n') + '\n', 'utf8');
const completeZip = path.join(path.dirname(releaseDir), `${path.basename(releaseDir)}_Complete.zip`);
const archiveBase = path.dirname(releaseDir);
let result;
if (process.platform === 'win32') {
  result = spawnSync('tar.exe', ['-a', '-cf', completeZip, '-C', archiveBase, path.basename(releaseDir)], { stdio: 'inherit' });
} else {
  result = spawnSync('zip', ['-rq', completeZip, path.basename(releaseDir)], { cwd: archiveBase, stdio: 'inherit' });
}
if (result.error || result.status !== 0) {
  console.error(`Archive creation failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status})`}.`);
  process.exit(result.status || 1);
}
console.log('PASS release assembly complete');
console.log(`Version: ${version}`);
console.log(`Installer artifacts copied: ${records.length}`);
for (const record of records) console.log(record);
console.log(`Complete ZIP: ${completeZip}`);
