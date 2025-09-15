#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

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

      // Install dependencies
      console.log('\nInstalling dependencies...');
      await this.installDependencies();
      console.log('✓ Dependencies installed');

      // Collect variable values
      const variables = await this.collectVariables(templateMeta, options);

      // Check environment
      console.log('\nChecking environment...');
      this.checkEnvironment();

      // Process template files with variable substitution
      await this.processTemplateFiles(variables);
      console.log('✓ Created .mew/space.yaml');
      console.log('✓ Copied agent files to .mew/agents/');
      console.log('✓ Configured isolated dependencies');

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
    console.log('\n? Choose a template:');
    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      const meta = await this.loadTemplateMetadata(t);
      const indicator = i === 0 ? '❯' : ' ';
      console.log(`${indicator} ${t.name} - ${meta.description}`);
    }

    // For now, default to first template (coder-agent)
    // In a real implementation, we'd use a proper interactive selection
    return templates.find(t => t.name === 'coder-agent') || templates[0];
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
   */
  async installDependencies() {
    const mewDir = path.join(process.cwd(), '.mew');
    try {
      execSync('npm install', {
        cwd: mewDir,
        stdio: 'pipe'
      });
    } catch (error) {
      console.warn('⚠ Could not install dependencies automatically');
      console.warn('  Run "cd .mew && npm install" manually later');
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
      let value;

      // Check command-line options first
      // Map common variable names to option names
      if (variable.name === 'SPACE_NAME' && options.name) {
        value = options.name;
      } else if (variable.name === 'AGENT_MODEL' && options.model) {
        value = options.model;
      }
      // Check environment variables
      else if (process.env[variable.name]) {
        value = process.env[variable.name];
      }
      // Use default or prompt
      else if (variable.prompt) {
        value = await this.promptVariable(variable, dirname);
      } else {
        value = variable.default;
      }

      // Resolve special variables
      if (value && value.startsWith('${')) {
        value = this.resolveSpecialVariable(value, dirname);
      }

      variables[variable.name] = value;
    }

    return variables;
  }

  /**
   * Prompt user for a variable value
   */
  async promptVariable(variable, dirname) {
    // Check if stdin is a TTY (interactive)
    if (!process.stdin.isTTY) {
      // Non-interactive mode - use default
      return this.resolveSpecialVariable(variable.default, dirname);
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      const defaultValue = this.resolveSpecialVariable(variable.default, dirname);
      const prompt = `? ${variable.description}: (${defaultValue}) `;

      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer || defaultValue);
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
    if (process.env.OPENAI_API_KEY) {
      console.log('✓ Found OPENAI_API_KEY in environment');
    } else {
      console.log('⚠ OPENAI_API_KEY not found - set it before running mew');
    }

    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    console.log(`✓ Using OPENAI_BASE_URL: ${baseUrl}`);
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

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, value);
    }

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
   * Update .gitignore to exclude .mew artifacts
   */
  async updateGitignore() {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const ignorePatterns = [
      '.mew/node_modules/',
      '.mew/pm2/',
      '.mew/logs/',
      '.mew/fifos/',
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