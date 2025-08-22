import * as fs from 'fs';
import * as path from 'path';

export function getVersion(): string {
  try {
    const packagePath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    return packageJson.version;
  } catch {
    return '0.1.0';
  }
}