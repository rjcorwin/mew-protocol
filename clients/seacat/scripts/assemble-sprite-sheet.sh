#!/bin/bash

##
# Ship Sprite Sheet Assembler for MEW World
#
# Combines 64 individual ship rotation frames into a single 8x8 sprite sheet.
#
# Usage:
#   ./scripts/assemble-sprite-sheet.sh
#
# Requirements:
#   - ImageMagick installed (brew install imagemagick)
#   - 64 PNG files in assets/sprites/ship_frames/ (ship_000.png - ship_063.png)
#
# Output:
#   - assets/sprites/ship1.png (1024x1024, 8x8 grid)
##

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRAMES_DIR="assets/sprites/ship_frames"
OUTPUT_FILE="assets/sprites/ship1.png"
GRID_SIZE="8x8"
FRAME_SIZE="128x128"
NUM_FRAMES=64

echo ""
echo "=================================================="
echo "MEW World Ship Sprite Sheet Assembler"
echo "=================================================="
echo ""

# Check ImageMagick installation
if ! command -v magick &> /dev/null && ! command -v montage &> /dev/null; then
    echo -e "${RED}✗ ERROR: ImageMagick not found!${NC}"
    echo ""
    echo "Install with: brew install imagemagick"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} ImageMagick found"

# Determine ImageMagick command (v6 vs v7)
if command -v magick &> /dev/null; then
    MONTAGE_CMD="magick montage"
else
    MONTAGE_CMD="montage"
fi

# Check frames directory exists
if [ ! -d "$FRAMES_DIR" ]; then
    echo -e "${RED}✗ ERROR: Frames directory not found: $FRAMES_DIR${NC}"
    echo ""
    echo "Run render-ship-frames.py first to generate frames."
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} Frames directory: $FRAMES_DIR"

# Count frames
FRAME_COUNT=$(ls -1 "$FRAMES_DIR"/ship_*.png 2>/dev/null | wc -l | tr -d ' ')

if [ "$FRAME_COUNT" -eq 0 ]; then
    echo -e "${RED}✗ ERROR: No frames found in $FRAMES_DIR${NC}"
    echo ""
    echo "Run render-ship-frames.py first to generate frames."
    echo ""
    exit 1
fi

if [ "$FRAME_COUNT" -ne "$NUM_FRAMES" ]; then
    echo -e "${YELLOW}⚠ WARNING: Expected $NUM_FRAMES frames, found $FRAME_COUNT${NC}"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} Found $FRAME_COUNT frames"

# Create output directory if needed
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Assemble sprite sheet
echo ""
echo "Assembling sprite sheet..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

$MONTAGE_CMD "$FRAMES_DIR"/ship_*.png \
    -tile $GRID_SIZE \
    -geometry ${FRAME_SIZE}+0+0 \
    -background none \
    "$OUTPUT_FILE"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ ERROR: Sprite sheet assembly failed!${NC}"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓${NC} Sprite sheet created successfully!"

# Get file size
FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

# Get image dimensions
if command -v magick &> /dev/null; then
    DIMENSIONS=$(magick identify -format "%wx%h" "$OUTPUT_FILE")
else
    DIMENSIONS=$(identify -format "%wx%h" "$OUTPUT_FILE")
fi

# Summary
echo ""
echo "=================================================="
echo "Sprite Sheet Complete!"
echo "=================================================="
echo "Output:      $OUTPUT_FILE"
echo "Dimensions:  $DIMENSIONS"
echo "File size:   $FILE_SIZE"
echo "Grid:        $GRID_SIZE (${NUM_FRAMES} frames)"
echo "Frame size:  $FRAME_SIZE"
echo ""

# Optional: Cleanup prompt
echo -e "${YELLOW}Cleanup:${NC}"
echo "Individual frames are still in: $FRAMES_DIR"
echo ""
read -p "Delete individual frames? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$FRAMES_DIR"
    echo -e "${GREEN}✓${NC} Cleaned up individual frames"
else
    echo -e "${BLUE}ℹ${NC} Keeping individual frames for debugging"
fi

echo ""
echo "=================================================="
echo "Next Steps:"
echo "=================================================="
echo "1. View sprite sheet: open $OUTPUT_FILE"
echo "2. Rebuild client:    npm run build"
echo "3. Test in game:      npm start"
echo "=================================================="
echo ""
