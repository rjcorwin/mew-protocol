# Specification Guide

This guide explains how to create and maintain specifications for any component in the repository.

## Universal Specification Structure

Any folder can have a `spec/` directory following this structure:

```
[any-folder]/
├── spec/
│   ├── draft/           # Current work in progress
│   │   ├── decisions/
│   │   │   ├── proposed/    # ADRs under consideration
│   │   │   ├── accepted/    # Approved ADRs
│   │   │   └── rejected/    # Rejected ADRs
│   │   ├── SPEC.md         # Draft specification
│   │   └── PATTERNS.md     # Draft patterns (optional)
│   └── [version]/          # Released versions
│       ├── decisions/      # Frozen ADRs
│       │   ├── accepted/
│       │   └── rejected/
│       ├── SPEC.md
│       └── PATTERNS.md
└── ... (other files)
```

## Version Naming Conventions

Choose the versioning scheme that makes sense for your component:

| Version Format | Examples | Use When |
|----------------|----------|----------|
| `v[major]` | `v0`, `v1`, `v2` | Simple major versions only |
| `v[major].[minor]` | `v1.0`, `v2.1` | Need minor versions |
| `v[major].[minor].[patch]` | `v1.0.0`, `v2.1.3` | Full semantic versioning |
| `v[date]` | `v2025.08`, `v2025.09` | Time-based releases |
| `v[number]` | `v1`, `v2`, `v3` | Simple incrementing |

## Creating a Specification

### Step 1: Initialize Draft

```bash
# For any component
mkdir -p [component]/spec/draft/decisions/{proposed,accepted,rejected}

# Create SPEC.md using the template below
edit [component]/spec/draft/SPEC.md
```

### Step 2: Work in Draft

- All active development happens in `draft/`
- ADRs move through proposed → accepted/rejected
- SPEC.md is continuously updated
- No version number yet

### Step 3: Release a Version

**Important:** Before releasing, ensure all ADRs are fully incorporated into the spec:
1. Incorporate each ADR into SPEC.md
2. Update ADR incorporation field to "Complete"
3. Move ADR from `proposed/` to `accepted/` or `rejected/`
4. Update ADR status field accordingly

```bash
# When ready to release
VERSION="v1.0.0"  # or "v1" or whatever scheme you chose

# Copy draft to version
cp -r [component]/spec/draft [component]/spec/$VERSION

# Update spec header to remove "Draft" status
# Update version number throughout

# Clean up - proposed folder should already be empty
rm -rf [component]/spec/$VERSION/decisions/proposed

# Tag in git (if applicable)
git tag [component]@$VERSION
```

### Step 4: Continue Development

After release, either:
- Clear draft for next major version
- Continue evolving draft for next release
- Start parallel draft for breaking changes

## ADR Process

ADRs work the same way everywhere:

1. **Create**: New ADR in `draft/decisions/proposed/`
2. **Review**: Discuss and refine
3. **Implement**: Incorporate into SPEC.md (must happen BEFORE accepting)
4. **Accept/Reject**: 
   - If accepting: Update incorporation to "Complete", then move to `accepted/`
   - If rejecting: Add rejection rationale, then move to `rejected/`
5. **Release**: Included in next version

### ADR Template

```markdown
# ADR-[ID]: [Title]

**Status:** [Proposed|Accepted|Rejected]
**Date:** [YYYY-MM-DD]
**Incorporation:** [Not Incorporated|Partial|Complete]

## Context

[What is the issue we're addressing?]
[Why does this decision need to be made now?]
[What constraints exist?]

## Options Considered

### Option 1: [Name]
[Description]

**Pros:**
- [Advantage]
- [Advantage]

**Cons:**
- [Disadvantage]
- [Disadvantage]

### Option 2: [Name]
[Description]

**Pros:**
- [Advantage]
- [Advantage]

**Cons:**
- [Disadvantage]
- [Disadvantage]

## Decision

[Which option was chosen and why]

### Implementation Details
[How this will be implemented]

## Consequences

### Positive
- [Good outcome]
- [Good outcome]

### Negative
- [Tradeoff or downside]
- [Tradeoff or downside]
```

### ADR Naming

**Filename:** `[number]-[id]-[descriptive-name].md`
- Number: Sequential (001, 002, etc.)
- ID: Unique 3-character identifier (e.g., x7k, a3b)
- Name: Kebab-case description

**Example:** `001-x7k-api-versioning-strategy.md`

## Examples

### Example 1: Simple Version
```
[any-folder]/
└── spec/
    ├── draft/
    └── v1/      # Simple version
```

### Example 2: Semantic Version
```
[any-folder]/
└── spec/
    ├── draft/
    └── v2.0.0/  # Semver version
```

