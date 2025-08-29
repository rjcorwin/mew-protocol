# Release Process

This document outlines the process for releasing MCPx protocol specifications and npm packages.

## Protocol Specification Releases

### Version Numbering
Protocol specifications follow semantic versioning:
- `v0.x` - Experimental releases with breaking changes allowed
- `v1.x` - Stable releases with backward compatibility

### Release Process

1. **Update Specification Header**
   ```markdown
   Status: v0.1  
   Date: YYYY-MM-DD
   ```

2. **Commit Changes**
   ```bash
   git add protocol-spec/v0.1/SPEC.md
   git commit -m "Finalize MCPx v0.1 protocol specification"
   ```

3. **Tag the Release**
   ```bash
   git tag mcpx-protocol-spec-v0.1
   git push origin mcpx-protocol-spec-v0.1
   ```

### Tag Format
Protocol specification tags follow the pattern: `mcpx-protocol-spec-vMAJOR.MINOR`

Examples:
- `mcpx-protocol-spec-v0.1` - First experimental release  
- `mcpx-protocol-spec-v0.2` - Second experimental release
- `mcpx-protocol-spec-v1.0` - First stable release

### Release Notes
When creating a GitHub release:
1. Use the tag as the release name
2. Mark pre-v1.0 releases as "Pre-release"
3. Include summary of changes from previous version
4. Link to the specification file

## NPM Package Releases

### Prerequisites

1. **npm Authentication**: Ensure you're logged in to npm with publish rights
   ```bash
   npm whoami
   ```

2. **2FA Setup**: Have your authenticator app ready for OTP codes

3. **Clean Working Directory**: Ensure all changes are committed
   ```bash
   git status
   ```

### Release Process

#### 1. Pre-Release Checks

##### Update Version Numbers
Update the version in the package.json files for packages being released:
```bash
# Example: Update client package to 0.2.0
cd packages/client
npm version patch|minor|major
```

##### Verify Package Dependencies
- Ensure internal dependencies use version numbers, not `file:` references
- Update dependency versions if releasing dependent packages

##### Verify Package Metadata
Each package.json should have:
- `name`: @mcpx-protocol/[package-name]
- `version`: Semantic version
- `description`: Clear description
- `license`: MIT
- `files`: Array listing dist and README.md
- `repository`: GitHub repository info
- `homepage`: Link to repo README
- `bugs`: Link to issues

#### 2. Build and Test

```bash
# Build all packages
npm run build

# Run tests
npm test

# Verify build outputs exist
ls -la packages/*/dist/
```

#### 3. Publish Packages

**IMPORTANT**: Publish in dependency order!

**Note**: npm may auto-correct some package.json fields during publish (e.g., normalizing repository URLs, converting file: references to version references). This is normal and will update package-lock.json.

1. **Core packages first** (no internal dependencies):
   ```bash
   npm publish -w @mcpx-protocol/client --access public --otp=XXXXXX
   ```

2. **Dependent packages next**:
   ```bash
   npm publish -w @mcpx-protocol/agent --access public --otp=XXXXXX
   ```

3. **Application packages last**:
   ```bash
   npm publish -w @mcpx-protocol/bridge --access public --otp=XXXXXX
   npm publish -w @mcpx-protocol/cli --access public --otp=XXXXXX
   npm publish -w @mcpx-protocol/gateway --access public --otp=XXXXXX
   ```

#### 4. Git Tagging

Create package-specific tags for each released package:

```bash
# Tag format: @scope/package@version
git tag -a "@mcpx-protocol/client@0.1.0" -m "Release @mcpx-protocol/client@0.1.0"
git tag -a "@mcpx-protocol/agent@0.1.0" -m "Release @mcpx-protocol/agent@0.1.0"
# ... repeat for each package

# Push tags to remote
git push origin --tags
```

#### 5. Post-Release

1. **Verify npm packages**:
   ```bash
   npm view @mcpx-protocol/client
   npm view @mcpx-protocol/agent
   # ... check each package
   ```

2. **Commit package-lock.json changes**:
   ```bash
   # npm publish may auto-correct dependencies, updating package-lock.json
   git add package-lock.json
   git commit -m "chore: Update package-lock.json after npm publish"
   git push
   ```

3. **Create GitHub Release** (optional):
   - Go to GitHub releases page
   - Create release from tags
   - Add changelog notes

4. **Update Documentation**:
   - Update README if needed
   - Update CHANGELOG.md with release notes

## Dependency Order

When releasing multiple packages, follow this order:

1. `@mcpx-protocol/client` (no deps)
2. `@mcpx-protocol/agent` (depends on client)
3. `@mcpx-protocol/bridge` (independent)
4. `@mcpx-protocol/cli` (depends on client)
5. `@mcpx-protocol/gateway` (independent)

## Troubleshooting

### OTP Errors
- OTP codes expire quickly - generate fresh ones for each package
- If OTP fails, wait a moment and try with a new code

### Publishing Errors
- Check npm login status: `npm whoami`
- Verify package name availability
- Ensure version hasn't been published already
- Run with `--dry-run` first to preview

### Build Issues
- Clean and rebuild: `npm run clean && npm run build`
- Check TypeScript errors: `npm run lint`
- Verify all dependencies installed: `npm install`

## Version Bumping Strategy

- **Patch** (0.0.X): Bug fixes, documentation
- **Minor** (0.X.0): New features, backward compatible
- **Major** (X.0.0): Breaking changes

For coordinated releases where all packages update together:
```bash
# Update all packages to same version
for pkg in client agent bridge cli gateway; do
  (cd packages/$pkg && npm version 0.2.0)
done
```

## Independent Package Releases

When releasing packages independently:

1. Only update version for packages with changes
2. Update dependent packages' dependency versions
3. Tag only the released packages
4. Document which packages were released in commit message

Example for releasing only client:
```bash
cd packages/client
npm version patch
npm run build
npm test
npm publish --access public --otp=XXXXXX
git tag -a "@mcpx-protocol/client@0.1.1" -m "Release @mcpx-protocol/client@0.1.1"
git push origin --tags
```