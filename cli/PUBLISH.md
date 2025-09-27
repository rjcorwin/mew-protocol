# Publishing @mew-protocol/cli to npm

## Version 0.2.1 Release Checklist

### Pre-publish Checklist ✅
- [x] Version bumped to 0.2.1 in package.json
- [x] CHANGELOG.md updated with release notes
- [ ] Changes committed to git
- [ ] Tests passing (note: some existing lint errors in unrelated files)
- [x] Package contents verified with `npm pack --dry-run`

### Publishing Steps

1. **Ensure you're logged in to npm:**
   ```bash
   npm whoami
   # If not logged in:
   npm login
   ```

2. **Verify you have publish access to @mew-protocol scope:**
   ```bash
   npm access ls-packages
   # Should show @mew-protocol/cli
   ```

3. **Do a final dry run:**
   ```bash
   npm pack --dry-run
   ```

   Expected package size: ~45.7 kB
   Expected files: 27 files

4. **Publish to npm:**
   ```bash
   npm publish --access public
   ```

5. **Verify the publish:**
   ```bash
   npm view @mew-protocol/cli@0.2.1
   ```

6. **Create a git tag:**
   ```bash
   git tag cli-v0.2.1
   git push origin cli-v0.2.1
   ```

7. **Push commits to remote:**
   ```bash
   git push origin main
   ```

## What's New in v0.2.1 (Patch Release)

### Bug Fixes
- **Duplicate workspace names**: Fixed npm workspace conflicts when multiple spaces exist in same project
- **Init-to-connect flow**: `mew init` now automatically continues to start and connect the space
- **Port conflicts**: Gateway automatically finds available port when default is in use
- **Space state detection**: Default `mew` command properly detects running spaces

### Improvements
- Template package.json files now use dynamic naming with `{{SPACE_NAME}}` variable
- Better default command behavior with three distinct states
- Seamless onboarding experience for new users

### Future Roadmap
- Phase 2: Tool-specific templates for common operations
- Phase 3: Capability grants with session-level permissions

## Post-Publish

After publishing, update dependent packages if needed:
- Update demos/examples to use the new version
- Update documentation with new features
- Consider announcing the release in relevant channels

## Troubleshooting

If you encounter publish errors:

1. **403 Forbidden**: Check npm login and scope permissions
2. **Version conflict**: Ensure version hasn't been published already
3. **Missing files**: Check .npmignore and package.json files field
4. **Build errors**: Run `npm run lint` and fix any critical errors

## Notes

- The package includes templates directory which is essential for `mew init` functionality
- Package size is reasonable at ~45.7KB compressed