### Example 3: Date-Based Version
```
[any-folder]/
└── spec/
    ├── draft/
    └── v2025.08/  # Date-based version
```

### Example 4: Multiple Versions
```
[any-folder]/
└── spec/
    ├── draft/     # Current work
    ├── v1.0/      # First release
    ├── v1.1/      # Minor update
    └── v2.0/      # Major update
```

### Example 5: With Decisions
```
[any-folder]/
└── spec/
    ├── draft/
    │   ├── decisions/
    │   │   ├── proposed/
    │   │   ├── accepted/
    │   │   └── rejected/
    │   └── SPEC.md
    └── v1/
        ├── decisions/
        │   ├── accepted/
        │   └── rejected/
        └── SPEC.md
```

## What Goes in a Spec?

Use the template below as a starting point, but adapt based on what you're specifying:

### Always Include
- **Purpose**: What this component does
- **Scope**: What it covers and doesn't cover
- **API/Interface**: How others interact with it
- **Dependencies**: What it needs to work

### Include When Relevant
- **Architecture**: For complex components
- **Configuration**: For configurable components
- **Security**: For components with security implications
- **Performance**: For performance-critical components
- **Testing**: For components with specific test requirements
- **Migration**: When changing from previous versions

## Specification Lifecycle

### 1. No Spec → Draft
When starting to formalize a component

### 2. Draft → v1
First formal release

### 3. v1 → Draft → v2
Major changes requiring new version

### 4. Deprecation
Mark old versions as deprecated but keep for reference

## Best Practices

### DO
- ✅ Keep draft separate from releases
- ✅ Use consistent versioning within a component
- ✅ Incorporate ADRs into spec BEFORE moving to accepted
- ✅ Ensure proposed folder is empty before release
- ✅ Track decisions with ADRs
- ✅ Update SPEC.md as ADRs are incorporated
- ✅ Link to related specifications
- ✅ Update CHANGELOG.md for each release

### DON'T
- ❌ Edit released specifications
- ❌ Mix versioning schemes in one component
- ❌ Skip the draft phase
- ❌ Have proposed ADRs in released versions
- ❌ Move ADRs to accepted before incorporating them
- ❌ Change specs without ADRs

## Quick Reference

### Directory Creation
```bash
# Create spec structure anywhere
mkdir -p $COMPONENT/spec/draft/decisions/{proposed,accepted,rejected}
```

### Version Release
```bash
# Ensure all ADRs are incorporated first!
# Proposed folder should already be empty

# Release a version
cp -r $COMPONENT/spec/draft $COMPONENT/spec/$VERSION

# Verify proposed is empty (should be)
rm -rf $COMPONENT/spec/$VERSION/decisions/proposed

# Update spec header to finalize version
```

### ADR Creation
```bash
# Create new ADR
echo "# ADR-$ID: Title" > $COMPONENT/spec/draft/decisions/proposed/$NUM-$ID-name.md
```

## Release Documentation

Each component should maintain:

### CHANGELOG.md
Track all changes between versions:
```markdown
## [v2.0] - 2025-01-03
### Added
- New feature X
### Changed
- Breaking change Y
### Fixed
- Bug Z
```

### RELEASING.md (Optional)
Document the release process if it differs from this guide.

## Integration

Specifications can reference each other:

```markdown
## Dependencies
This component implements:
- [Protocol v1](../protocol-spec/spec/v1/SPEC.md)
- [Client API v2.0.0](../packages/client/spec/v2.0.0/SPEC.md)
```

## Generic Specification Template

Here's a simple template to start with. Adapt sections based on what you're specifying:

```markdown
# [Component Name] Specification

**Version:** [draft or version number]  
**Status:** [Draft|Alpha|Beta|Stable]  
**Last Updated:** [YYYY-MM-DD]

## Overview

[What this component does and why it exists]

## Scope

[What this covers and what it doesn't]

## Architecture

[How it's structured - diagrams, components, data flow]

## Interface

[How others interact with this - API, commands, protocols]

## Configuration

[Any configuration options or settings]

## Dependencies

[What this needs to work]

## Security Considerations

[Security implications and mitigations]

## Examples

[Usage examples and patterns]

## References

[Links to related specs, documentation, or standards]
```

### Customizing the Template

Add sections as needed:
- **Error Handling** - For components with specific error patterns
- **Performance** - For performance-critical components  
- **Testing** - For components with specific test requirements
- **Migration** - When changing from previous versions
- **Patterns** - Common usage patterns (can be separate PATTERNS.md)

Remove sections that don't apply - keep it focused and relevant.

## Questions?

This guide provides a universal specification structure that can be applied to any component. Adapt the templates and process to fit your specific needs.