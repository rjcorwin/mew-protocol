#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const crypto = require('crypto');

/**
 * MEW init command - Initialize a new MEW space from templates
 */

class InitCommand {
  constructor() {
    this.templatesDir = path.join(__dirname, '../../templates');
    this.userTemplatesDir = path.join(process.env.HOME, '.mew/templates');
    this.localTemplatesDir = path.join(process.cwd(), 'templates');
  }

  /**
   * Main entry point for the init command
   */
  async execute(options = {}) {
    try {
      // Check if space already exists
      const spaceExists = await this.checkSpaceExists();
      if (spaceExists && !options.force) {
        console.error('Space already initialized. Use --force to overwrite.');
        process.exit(1);
      }

      // Get available templates
      const templates = await this.discoverTemplates();

      if (options.listTemplates) {
        this.listTemplates(templates);
        return;
      }

      if (options.templateInfo) {
        await this.showTemplateInfo(options.templateInfo, templates);
        return;
      }

      // Select template
      const template = await this.selectTemplate(options.template, templates);
      if (!template) {
        console.error('No template selected');
        process.exit(1);
      }

      // Load template metadata
      const templateMeta = await this.loadTemplateMetadata(template);

      // Show welcome message
      console.log('\nWelcome to MEW Protocol! Let\'s set up your space.');

      // Create .mew directory
      console.log('\nSetting up isolated MEW environment...');
      await this.createMewDirectory();

      // Copy template files
      console.log('✓ Created .mew directory');
      await this.copyTemplateFiles(template.path);
      console.log('✓ Copied template files to .mew/');

      // Collect variable values BEFORE processing templates
      console.log('\nConfiguring your space...');
      const variables = await this.collectVariables(templateMeta, options);

      // Process template files with variable substitution (including package.json)
      await this.processTemplateFiles(variables);
      console.log('✓ Processed template files with configuration');

      // Prefer local workspace packages when running inside the monorepo
      await this.useLocalWorkspacePackagesIfAvailable();

      // NOW install dependencies after package.json has been processed
      console.log('\nInstalling dependencies...');
      const depsInstalled = await this.installDependencies();
      if (depsInstalled !== false) {
        console.log('✓ Dependencies installed');
      }

      // Check environment
      console.log('\nChecking environment...');
      this.checkEnvironment();

      console.log('✓ Created .mew/space.yaml');
      console.log('✓ Configured isolated dependencies');

      // Create secure token storage
      await this.createTokenStorage();
      console.log('✓ Created secure token storage (.mew/tokens/)');

      // Update .gitignore
      await this.updateGitignore();
      console.log('✓ Updated .gitignore');

      // Show completion message
      console.log('\nReady! Your project root remains clean.');
      console.log('MEW configuration and dependencies are isolated in .mew/');
      console.log('\nTry: mew');

    } catch (error) {
      console.error('Error during initialization:', error.message);
      process.exit(1);
    }
  }

