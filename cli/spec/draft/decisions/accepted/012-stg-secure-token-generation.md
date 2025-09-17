# ADR-012-stg: Secure Token Generation for Templates

**Status:** Accepted
**Date:** 2025-09-16
**Incorporation:** Complete (v0.3.3)

## Context

The current MEW CLI template system has a critical security vulnerability: templates include hardcoded tokens in their `space.yaml` files, which means every space created from the same template uses identical tokens. This makes it trivial for attackers to predict and gain unauthorized access to spaces.

### Current Implementation Problems

1. **Predictable Tokens**: Templates like `coder-agent` and `note-taker` have static tokens defined in their `space.yaml`:
   ```yaml
   participants:
     assistant:
       tokens: ["assistant-token"]  # Same for every space!
   ```

2. **No Token Generation**: The `mew init` command performs simple variable substitution but doesn't generate unique tokens

3. **Security Risk**: An attacker who knows the template can access any space created from it

4. **Git Storage Risk**: Tokens in `space.yaml` can be accidentally committed to version control

5. **Compliance Issues**: Static tokens violate basic security principles and may fail security audits

### Requirements

- Generate unique, cryptographically secure tokens during space initialization
- **NEVER** store tokens in files that could be committed to git
- Support runtime token generation and secure storage
- Provide clear separation between configuration and secrets
- Enable token rotation and management

## Options Considered

### Option 1: Runtime Token Generation with Secure Storage (RECOMMENDED)

Generate tokens at runtime and store them in a secure, gitignored location.

**Implementation:**
- Templates specify participants but NO tokens
- `mew init` creates `.mew/tokens/` directory (gitignored)
- Generate tokens when space starts for the first time
- Store tokens in `.mew/tokens/<participant-id>.token` files
- Gateway loads tokens from secure storage at startup

**Template space.yaml:**
```yaml
participants:
  assistant:
    # No tokens field - generated at runtime
    capabilities:
      - kind: "mcp/*"
  human:
    # No tokens field
    capabilities:
      - kind: "mcp/*"
```

**Token Storage (.mew/tokens/):**
```
.mew/
├── tokens/           # Always gitignored
│   ├── assistant.token
│   ├── human.token
│   └── .gitignore    # Extra protection: *
└── space.yaml        # Clean configuration, no secrets
```

**Pros:**
- Tokens NEVER in git-tracked files
- Clear separation of config and secrets
- Easy token rotation
- Secure by default
- Simple token management

**Cons:**
- Requires filesystem access for token storage
- Need to ensure .mew/tokens/ is always gitignored

### Option 2: Environment Variable Only

Use environment variables exclusively for all tokens.

**Implementation:**
- Templates have NO token fields
- Tokens passed via environment: `MEW_TOKEN_<PARTICIPANT_ID>`
- Gateway reads tokens from environment
- Never store tokens in files

**Usage:**
```bash
export MEW_TOKEN_ASSISTANT=generated-token-123
export MEW_TOKEN_HUMAN=generated-token-456
mew space up
```

**Pros:**
- Zero risk of git exposure
- Standard practice for secrets
- Works well in CI/CD

**Cons:**
- Manual token management
- Hard to manage multiple spaces
- Poor developer experience locally

### Option 3: System Keychain Integration

Store tokens in the OS keychain/keyring.

**Implementation:**
- Use OS keychain APIs (macOS Keychain, Windows Credential Store, Linux Secret Service)
- Tokens never touch the filesystem
- Encrypted at rest by the OS

**Pros:**
- Most secure option
- OS handles encryption
- No filesystem artifacts

**Cons:**
- Platform-specific implementation
- Complex dependency management
- May require elevated permissions
- Poor CI/CD support

## Decision

**Selected Option: Option 1 - Runtime Token Generation with Secure Storage**

This option provides the best balance of security, usability, and implementation simplicity. Tokens are never stored in git-trackable files, while still providing a good developer experience.

### Implementation Details

1. **Directory Structure:**
   ```
   project/
   ├── .mew/
   │   ├── space.yaml      # Configuration only, no tokens
   │   ├── tokens/         # Secure token storage
   │   │   ├── .gitignore  # Contains: *
   │   │   ├── assistant.token
   │   │   └── human.token
   │   └── ...
   └── .gitignore          # Must include: .mew/tokens/
   ```

