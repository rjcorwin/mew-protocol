// @ts-nocheck
import { Command } from 'commander';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const seacat = new Command('seacat')
  .description('Launch the Seacat multiplayer sailing game client');

seacat
  .action(async (options) => {
    console.log('🐱 Launching Seacat...\n');

    // Resolve path to seacat client
    // From dist/cli/commands/ -> dist/cli/ -> dist/ -> root/ -> clients/seacat/
    const seacatDir = path.resolve(__dirname, '../../../clients/seacat');

    // Check if seacat client exists
    if (!fs.existsSync(seacatDir)) {
      console.error('❌ Seacat client not found at:', seacatDir);
      console.error('The seacat client may not be included in this installation.');
      process.exit(1);
    }

    // Check if seacat is built
    const distDir = path.join(seacatDir, 'dist');
    if (!fs.existsSync(distDir)) {
      console.error('❌ Seacat client not built. Building now...');

      // Build seacat
      const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: seacatDir,
        stdio: 'inherit',
        shell: true
      });

      buildProcess.on('exit', (code) => {
        if (code !== 0) {
          console.error('❌ Failed to build Seacat client');
          process.exit(code || 1);
        }

        // Launch after build
        launchElectron(seacatDir);
      });
    } else {
      // Already built, just launch
      launchElectron(seacatDir);
    }
  });

function launchElectron(seacatDir: string) {
  // Try to use electron from seacat's node_modules first
  const localElectron = path.join(seacatDir, 'node_modules', '.bin', 'electron');
  const electronBin = fs.existsSync(localElectron) ? localElectron : 'electron';

  console.log('🚀 Starting Electron...');

  const electronProcess = spawn(electronBin, ['.'], {
    cwd: seacatDir,
    stdio: 'inherit',
    shell: true
  });

  electronProcess.on('error', (error) => {
    console.error('❌ Failed to launch Electron:', error.message);
    console.error('\nMake sure Electron is installed in the seacat client:');
    console.error(`  cd ${seacatDir}`);
    console.error('  npm install');
    process.exit(1);
  });

  electronProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`\n⚓ Seacat exited with code ${code}`);
    } else {
      console.log('\n⚓ Seacat closed');
    }
    process.exit(code || 0);
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n⚓ Shutting down Seacat...');
    electronProcess.kill('SIGINT');
  });
}

export default seacat;
