# MEW Protocol Release Guide

This guide covers the complete process for releasing MEW Protocol to npm.

> **📋 Release Documentation**: For versioned release plans and reports, see [`docs/releases/`](../docs/releases/README.md)

## Package Information

MEW Protocol is published as a single npm package:
- **Package Name**: `@mew-protocol/mew`
- **Current Version**: Check `package.json` in repository root

## Pre-Release Checklist

### 1. Verify Repository State

```bash
# Ensure all changes are committed
git status

# Ensure you're on the main branch (or release branch)
git branch

# Pull latest changes
git pull origin main
```

### 2. Run Tests and Quality Checks

```bash
# Build the project
npm run build

# Run all end-to-end tests
./e2e/run-all-tests.sh

# Run linting
npm run lint

# Verify no TypeScript errors
npx tsc --noEmit
```

All tests should pass before proceeding with the release.

### 3. Check npm Authentication

```bash
# Verify npm login
npm whoami

# Verify access to @mew-protocol scope
npm access ls-packages
# Should show @mew-protocol/mew
```

If not logged in:
```bash
npm login
```

### 4. Review Package Contents

```bash
# Check what will be published (dry run)
npm pack --dry-run

# Review the file list to ensure:
# - dist/ is included
# - templates/ is included
# - spec/ is included
# - No unnecessary files (node_modules, test artifacts, etc.)
```

## Release Process

### Phase 1: Update Changelog

Review changes since the last release and update `CHANGELOG.md`:

```bash
# See commits since last release tag
git log --oneline v0.4.0..HEAD

# See detailed changes
git log v0.4.0..HEAD --pretty=format:"%h %s" --graph
```

Update `CHANGELOG.md` with the new version section:

```markdown
## [0.5.0] - 2025-XX-XX

### Added
- New feature descriptions

### Changed
- Modified behavior descriptions

### Fixed
- Bug fix descriptions

### Breaking Changes
- Any breaking changes (especially important for v0.x)
```

Commit the changelog:
```bash
git add CHANGELOG.md
git commit -m "docs: update changelog for v0.5.0 release"
```

### Phase 2: Version Bump

Choose the appropriate version bump based on changes:
- **patch** (0.4.0 → 0.4.1): Bug fixes, minor updates
- **minor** (0.4.0 → 0.5.0): New features, non-breaking changes
- **major** (0.4.0 → 1.0.0): Breaking changes

```bash
# Bump version (choose one)
npm version patch --no-git-tag-version  # For bug fixes
npm version minor --no-git-tag-version  # For new features
npm version major --no-git-tag-version  # For breaking changes

# This updates package.json and package-lock.json
```

### Phase 3: Build for Release

```bash
# Clean build
npm run clean
npm run build

# Verify build succeeded
ls -la dist/
```

### Phase 4: Commit Version Changes

```bash
# Check what changed
git status

# Add version changes
git add package.json package-lock.json

# Commit the version bump
git commit -m "chore: bump version to $(node -p "require('./package.json').version")

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push the version bump commit
git push origin main
```

### Phase 5: Publish to npm

```bash
# Get your npm OTP ready (from authenticator app)

# Publish the package
npm publish --access public --otp=YOUR_OTP_HERE

# Replace YOUR_OTP_HERE with your 6-digit OTP code
```

**Note**: npm may require 2FA (two-factor authentication). Have your authenticator app ready.

### Phase 6: Create Git Tag

```bash
# Get the version from package.json
VERSION=$(node -p "require('./package.json').version")

# Create and push the tag
git tag "v$VERSION"
git push origin "v$VERSION"

# Or create an annotated tag with release notes
git tag -a "v$VERSION" -m "Release v$VERSION

- Feature 1
- Feature 2
- Bug fix 3"
git push origin "v$VERSION"
```

## Post-Release Tasks

### 1. Verify Publication

```bash
# Check the package on npm
npm view @mew-protocol/mew

# Verify the latest version
npm view @mew-protocol/mew version

# Check all published versions
npm view @mew-protocol/mew versions --json
```

### 2. Test Installation in Clean Environment

Create a test environment to verify the published package works:

```bash
# Create temporary test directory
mkdir /tmp/mew-release-test
cd /tmp/mew-release-test

# Install the published package globally
npm install -g @mew-protocol/mew@latest

# Verify CLI works
mew --version
mew --help

# Test creating a space
mkdir test-space
cd test-space
mew init coder-agent

# Verify space.yaml was created
ls -la .mew/

# Test starting the space
mew space up

# Verify processes started
pm2 list

# Stop the space
mew space down

# Cleanup
cd /
rm -rf /tmp/mew-release-test
npm uninstall -g @mew-protocol/mew
```

### 3. Update Changelog Date

Update the changelog with the actual release date:

