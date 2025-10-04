# Visual Language & Design System

Design principles and visual elements for MEW Protocol CLI.

## Aesthetic Direction

**Pixel Art / Retro Terminal**
- Avoid emojis in favor of ASCII art and Unicode box-drawing characters
- Geometric shapes over organic forms
- Clean, monospace-friendly layouts
- Terminal-native feel

## Character Palette

### Envelope & Message Markers

**Current Implementation:**
- `◆` - Chat messages (filled diamond)
- `◇` - Regular envelopes (hollow diamond)
- `✦` - Thinking/reasoning spinner (twinkling effect)

### Proposal Markers

**Current Implementation:**
- `╔╗ Proposal:` - top corners (pixel art box frame aesthetic)

**Alternative options for consideration:**

**Geometric shapes:**
- `■ Proposal:` - solid square
- `▪ Proposal:` - small solid square
- `▸ Proposal:` - right-pointing triangle
- `► Proposal:` - filled arrow
- `⬢ Proposal:` - hexagon

**ASCII/text-based:**
- `[P] Proposal:` - bracketed P
- `>> Proposal:` - double arrows
- `:: Proposal:` - double colon
- `* Proposal:` - asterisk
- `! Proposal:` - exclamation mark

**Border/frame style:**
- `[◆] Proposal:` - diamond in brackets (consistent with envelope markers)

### Diff Markers

**Current Implementation:**
- `+` - Additions (green)
- `-` - Removals (red)
- `...` - Truncation/omission indicator

### Border Characters

**Current Implementation:**
- `▔` - Top/bottom borders (horizontal bar, full width)
- `╭` `╮` `╰` `╯` - Rounded corners for boxes
- `│` - Vertical borders

### UI Navigation

**Current Implementation:**
- `>` - Selection caret (in proposal confirmation dialog)
- `→` - Direction indicator (participant arrows, action indicators)

### Status Indicators

**Potential additions:**
- `⚠` or `!` - Warning
- `✓` or `√` or `[✓]` - Success/complete
- `✗` or `[✗]` - Error/failed
- `◐` `◓` `◑` `◒` - Loading/progress (quarter circles)
- `⟳` or `↻` - Refresh/retry

### Separators

**Current Implementation:**
- `▔▔▔...` - Full-width separator between messages

**Potential additions:**
- `─────` - Thin separator
- `═════` - Thick separator
- `┄┄┄┄┄` - Dashed separator
- `· · ·` - Dotted separator

## Color Usage

### Message Types
- **Chat content**: White (default)
- **System messages**: Gray
- **Reasoning thoughts**: Cyan
- **Reasoning actions**: Magenta
- **Proposals**: Cyan (bold)
- **Details/metadata**: Gray (dimmed)

### Diff Colors
- **Additions**: Green (bright)
- **Removals**: Red (bright)
- **Context/omissions**: Gray

### UI Elements
- **Borders**: Theme-dependent
  - Chat messages: Magenta (or theme chatBorder)
  - Input box: Cyan (or theme inputBorder)
  - Proposal dialog: Yellow
  - Content boxes: Gray

### Interactive Elements
- **Selected option**: No inverse/highlight, just `>` caret
- **Disabled elements**: Gray, dimmed
- **Active/focused**: No special treatment (caret indicates selection)

## Box Drawing Characters

### Single Line
```
┌─┬─┐  ╭─┬─╮
│ │ │  │ │ │
├─┼─┤  ├─┼─┤
│ │ │  │ │ │
└─┴─┘  ╰─┴─╯
```

### Double Line
```
╔═╦═╗
║ ║ ║
╠═╬═╣
║ ║ ║
╚═╩═╝
```

### Mixed/Heavy
```
┏━┳━┓
┃ ┃ ┃
┣━╋━┫
┃ ┃ ┃
┗━┻━┛
```

## Animation Patterns

### Spinner Sequences

**Thinking/Reasoning (current):**
```
· → ◇ → ◈ → ◆ → ✦ → ◆ → ◈ → ◇
```
200ms interval, diamond twinkling effect

**Alternative spinner ideas:**
```
⠋ → ⠙ → ⠹ → ⠸ → ⠼ → ⠴ → ⠦ → ⠧ → ⠇ → ⠏   (braille dots)
◐ → ◓ → ◑ → ◒                           (quarter circles)
▖ → ▘ → ▝ → ▗                           (quadrants)
⣾ → ⣽ → ⣻ → ⢿ → ⡿ → ⣟ → ⣯ → ⣷           (braille spinner)
```

## Typography

### Headers
- **Bold** for emphasis (proposal titles, headers)
- Regular weight for body text
- No italic (not always monospace-safe)

### Hierarchy
1. **Bold + Color** - Primary headers (e.g., `📋 Proposal: Edit file`)
2. **Color only** - Section labels (e.g., `File: /path/to/file`)
3. **Gray** - Metadata, hints (e.g., "scroll up to see details")
4. **Default** - Body content

## Layout Patterns

### Message Structure
```
◇ participant → envelope-kind
      Content indented 6 spaces
      Multiple lines maintain indent
```

### Proposal Structure
```
◇ mew → mcp/proposal

      ╔╗ Proposal: Tool name
      File: /path/to/file
      Metadata...

      ╭───────────────────╮
      │ Diff or content   │
      │ ...               │
      ╰───────────────────╯
```

### Dialog Structure
```
╭────────────────────────────────────────╮
│ participant → method (tool)            │
│ (scroll up to see proposal envelope)   │
│   1=Yes                                │
│   2=Grant                              │
│   3=No                                 │
╰────────────────────────────────────────╯
```

### Full-Width Elements
```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
◆ you →
message content

▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
```

## Implementation Notes

- All visual elements should work in monospace terminals
- Test with various terminal color schemes (light/dark)
- Maintain consistent spacing (6-space indent for content)
- Use theme system for customizable colors
- Avoid Unicode characters that might not render in all terminals (stick to widely-supported sets)

## Future Considerations

- **Badges/Tags**: For message metadata (e.g., `[APPROVED]`, `[DENIED]`)
- **Progress bars**: For long-running operations
- **Trees/Hierarchies**: For file structures or nested data
- **Tables**: For structured data display
- **Graphs**: ASCII art graphs for metrics/stats
