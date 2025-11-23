# MEW Protocol Release Guide

This guide covers the complete process for releasing MEW Protocol to npm.

## Package Information

MEW Protocol is published as a single npm package:
- **Package Name**: `@mew-protocol/mew`
- **Current Version**: Check `package.json` in repository root

## Pre-Release Checklist

### 1. Verify Repository State

```bash
# Ensure all changes are committed
git status

# Ensure you're on the main branch
git branch

# Pull latest changes
git pull origin main
```

### 2. Verify CHANGELOG is Ready

```bash
# Check that CHANGELOG.md has an "Unreleased" section with content
# The release process will convert this to a versioned section
cat CHANGELOG.md | head -50
```

Ensure the "Unreleased" section documents all changes since the last release.

### 3. Determine Version Bump

Based on changes in the "Unreleased" section, decide the version bump:
- **patch** (0.7.0 → 0.7.1): Bug fixes, documentation updates only
- **minor** (0.7.0 → 0.8.0): New features, enhancements, breaking changes (allowed in v0.x)
- **major** (0.7.0 → 1.0.0): First stable release

```bash
# Check current version
node -p "require('./package.json').version"

# See commits since last release tag
CURRENT_VERSION=$(node -p "require('./package.json').version")
git log --oneline "v${CURRENT_VERSION}..HEAD"
```

### 4. Run Tests and Quality Checks

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

### 5. Check npm Authentication

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

### 6. Review Package Contents

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

**Important**: This process creates a single atomic commit with CHANGELOG + version bump, creates a local tag, publishes to npm, and only pushes if publishing succeeds. This ensures the repository stays consistent with npm.

### Step 1: Update CHANGELOG

Convert the "Unreleased" section to a versioned release with today's date:

```bash
# Get today's date in YYYY-MM-DD format
RELEASE_DATE=$(date +%Y-%m-%d)

# Determine the new version (example for minor bump)
NEW_VERSION="0.8.0"  # Replace with your target version

# Edit CHANGELOG.md:
# 1. Change "## [Unreleased]" to "## [Unreleased]\n\n## [${NEW_VERSION}] - ${RELEASE_DATE}"
# 2. Move all content under Unreleased to the new version section
# 3. Leave Unreleased section empty for future changes

# Manual edit required - open in your editor
$EDITOR CHANGELOG.md
```

Example transformation:
```markdown
# Before:
## [Unreleased]

### Added
- New feature X

### Fixed
- Bug Y

## [0.7.0] - 2025-11-08

# After:
## [Unreleased]

## [0.8.0] - 2025-11-23

### Added
- New feature X

### Fixed
- Bug Y

## [0.7.0] - 2025-11-08
```

### Step 2: Version Bump

```bash
# Bump version (choose one based on Step 3 of pre-release checklist)
npm version patch --no-git-tag-version  # For bug fixes (0.7.0 → 0.7.1)
npm version minor --no-git-tag-version  # For new features (0.7.0 → 0.8.0)
npm version major --no-git-tag-version  # For stable release (0.7.0 → 1.0.0)

# This updates package.json and package-lock.json
```

### Step 3: Build for Release

```bash
# Clean build
npm run clean
npm run build

# Verify build succeeded
ls -la dist/
```

### Step 4: Commit CHANGELOG + Version (Atomic)

```bash
# Stage both CHANGELOG and version files
git add CHANGELOG.md package.json package-lock.json

# Get the new version for commit message
VERSION=$(node -p "require('./package.json').version")

# Create atomic commit
git commit -m "chore: release v${VERSION}

Updated CHANGELOG.md and bumped version to ${VERSION}.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# DO NOT PUSH YET - wait until npm publish succeeds
```

### Step 5: Create Local Git Tag

```bash
# Get the version from package.json
VERSION=$(node -p "require('./package.json').version")

# Create annotated tag locally (don't push yet)
git tag -a "v${VERSION}" -m "Release v${VERSION}"

# Verify tag was created
git tag -l "v${VERSION}"
```

### Step 6: Publish to npm

```bash
# Have your npm OTP ready (from authenticator app)

# Publish the package
npm publish --access public --otp=YOUR_OTP_HERE

# Replace YOUR_OTP_HERE with your 6-digit OTP code
```

**Note**: If publish fails, you can safely reset:
```bash
# Reset the commit and tag
git reset --hard HEAD~1
git tag -d "v${VERSION}"

# Fix the issue and try again
```

