# ADR-evd: Environment Variable Defaults for Template Initialization

**Status:** Accepted
**Date:** 2025-01-15
**Incorporation:** Complete

## Context

When initializing a MEW space using `mew init`, the CLI prompts users for various configuration values through an interactive template system. Currently, the template system supports:
- Command-line options (override any variable)
- Interactive prompts (when `prompt: true` in template.json)
- Template defaults (specified in template.json)
- Special variables like `${dirname}` for current directory

However, there's a missing capability: using environment variables as default values during prompts. This is particularly important for:
- API keys (e.g., `OPENAI_API_KEY`) that users may already have configured
- Base URLs (e.g., `OPENAI_BASE_URL`) for custom endpoints
- User preferences that span multiple projects
- CI/CD environments where prompts should be minimized

Users shouldn't have to re-enter values that are already available in their environment, but they should also have the option to override them if needed.

## Options Considered

### Option 1: Automatic Environment Variable Detection

Automatically use environment variables as defaults for any template variable with a matching name pattern.

**Implementation:**
```javascript
// If template variable is AGENT_API_KEY, check for:
// 1. AGENT_API_KEY
// 2. OPENAI_API_KEY (common fallback)
// 3. Template default
const defaultValue = process.env[variable.name] ||
                    process.env[variable.env_fallback] ||
                    variable.default;
```

**Pros:**
- Zero configuration required
- Works immediately with existing environment
- Intuitive for users familiar with environment variables

**Cons:**
- May expose sensitive values in prompts unintentionally
- Less explicit about which environment variables are used
- Potential naming conflicts

### Option 2: Explicit Environment Variable Mapping

Template authors explicitly specify which environment variables to check for each template variable.

**Implementation:**
```json
{
  "variables": [
    {
      "name": "AGENT_API_KEY",
      "description": "API key for the AI model",
      "env_sources": ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "API_KEY"],
      "default": "",
      "prompt": true,
      "sensitive": true
    }
  ]
}
```

**Pros:**
- Full control over which environment variables are checked
- Clear documentation of environment dependencies
- Can specify multiple fallback sources in priority order
- Can mark variables as sensitive to control display

**Cons:**
- Requires template authors to explicitly configure
- More verbose template configuration
- May miss useful environment variables if not configured

### Option 3: Hybrid Approach with Smart Defaults

Combine automatic detection with explicit overrides, using conventions for common cases.

**Implementation:**
```json
{
  "variables": [
    {
      "name": "AGENT_API_KEY",
      "description": "API key for the AI model",
      "env_sources": "auto",  // Use smart detection
      "env_override": ["OPENAI_API_KEY"],  // Explicit additional sources
      "prompt": true,
      "sensitive": true
    }
  ]
}
```

Smart detection rules:
- Check for exact match: `process.env[variable.name]`
- Check common prefixes: If variable ends with `_API_KEY`, check `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.
- Check common patterns: `_URL` → `_BASE_URL`, `_ENDPOINT`, etc.

**Pros:**
- Works out of the box for common cases
- Allows explicit configuration when needed
- Reduces configuration burden
- Predictable behavior with clear rules

**Cons:**
- More complex implementation
- "Magic" behavior might be confusing
- Need to maintain list of common patterns

## Decision

**Option 2: Explicit Environment Variable Mapping** is chosen for the following reasons:

1. **Security First**: Explicit configuration ensures sensitive values are never accidentally exposed
2. **Clear Intent**: Template authors explicitly declare which environment variables are acceptable
3. **Documentation**: The template.json serves as documentation for required environment
4. **Flexibility**: Supports multiple fallback sources in priority order
5. **User Control**: Users can see exactly where defaults come from

### Implementation Details

The template.json schema will be extended with:

```json
{
  "variables": [
    {
      "name": "AGENT_API_KEY",
      "description": "API key for the AI model",
      "env_sources": ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
      "default": "",
      "prompt": true,
      "sensitive": true,
      "required": false
    },
    {
      "name": "AGENT_BASE_URL",
      "description": "Base URL for the AI model API",
      "env_sources": ["OPENAI_BASE_URL", "ANTHROPIC_BASE_URL"],
      "default": "https://api.openai.com/v1",
      "prompt": true,
      "sensitive": false,
      "required": false
    },
    {
      "name": "AGENT_MODEL",
      "description": "AI model to use",
      "env_sources": ["AGENT_MODEL", "MODEL_NAME"],
      "default": "gpt-4",
      "prompt": true,
      "sensitive": false
    }
  ]
}
```

Variable resolution order:
1. Command-line option (if provided)
2. Environment variables (checked in `env_sources` order)
3. Template default value
4. Empty string (if not required)

Interactive prompt behavior:
```bash
$ mew init
? API key for the AI model: (sk-proj-abc123...)  # Shows masked env var value
? Base URL for the AI model API: (https://api.openai.com/v1)  # Shows env var value
? AI model to use: (gpt-4)  # Shows default since no env var found
```

For sensitive variables:
- Display masked value in prompt: `(sk-proj-abc...)`
- Never echo full value when typing
- Store in space.yaml only if explicitly non-sensitive configuration value
- Log that environment variable was detected but not its value

Validation and user experience:
```javascript
async function resolveVariable(variable, cmdOptions) {
  // 1. Check command-line
  if (cmdOptions[variable.name]) {
    return cmdOptions[variable.name];
  }

  // 2. Check environment sources
  if (variable.env_sources) {
    for (const envName of variable.env_sources) {
      if (process.env[envName]) {
        const value = process.env[envName];

        // For prompts, show where value came from
        if (variable.prompt) {
          const displayValue = variable.sensitive
            ? maskValue(value)
            : value;
          console.log(`  Found ${envName} in environment`);

          // Allow override even if env var exists
          const response = await prompt(
            variable.description,
            displayValue
          );

          // If user just pressed enter, use env value
          return response || value;
        }

        return value;
      }
    }
  }

  // 3. Use default or prompt without env default
  if (variable.prompt) {
    return await prompt(variable.description, variable.default);
  }

  return variable.default;
}
```

## Consequences

### Positive
- Users can leverage existing environment configuration
- Reduces repetitive data entry across projects
- Works seamlessly in CI/CD environments
- Maintains security by requiring explicit configuration
- Templates self-document their environment requirements
- Users can override environment defaults when needed

### Negative
- Template authors must explicitly configure environment sources
- Slightly more complex template.json schema
- Users might be confused why some env vars work and others don't
- Need to maintain documentation about common environment variables

### Migration
- Existing templates continue to work (no env_sources means no env checking)
- Templates can be gradually updated to support environment variables
- Default templates (coder-agent, note-taker) will be updated to use common env vars