```bash
# Edit CHANGELOG.md
# Change "2025-XX-XX" to actual release date (e.g., "2025-01-15")

git add CHANGELOG.md
git commit -m "docs: update changelog release date"
git push origin main
```

### 4. Update Documentation

Update any documentation that references specific versions:

```bash
# Check for version references
grep -r "0.4" README.md docs/

# Update as needed
git add README.md docs/
git commit -m "docs: update version references for release"
git push origin main
```

### 5. Announce the Release

Consider announcing the release:
- Create a GitHub release with release notes
- Update project documentation
- Notify users/contributors

## Troubleshooting

### Common Issues

**403 Forbidden Error**
```bash
# Check npm login and permissions
npm whoami
npm access ls-packages

# Re-login if needed
npm logout
npm login
```

**Version Already Published**
```bash
# Check existing versions
npm view @mew-protocol/mew versions --json

# You cannot republish the same version
# Bump to a new version and try again
npm version patch --no-git-tag-version
```

**OTP Expired**
```bash
# Generate a new OTP from your authenticator app
# Retry the publish command with the new OTP
npm publish --access public --otp=NEW_OTP_HERE
```

**Build Artifacts Missing**
```bash
# Ensure the project is built
npm run clean
npm run build

# Check for dist/ directory
ls -la dist/

# Verify dist/ is included in package
npm pack --dry-run | grep dist/
```

**Package Too Large**
```bash
# Check package size
npm pack --dry-run

# Review .npmignore to exclude unnecessary files
cat .npmignore

# Common things to exclude:
# - e2e/ (test scenarios)
# - .github/ (CI configuration)
# - src/ (if dist/ contains compiled code)
```

### Build Issues

**TypeScript Compilation Errors**
```bash
# Clean and rebuild
npm run clean
npm install
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

**Dependency Issues**
```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

## Version Management Strategy

### Semantic Versioning (v0.x)

MEW Protocol follows semantic versioning while in v0.x (experimental phase):

- **0.x.y → 0.x.z** (patch): Bug fixes, documentation updates
- **0.x.y → 0.(x+1).0** (minor): New features, enhancements, breaking changes allowed
- **0.x.y → 1.0.0** (major): First stable release

**Important**: Breaking changes are allowed in minor versions during the v0.x phase.

### Version Guidelines

1. **Patch releases (0.4.x)**:
   - Bug fixes only
   - No new features
   - No breaking changes

2. **Minor releases (0.x.0)**:
   - New features
   - Enhancements
   - Breaking changes (allowed in v0.x)
   - Deprecations

3. **Major release (1.0.0)**:
   - First stable release
   - After this, follow strict semantic versioning

## Emergency Procedures

### Unpublish (Within 72 Hours)

**WARNING**: Only use in emergencies. Unpublishing can break dependents.

```bash
# Only for recent publishes (<72 hours)
npm unpublish @mew-protocol/mew@VERSION

# Requires explanation
# npm will ask for confirmation
```

### Deprecate Version

For problematic versions that can't be unpublished:

```bash
# Mark version as deprecated
npm deprecate @mew-protocol/mew@VERSION "Reason for deprecation. Use vX.Y.Z instead."

# Example
npm deprecate @mew-protocol/mew@0.4.5 "Contains critical bug. Use v0.4.6 instead."
```

### Hotfix Release

For critical bugs in production:

1. Create hotfix branch from release tag:
   ```bash
   git checkout -b hotfix/v0.4.6 v0.4.5
   ```

2. Make minimal fix:
   ```bash
   # Fix the bug
   git add .
   git commit -m "fix: critical bug description"
   ```

3. Bump patch version:
   ```bash
   npm version patch --no-git-tag-version
   ```

4. Follow normal release process (build, publish, tag)

5. Merge back to main:
   ```bash
   git checkout main
   git merge hotfix/v0.4.6
   git push origin main
   ```

## Release Checklist

Use this checklist for each release:

- [ ] All changes committed and pushed
- [ ] Tests passing (`./e2e/run-all-tests.sh`)
- [ ] Linting passing (`npm run lint`)
- [ ] Changelog updated with changes
- [ ] Version bumped in package.json
- [ ] Clean build completed (`npm run clean && npm run build`)
- [ ] Version commit pushed to main
- [ ] Package published to npm
- [ ] Publication verified on npm
- [ ] Git tag created and pushed
- [ ] Installation tested in clean environment
- [ ] Changelog date updated
- [ ] Documentation updated
- [ ] Release announced (GitHub release, etc.)

## Future Improvements

Consider implementing:
1. **Automated releases** via CI/CD (GitHub Actions)
2. **Release notes generation** from git commits
3. **Pre-release versions** (alpha, beta, rc)
4. **Automated version bumping** based on conventional commits
5. **Changelog generation** from commit messages

---

**Note**: This release process ensures that the MEW Protocol package is published correctly and tested before being made available to users.