### Step 7: Push Commit and Tag (Only After Successful Publish)

```bash
# If npm publish succeeded, push both commit and tag
VERSION=$(node -p "require('./package.json').version")
git push origin main
git push origin "v${VERSION}"
```

**Important**: Only push after npm publish succeeds. This keeps the repository in sync with npm.

## Post-Release Tasks

### 1. Verify Publication

```bash
# Check the package on npm
npm view @mew-protocol/mew

# Verify the latest version matches what you just published
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
VERSION=$(cd /Users/rj/Git/rjcorwin/mew-protocol && node -p "require('./package.json').version")
npm install -g @mew-protocol/mew@${VERSION}

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

### 3. Create GitHub Release

```bash
# Get the version
VERSION=$(node -p "require('./package.json').version")

# Extract release notes from CHANGELOG.md for this version
# You can use gh CLI to create a release with notes

gh release create "v${VERSION}" \
  --title "MEW Protocol v${VERSION}" \
  --notes "See CHANGELOG.md for details" \
  --verify-tag
```

Or create manually at: https://github.com/rjcorwin/mew-protocol/releases/new

### 4. Update Documentation (if needed)

Update any documentation that references specific versions:

```bash
# Check for hardcoded version references
grep -r "0.7.0" README.md docs/

# Update as needed
git add README.md docs/
git commit -m "docs: update version references for v${VERSION}"
git push origin main
```

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
# If you haven't pushed yet, reset and bump again
git reset --hard HEAD~1
git tag -d "v${VERSION}"
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

**Publish Succeeded but Push Failed**
```bash
# If npm publish worked but git push failed, just retry the push
VERSION=$(node -p "require('./package.json').version")
git push origin main
git push origin "v${VERSION}"
```

**Need to Rollback After Publishing**
```bash
# You cannot unpublish after 72 hours or if others depend on it
# Instead, publish a new patch version with the fix

# If within 72 hours and no dependents:
npm unpublish @mew-protocol/mew@VERSION

# Then reset git state
git reset --hard HEAD~1
git tag -d "v${VERSION}"
git push origin main --force
git push origin :refs/tags/v${VERSION}  # Delete remote tag
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

1. **Patch releases (0.7.x)**:
   - Bug fixes only
   - Documentation updates
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
   - Breaking changes only in major versions

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
npm deprecate @mew-protocol/mew@0.7.5 "Contains critical bug. Use v0.7.6 instead."
```

### Hotfix Release

For critical bugs in production:

1. Create hotfix branch from release tag:
   ```bash
   git checkout -b hotfix/v0.7.6 v0.7.5
   ```

2. Make minimal fix:
   ```bash
   # Fix the bug
   git add .
   git commit -m "fix: critical bug description"
   ```

3. Follow normal release process starting from Step 1 (update CHANGELOG)

4. Merge back to main:
   ```bash
   git checkout main
   git merge hotfix/v0.7.6
   git push origin main
   ```

## Release Checklist

Use this checklist for each release:

- [ ] All changes committed and pushed
- [ ] Tests passing (`./e2e/run-all-tests.sh`)
- [ ] Linting passing (`npm run lint`)
- [ ] CHANGELOG.md "Unreleased" section has content
- [ ] Determined version bump (patch/minor/major)
- [ ] Updated CHANGELOG.md with version and date
- [ ] Version bumped in package.json
- [ ] Clean build completed (`npm run clean && npm run build`)
- [ ] Atomic commit created (CHANGELOG + version files)
- [ ] Local git tag created
- [ ] Package published to npm successfully
- [ ] Commit and tag pushed to GitHub
- [ ] Publication verified on npm
- [ ] Installation tested in clean environment
- [ ] GitHub release created
- [ ] Documentation updated (if needed)

## Future Improvements

Consider implementing:
1. **Automated releases** via CI/CD (GitHub Actions)
2. **Release notes generation** from git commits
3. **Pre-release versions** (alpha, beta, rc)
4. **Automated version bumping** based on conventional commits
5. **Changelog generation** from commit messages

---

**Note**: This release process ensures that the MEW Protocol package is published correctly and tested before being made available to users. The atomic commit + local tag + publish-first approach keeps the repository in sync with npm and allows easy rollback if publishing fails.