  /**
   * Check if a space configuration already exists
   */
  async checkSpaceExists() {
    try {
      await fs.access(path.join(process.cwd(), '.mew/space.yaml'));
      return true;
    } catch {
      try {
        await fs.access(path.join(process.cwd(), 'space.yaml'));
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Discover available templates from various sources
   */
  async discoverTemplates() {
    const templates = [];

    // Built-in templates
    try {
      const builtIn = await fs.readdir(this.templatesDir);
      for (const name of builtIn) {
        const templatePath = path.join(this.templatesDir, name);
        const stat = await fs.stat(templatePath);
        if (stat.isDirectory()) {
          templates.push({
            name,
            path: templatePath,
            source: 'built-in'
          });
        }
      }
    } catch (error) {
      // Built-in templates directory doesn't exist
    }

    // User templates
    try {
      const userTemplates = await fs.readdir(this.userTemplatesDir);
      for (const name of userTemplates) {
        const templatePath = path.join(this.userTemplatesDir, name);
        const stat = await fs.stat(templatePath);
        if (stat.isDirectory()) {
          templates.push({
            name,
            path: templatePath,
            source: 'user'
          });
        }
      }
    } catch {
      // User templates directory doesn't exist
    }

    // Local templates
    try {
      const localTemplates = await fs.readdir(this.localTemplatesDir);
      for (const name of localTemplates) {
        const templatePath = path.join(this.localTemplatesDir, name);
        const stat = await fs.stat(templatePath);
        if (stat.isDirectory()) {
          templates.push({
            name,
            path: templatePath,
            source: 'local'
          });
        }
      }
    } catch {
      // Local templates directory doesn't exist
    }

    return templates;
  }

  /**
   * List available templates
   */
  listTemplates(templates) {
    console.log('\nAvailable templates:\n');
    for (const template of templates) {
      console.log(`  ${template.name} (${template.source})`);
    }
  }

  /**
   * Show information about a specific template
   */
  async showTemplateInfo(templateName, templates) {
    const template = templates.find(t => t.name === templateName);
    if (!template) {
      console.error(`Template '${templateName}' not found`);
      process.exit(1);
    }

    const meta = await this.loadTemplateMetadata(template);
    console.log(`\nTemplate: ${meta.name}`);
    console.log(`Description: ${meta.description}`);
    console.log(`Version: ${meta.version}`);
    console.log(`Author: ${meta.author}`);
    if (meta.tags && meta.tags.length > 0) {
      console.log(`Tags: ${meta.tags.join(', ')}`);
    }

    // Show README if available
    try {
      const readmePath = path.join(template.path, 'README.md');
      const readme = await fs.readFile(readmePath, 'utf8');
      console.log('\n--- README ---\n');
      console.log(readme);
    } catch {
      // No README available
    }
  }

  /**
   * Select a template interactively or from options
   */
  async selectTemplate(templateName, templates) {
    if (templates.length === 0) {
      console.error('No templates found');
      return null;
    }

    // If template specified, use it
    if (templateName) {
      const template = templates.find(t => t.name === templateName);
      if (!template) {
        console.error(`Template '${templateName}' not found`);
        console.log('Available templates:');
        this.listTemplates(templates);
        process.exit(1);
      }
      return template;
    }

    // If only one template, use it
    if (templates.length === 1) {
      return templates[0];
    }

    // Non-interactive mode - use default template
    if (!process.stdin.isTTY) {
      return templates.find(t => t.name === 'coder-agent') || templates[0];
    }

    // Interactive selection
    return await this.promptTemplateSelection(templates);
  }

  /**
   * Load template metadata
   */
  async loadTemplateMetadata(template) {
    try {
      const metaPath = path.join(template.path, 'template.json');
      const content = await fs.readFile(metaPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      // Return minimal metadata if template.json doesn't exist
      return {
        name: template.name,
        description: 'No description available',
        version: '1.0.0',
        variables: []
      };
    }
  }

  /**
   * Create .mew directory structure
   */
  async createMewDirectory() {
    const mewDir = path.join(process.cwd(), '.mew');
    await fs.mkdir(mewDir, { recursive: true });
    await fs.mkdir(path.join(mewDir, 'agents'), { recursive: true });
    await fs.mkdir(path.join(mewDir, 'logs'), { recursive: true });
    await fs.mkdir(path.join(mewDir, 'pm2'), { recursive: true });
    await fs.mkdir(path.join(mewDir, 'fifos'), { recursive: true });
  }

  /**
   * Copy template files to .mew directory
   */
  async copyTemplateFiles(templatePath) {
    const mewDir = path.join(process.cwd(), '.mew');

    // Copy package.json
    const packageSrc = path.join(templatePath, 'package.json');
    const packageDest = path.join(mewDir, 'package.json');
    await fs.copyFile(packageSrc, packageDest);

    // Copy agents directory
    const agentsSrc = path.join(templatePath, 'agents');
    const agentsDest = path.join(mewDir, 'agents');
    await this.copyDirectory(agentsSrc, agentsDest);

    // Make agent files executable
    try {
      const { execSync } = require('child_process');
      execSync(`chmod +x ${agentsDest}/*.js 2>/dev/null || true`);
    } catch {
      // Ignore errors on Windows
    }

    // Copy space.yaml (will be processed later)
    const spaceSrc = path.join(templatePath, 'space.yaml');
    const spaceDest = path.join(mewDir, 'space.yaml.template');
    await fs.copyFile(spaceSrc, spaceDest);
  }

  /**
   * Copy directory recursively
   */
  async copyDirectory(src, dest) {
    try {
      const entries = await fs.readdir(src, { withFileTypes: true });
      await fs.mkdir(dest, { recursive: true });

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          await this.copyDirectory(srcPath, destPath);
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      }
    } catch (error) {
      // Source directory doesn't exist
    }
  }

  /**
   * Install dependencies in .mew directory
   * @returns {boolean} true if successful, false if failed
   */
  async installDependencies() {
    const mewDir = path.join(process.cwd(), '.mew');

    // Check if package.json exists
    const packagePath = path.join(mewDir, 'package.json');
    try {
      await fs.access(packagePath);
    } catch {
      console.warn('⚠ No package.json found in .mew directory');
      return false;
    }

    try {
      // Show installing message
      console.log('  Running npm install in .mew directory...');

      const result = execSync('npm install --loglevel=error', {
        cwd: mewDir,
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 60000 // 60 second timeout
      });

      // If there's any output, it might be warnings
      if (result) {
        const lines = result.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
          console.log('  npm output:', lines[0]);
        }
      }
      return true; // Success
    } catch (error) {
      console.warn('⚠ Could not install dependencies automatically');

      // Show more detailed error information
      if (error.message) {
        console.warn('  Error:', error.message);
      }
      if (error.stderr) {
        const stderr = error.stderr.toString().trim();
        if (stderr) {
          const lines = stderr.split('\n');
          console.warn('  Details:', lines[0]);
          if (lines.length > 1) {
            console.warn('  ', lines[1]);
          }
        }
      }
      if (error.stdout) {
        const stdout = error.stdout.toString().trim();
        if (stdout) {
          console.warn('  Output:', stdout.split('\n')[0]);
        }
      }

      console.warn('  Run "cd .mew && npm install" manually to complete setup');
      console.warn('  This is usually due to network issues or npm registry problems');
      return false; // Failed
    }
  }

  /**
   * Collect variable values from user or options
   */
  async collectVariables(templateMeta, options) {
    const variables = {};

    // Get current directory name for default space name
    const dirname = path.basename(process.cwd());

    for (const variable of templateMeta.variables || []) {
      // Resolve variable value according to ADR-evd
      const value = await this.resolveVariable(variable, options, dirname);

      // Only store non-sensitive values in variables
      if (!variable.sensitive) {
        variables[variable.name] = value;
      }
      // Sensitive values remain in environment only
    }

    // Provide JSON-escaped variants for templates that need to embed values inside JSON
    if (typeof variables.AGENT_PROMPT === 'string') {
      variables.AGENT_PROMPT_JSON = JSON.stringify(variables.AGENT_PROMPT);
    }

    return variables;
  }

  /**
   * Resolve a variable value according to priority order (per ADR-evd)
   */
  async resolveVariable(variable, cmdOptions, dirname) {
    // 1. Check command-line options
    if (variable.name === 'SPACE_NAME' && cmdOptions.name) {
      return cmdOptions.name;
    }
    if (variable.name === 'AGENT_MODEL' && cmdOptions.model) {
      return cmdOptions.model;
    }
    // Add more command-line mappings as needed

    // 2. Check environment sources
    if (variable.env_sources && variable.env_sources.length > 0) {
      for (const envName of variable.env_sources) {
        if (process.env[envName]) {
          const value = process.env[envName];

          // For prompts, show where value came from
          if (variable.prompt && process.stdin.isTTY) {
            console.log(`\n  Found ${envName} in environment`);

            const displayValue = variable.sensitive
              ? this.maskValue(value)
              : value;

            // Allow override even if env var exists
            const response = await this.promptVariable(
              variable,
              dirname,
              displayValue
            );

            // If user just pressed enter, use env value
            return response || value;
          }

          // No prompt, use env value directly
          return value;
        }
      }
    }

    // 3. Use default or prompt without env default
    if (variable.prompt && process.stdin.isTTY) {
      const defaultValue = this.resolveSpecialVariable(variable.default, dirname);
      return await this.promptVariable(variable, dirname, defaultValue);
    }

    // 4. Special resolution for ${...} syntax
    if (variable.default && variable.default.startsWith('${')) {
      return this.resolveSpecialVariable(variable.default, dirname);
    }

    return variable.default || '';
  }

  /**
   * Mask sensitive values for display
   */
  maskValue(value) {
    if (!value || value.length < 8) {
      return '***';
    }

    // Show first few chars and last few chars
    const prefix = value.substring(0, Math.min(8, value.length / 3));
    const suffix = value.length > 20 ? value.substring(value.length - 3) : '';
    return `${prefix}...${suffix}`;
  }

  /**
   * Prompt user for a variable value
   */
  /**
   * Interactive template selection with arrow keys
   */
  async promptTemplateSelection(templates) {
    // Prepare template metadata
    const templatesWithMeta = [];
    for (const t of templates) {
      const meta = await this.loadTemplateMetadata(t);
      templatesWithMeta.push({ ...t, meta });
    }

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      let selectedIndex = 0;

      // Function to render the menu
      const renderMenu = () => {
        console.log('\n? Choose a template:');
        for (let i = 0; i < templatesWithMeta.length; i++) {
          const t = templatesWithMeta[i];
          const indicator = i === selectedIndex ? '❯' : ' ';
          console.log(`${indicator} ${t.name} - ${t.meta.description}`);
        }
        console.log('\n(Use arrow keys to move, Enter to select)');
      };

      // Initial render
      renderMenu();

      // Enable raw mode for arrow key detection
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      // Handle key presses
      const keyHandler = (key) => {
        if (key) {
          const keyStr = key.toString();

          // Handle Ctrl+C
          if (keyStr === '\u0003') {
            process.exit(0);
          }

          // Handle arrow keys
          if (keyStr === '\u001b[A') { // Up arrow
            selectedIndex = Math.max(0, selectedIndex - 1);
            // Clear previous output and re-render
            process.stdout.write('\u001b[' + (templatesWithMeta.length + 3) + 'A');
            process.stdout.write('\u001b[0J');
            renderMenu();
          } else if (keyStr === '\u001b[B') { // Down arrow
            selectedIndex = Math.min(templatesWithMeta.length - 1, selectedIndex + 1);
            // Clear previous output and re-render
            process.stdout.write('\u001b[' + (templatesWithMeta.length + 3) + 'A');
            process.stdout.write('\u001b[0J');
            renderMenu();
          } else if (keyStr === '\r' || keyStr === '\n') { // Enter key
            // Clean up
            process.stdin.removeListener('data', keyHandler);
            if (process.stdin.setRawMode) {
              process.stdin.setRawMode(false);
            }
            process.stdin.pause();
            rl.close();

            console.log('');
            resolve(templatesWithMeta[selectedIndex]);
          } else if (keyStr >= '1' && keyStr <= '9') {
            // Number key selection
            const num = parseInt(keyStr) - 1;
            if (num < templatesWithMeta.length) {
              selectedIndex = num;

              // Clean up
              process.stdin.removeListener('data', keyHandler);
              if (process.stdin.setRawMode) {
                process.stdin.setRawMode(false);
              }
              process.stdin.pause();
              rl.close();

              // Clear and show final selection
              process.stdout.write('\u001b[' + (templatesWithMeta.length + 3) + 'A');
              process.stdout.write('\u001b[0J');
              console.log('\n? Choose a template:');
              for (let i = 0; i < templatesWithMeta.length; i++) {
                const t = templatesWithMeta[i];
                const indicator = i === selectedIndex ? '❯' : ' ';
                console.log(`${indicator} ${t.name} - ${t.meta.description}`);
              }
              console.log('');

              resolve(templatesWithMeta[selectedIndex]);
            }
          }
        }
      };

      process.stdin.on('data', keyHandler);
    });
  }

