#!/usr/bin/env node
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  rmSync,
  existsSync,
  readdirSync,
  statSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname, basename } from 'node:path';

const packageRoot = process.cwd();
const tempRoot = join(packageRoot, 'build-temp');
const distRoot = join(packageRoot, 'dist');

const require = createRequire(import.meta.url);
let tscPath;
try {
  tscPath = require.resolve('typescript/bin/tsc');
} catch (error) {
  console.error('Unable to locate the TypeScript compiler (tsc).');
  console.error('Please ensure "typescript" is installed in this workspace.');
  process.exit(1);
}

const configs = [
  'tsconfig.build.esm.json',
  'tsconfig.build.cjs.json',
  'tsconfig.build.types.json',
];

for (const config of configs) {
  const absolute = join(packageRoot, config);
  if (!existsSync(absolute)) {
    console.error(`Missing required build config: ${config}`);
    process.exit(1);
  }
}

function runTsc(config) {
  const result = spawnSync(process.execPath, [tscPath, '-p', config], {
    cwd: packageRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function cleanDirectory(path) {
  rmSync(path, { recursive: true, force: true });
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function copyCommonJs() {
  const src = join(tempRoot, 'cjs');
  copyDirRecursive(src, distRoot);
}

function copyDirRecursive(src, dest, prefix = '') {
  if (!existsSync(src)) {
    return;
  }

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const rel = prefix ? join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dest, rel);
    } else if (entry.isFile()) {
      const destPath = join(dest, rel);
      ensureDir(dirname(destPath));
      copyFileSync(srcPath, destPath);
    }
  }
}

function copyEsm() {
  const src = join(tempRoot, 'esm');
  if (!existsSync(src)) {
    return;
  }

  const stack = [[src, '']];
  while (stack.length > 0) {
    const [current, relDir] = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const srcPath = join(current, entry.name);
      const nextRelDir = relDir ? join(relDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        stack.push([srcPath, nextRelDir]);
        continue;
      }

      const ext = entry.name.endsWith('.js.map') ? '.js.map' : entry.name.endsWith('.js') ? '.js' : null;
      let targetName = entry.name;
      if (ext === '.js') {
        targetName = entry.name.slice(0, -3) + '.mjs';
      } else if (ext === '.js.map') {
        targetName = entry.name.slice(0, -7) + '.mjs.map';
      }

      const relativePath = relDir ? join(relDir, targetName) : targetName;
      const destPath = join(distRoot, relativePath);
      ensureDir(dirname(destPath));
      copyFileSync(srcPath, destPath);

      if (ext === '.js') {
        const fileBase = basename(destPath, '.mjs');
        let content = readFileSync(destPath, 'utf8');
        content = content.replace(`sourceMappingURL=${fileBase}.js.map`, `sourceMappingURL=${fileBase}.mjs.map`);
        writeFileSync(destPath, content);
      } else if (ext === '.js.map') {
        const mapContent = readFileSync(destPath, 'utf8');
        try {
          const map = JSON.parse(mapContent);
          if (typeof map.file === 'string' && map.file.endsWith('.js')) {
            map.file = map.file.slice(0, -3) + '.mjs';
          }
          writeFileSync(destPath, JSON.stringify(map, null, 2) + '\n');
        } catch (error) {
          console.warn(`Failed to parse source map ${destPath}:`, error);
        }
      }
    }
  }
}

function copyTypes() {
  const src = join(tempRoot, 'types');
  copyDirRecursive(src, distRoot);

  if (!existsSync(src)) {
    return;
  }

  const queue = [[src, '']];
  while (queue.length > 0) {
    const [current, relDir] = queue.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const srcPath = join(current, entry.name);
      const nextRel = relDir ? join(relDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        queue.push([srcPath, nextRel]);
        continue;
      }

      if (entry.name.endsWith('.d.ts')) {
        const destTsPath = join(distRoot, relDir ? join(relDir, entry.name) : entry.name);
        if (!existsSync(destTsPath)) {
          continue;
        }
        const destMtsPath = destTsPath.slice(0, -'.d.ts'.length) + '.d.mts';
        const tsContent = readFileSync(destTsPath, 'utf8');
        const mtsContent = tsContent.replace(/sourceMappingURL=(.+?)\.d\.ts\.map/g, 'sourceMappingURL=$1.d.mts.map');
        writeFileSync(destMtsPath, mtsContent);
      } else if (entry.name.endsWith('.d.ts.map')) {
        const destTsMapPath = join(distRoot, relDir ? join(relDir, entry.name) : entry.name);
        if (!existsSync(destTsMapPath)) {
          continue;
        }
        const tsMapContent = readFileSync(destTsMapPath, 'utf8');
        try {
          const map = JSON.parse(tsMapContent);
          writeFileSync(destTsMapPath, JSON.stringify(map, null, 2) + '\n');
          const mtsMap = { ...map };
          if (typeof mtsMap.file === 'string' && mtsMap.file.endsWith('.d.ts')) {
            mtsMap.file = mtsMap.file.slice(0, -'.d.ts'.length) + '.d.mts';
          }
          const destMtsMapPath = destTsMapPath.slice(0, -'.d.ts.map'.length) + '.d.mts.map';
          writeFileSync(destMtsMapPath, JSON.stringify(mtsMap, null, 2) + '\n');
        } catch (error) {
          console.warn(`Failed to parse declaration map ${destTsMapPath}:`, error);
        }
      }
    }
  }
}

try {
  cleanDirectory(tempRoot);
  cleanDirectory(distRoot);

  for (const config of configs) {
    runTsc(config);
  }

  ensureDir(distRoot);

  copyCommonJs();
  copyEsm();
  copyTypes();
} finally {
  cleanDirectory(tempRoot);
}