2. **Token Generation:**
   ```javascript
   const crypto = require('crypto');

   function generateSecureToken() {
     // Generate 32 bytes of random data (256 bits)
     return crypto.randomBytes(32).toString('base64url');
   }

   async function ensureTokenExists(participantId) {
     const tokenPath = path.join('.mew/tokens', `${participantId}.token`);

     if (!fs.existsSync(tokenPath)) {
       const token = generateSecureToken();
       await fs.promises.writeFile(tokenPath, token, { mode: 0o600 });
       console.log(`Generated token for ${participantId}`);
     }

     return fs.promises.readFile(tokenPath, 'utf-8');
   }
   ```

3. **Init Process:**
   ```javascript
   async function initSpace(template) {
     // Create directory structure
     await fs.promises.mkdir('.mew/tokens', { recursive: true });

     // Create gitignore in tokens directory
     await fs.promises.writeFile('.mew/tokens/.gitignore', '*\n');

     // Copy template WITHOUT any tokens
     const cleanTemplate = removeTokenFields(template);
     await fs.promises.writeFile('.mew/space.yaml', cleanTemplate);

     // Update root .gitignore
     await ensureGitignore('.gitignore', ['.mew/tokens/']);
   }
   ```

4. **Gateway Token Loading:**
   ```javascript
   async function loadParticipantTokens(spaceConfig) {
     const tokenMap = new Map();

     for (const [participantId, config] of Object.entries(spaceConfig.participants)) {
       // Try to load existing token or generate new one
       const token = await ensureTokenExists(participantId);
       tokenMap.set(participantId, [token]); // Array for multiple tokens per participant
     }

     return tokenMap;
   }
   ```

5. **Token Rotation:**
   ```javascript
   async function rotateToken(participantId) {
     const tokenPath = path.join('.mew/tokens', `${participantId}.token`);
     const oldTokenPath = `${tokenPath}.old`;

     // Backup old token
     if (fs.existsSync(tokenPath)) {
       await fs.promises.rename(tokenPath, oldTokenPath);
     }

     // Generate new token
     const newToken = generateSecureToken();
     await fs.promises.writeFile(tokenPath, newToken, { mode: 0o600 });

     return newToken;
   }
   ```

6. **Security Measures:**
   - Set file permissions to 0600 (owner read/write only)
   - Double gitignore protection (.mew/tokens/.gitignore and root .gitignore)
   - Validate token strength on load
   - Warning if .mew/tokens/ not in .gitignore

## Consequences

### Positive

1. **Zero Git Exposure Risk**: Tokens never exist in git-trackable files
2. **Secure by Default**: Automatic token generation with proper permissions
3. **Clean Configuration**: space.yaml contains only configuration, no secrets
4. **Easy Token Rotation**: Simple command to rotate tokens without config changes
5. **Clear Security Boundary**: Obvious separation between config and secrets
6. **Good Developer Experience**: Tokens generated automatically, no manual setup

### Negative

1. **Filesystem Dependency**: Requires local filesystem for token storage
2. **No Backward Compatibility**: Breaking change from current implementation
3. **Local Development Only**: CI/CD needs environment variables or other approach
4. **Token Backup**: Users responsible for backing up tokens if needed

### Mitigation Strategies

1. **Automatic .gitignore**: Always create and verify .gitignore entries
2. **Environment Variable Fallback**: Support `MEW_TOKEN_*` env vars as override
3. **Migration Tool**: Provide script to migrate existing spaces to new structure
4. **Clear Documentation**: Extensive docs on token management and security

## Future Considerations

1. **Keychain Integration**: Add OS keychain support for enhanced security
2. **Token Rotation Command**: Add `mew space rotate-tokens` command
3. **Multi-Token Support**: Allow multiple tokens per participant
4. **Token Expiry**: Add token expiration and renewal
5. **Audit Logging**: Track token usage and access patterns

## Implementation Checklist

- [ ] Remove all hardcoded tokens from templates
- [ ] Implement `generateSecureToken()` function
- [ ] Create `.mew/tokens/` directory structure during init
- [ ] Implement `ensureTokenExists()` for lazy token generation
- [ ] Update gateway to load tokens from `.mew/tokens/`
- [ ] Add automatic .gitignore management
- [ ] Set proper file permissions (0600) on token files
- [ ] Add environment variable fallback (`MEW_TOKEN_*`)
- [ ] Create migration guide for existing spaces
- [ ] Update all documentation to reflect new approach
- [ ] Add security warnings if tokens directory not gitignored
- [ ] Implement token rotation functionality
- [ ] Add comprehensive tests for token management

## References

- [NIST Guidelines on Authentication and Token Security](https://pages.nist.gov/800-63-3/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [RFC 4122 - UUID Generation](https://www.rfc-editor.org/rfc/rfc4122)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)