  async promptVariable(variable, dirname, defaultValue = null) {
    // Check if stdin is a TTY (interactive)
    if (!process.stdin.isTTY) {
      // Non-interactive mode - use default
      return defaultValue || this.resolveSpecialVariable(variable.default, dirname);
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      const displayDefault = defaultValue || this.resolveSpecialVariable(variable.default, dirname) || '';
      const defaultHint = displayDefault ? ` (${displayDefault})` : '';
      const prompt = `? ${variable.description}:${defaultHint} `;

      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer || displayDefault);
      });
    });
  }

  /**
   * Resolve special variables like ${dirname}
   */
  resolveSpecialVariable(value, dirname) {
    if (!value) return value;

    return value
      .replace('${dirname}', dirname)
      .replace('${username}', process.env.USER || process.env.USERNAME || 'user')
      .replace('${date}', new Date().toISOString().split('T')[0]);
  }

  /**
   * Check environment for required variables
   */
  checkEnvironment() {
    // This is now handled during variable collection
    // Keep method for compatibility but reduce output
    console.log('');

    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      console.log('Note: API keys are read from environment variables at runtime.');
      console.log('Set OPENAI_API_KEY or ANTHROPIC_API_KEY before running \'mew space up\'.');
    }
  }

  /**
   * Process template files with variable substitution
   */
  async processTemplateFiles(variables) {
    const mewDir = path.join(process.cwd(), '.mew');

    // Process space.yaml
    const templatePath = path.join(mewDir, 'space.yaml.template');
    const outputPath = path.join(mewDir, 'space.yaml');

    let content = await fs.readFile(templatePath, 'utf8');

    // Replace only non-sensitive variables
    // Sensitive variables should be read from environment at runtime
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, value || '');
    }

    // Remove any remaining sensitive variable placeholders
    // These will be read from environment at runtime
    content = content.replace(/{{AGENT_API_KEY}}/g, '');
    content = content.replace(/{{.*_API_KEY}}/g, '');
    content = content.replace(/{{.*_SECRET}}/g, '');
    content = content.replace(/{{.*_PASSWORD}}/g, '');

    await fs.writeFile(outputPath, content);
    await fs.unlink(templatePath); // Remove template file

    // Process package.json to replace variables
    const packagePath = path.join(mewDir, 'package.json');
    try {
      let packageContent = await fs.readFile(packagePath, 'utf8');

      // Replace variables in package.json
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        packageContent = packageContent.replace(regex, value);
      }

      await fs.writeFile(packagePath, packageContent);
    } catch (error) {
      // Package.json might not exist or have variables
      console.warn('Could not process package.json:', error.message);
    }
  }

  /**
   * If we're running inside the MEW monorepo, rewrite MEW package deps to link to local workspaces
   */
  async useLocalWorkspacePackagesIfAvailable() {
    const mewDir = path.join(process.cwd(), '.mew');
    const packagePath = path.join(mewDir, 'package.json');

    let packageJson;
    try {
      const content = await fs.readFile(packagePath, 'utf8');
      packageJson = JSON.parse(content);
    } catch {
      return; // No package.json or invalid JSON
    }

    const repoRoot = await this.findMonorepoRoot();
    if (!repoRoot) {
      return; // Not inside the monorepo, keep npm versions
    }

    const localTargets = {
      '@mew-protocol/agent': path.join(repoRoot, 'sdk/typescript-sdk/agent'),
      '@mew-protocol/bridge': path.join(repoRoot, 'bridge'),
      '@mew-protocol/client': path.join(repoRoot, 'sdk/typescript-sdk/client'),
      '@mew-protocol/participant': path.join(repoRoot, 'sdk/typescript-sdk/participant'),
      '@mew-protocol/types': path.join(repoRoot, 'sdk/typescript-sdk/types')
    };

    let changed = false;
    for (const [dep, targetPath] of Object.entries(localTargets)) {
      if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
        continue;
      }

      try {
        await fs.access(targetPath);
      } catch {
        continue; // Local package not present
      }

      const relativePath = path.relative(mewDir, targetPath) || '.';
      const normalized = relativePath.split(path.sep).join('/');
      const linkSpec = `link:${normalized.startsWith('.') ? normalized : `./${normalized}`}`;

      if (packageJson.dependencies[dep] !== linkSpec) {
        packageJson.dependencies[dep] = linkSpec;
        changed = true;
      }
    }

    if (changed) {
      await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log('  Using local MEW workspace packages');
    }
  }

  /**
   * Find the monorepo root (package.json named "mew-protocol" with MEW workspaces)
   */
  async findMonorepoRoot() {
    let dir = process.cwd();
    const root = path.parse(dir).root;

    while (dir && dir !== root) {
      const pkgPath = path.join(dir, 'package.json');
      try {
        const content = await fs.readFile(pkgPath, 'utf8');
        const pkg = JSON.parse(content);

        if (
          pkg?.name === 'mew-protocol' &&
          Array.isArray(pkg.workspaces) &&
          pkg.workspaces.some((entry) => String(entry).includes('sdk/typescript-sdk/agent'))
        ) {
          return dir;
        }
      } catch {
        // ignore
      }

      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }

    return null;
  }

  /**
   * Create secure token storage directory
   */
  async createTokenStorage() {
    const tokensDir = path.join(process.cwd(), '.mew/tokens');

    // Create tokens directory
    await fs.mkdir(tokensDir, { recursive: true, mode: 0o700 });

    // Create .gitignore in tokens directory for extra protection
    const tokenGitignore = path.join(tokensDir, '.gitignore');
    await fs.writeFile(tokenGitignore, '*\n!.gitignore\n', { mode: 0o600 });

    // Note: Actual tokens will be generated on first use when space starts
    console.log('Token storage initialized. Tokens will be generated when space starts.');
  }

  /**
   * Update .gitignore to exclude .mew artifacts
   */
  async updateGitignore() {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const ignorePatterns = [
      '.mew/node_modules/',
      '.mew/pm2/',
      '.mew/logs/',
      '.mew/fifos/',
      '.mew/tokens/',  // Add tokens directory
      '.mew/.env'
    ];

    try {
      let content = await fs.readFile(gitignorePath, 'utf8');

      // Check if patterns already exist
      for (const pattern of ignorePatterns) {
        if (!content.includes(pattern)) {
          content += `\n${pattern}`;
        }
      }

      await fs.writeFile(gitignorePath, content);
    } catch {
      // Create new .gitignore
      await fs.writeFile(gitignorePath, ignorePatterns.join('\n') + '\n');
    }
  }
}

// Export for use in main CLI
module.exports = InitCommand;

// Run if called directly
if (require.main === module) {
  const command = new InitCommand();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    template: args.find(arg => !arg.startsWith('--')),
    force: args.includes('--force'),
    listTemplates: args.includes('--list-templates'),
    templateInfo: args.includes('--template-info') ? args[args.indexOf('--template-info') + 1] : null,
  };

  // Parse named options
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      options.spacename = args[i + 1];
    }
    if (args[i] === '--port' && args[i + 1]) {
      options.port = args[i + 1];
    }
  }

  command.execute(options);
}
