#!/usr/bin/env python3
"""
Ship Frame Renderer for MEW World

Renders 64 rotation frames of a ship model from Blender.
Designed to be run in Blender's background mode.

Usage:
    blender assets/blender/ship1.blend --background --python scripts/render-ship-frames.py

Requirements:
    - Blender installed
    - ship1.blend file with object named "Ship"
    - Output directory exists (assets/sprites/ship_frames/)
"""

import bpy
import math
import os
import sys

# Configuration
SHIP_OBJECT_NAME = "Ship"
OUTPUT_DIR = "assets/sprites/ship_frames"
NUM_FRAMES = 64
RESOLUTION = 128

def setup_scene():
    """Configure render settings for sprite output"""
    scene = bpy.context.scene

    # Resolution
    scene.render.resolution_x = RESOLUTION
    scene.render.resolution_y = RESOLUTION
    scene.render.resolution_percentage = 100

    # Transparent background
    scene.render.film_transparent = True

    # Output format
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 15

    print(f"✓ Scene configured: {RESOLUTION}x{RESOLUTION}, transparent PNG")

def find_ship_object():
    """Find and return the Ship object"""
    ship = bpy.data.objects.get(SHIP_OBJECT_NAME)

    if not ship:
        print(f"✗ ERROR: No object named '{SHIP_OBJECT_NAME}' found!")
        print(f"  Available objects: {[obj.name for obj in bpy.data.objects]}")
        sys.exit(1)

    print(f"✓ Found ship object: {SHIP_OBJECT_NAME}")
    return ship

def create_output_directory():
    """Ensure output directory exists"""
    # Get absolute path relative to blend file location
    blend_dir = os.path.dirname(bpy.data.filepath)
    output_path = os.path.join(blend_dir, "..", OUTPUT_DIR)
    output_path = os.path.abspath(output_path)

    os.makedirs(output_path, exist_ok=True)
    print(f"✓ Output directory: {output_path}")

    return output_path

def render_rotation_frames(ship, output_path):
    """Render ship at 64 rotation angles"""
    scene = bpy.context.scene

    print(f"\nRendering {NUM_FRAMES} frames...")
    print("━" * 50)

    # Store original rotation
    original_rotation = ship.rotation_euler.copy()

    # Render each rotation
    for i in range(NUM_FRAMES):
        # Calculate rotation angle (rotate around Z axis)
        angle_degrees = i * (360.0 / NUM_FRAMES)
        angle_radians = math.radians(angle_degrees)

        # Set ship rotation
        ship.rotation_euler[2] = angle_radians

        # Update scene
        bpy.context.view_layer.update()

        # Set output file path
        filename = f"ship_{i:03d}.png"
        filepath = os.path.join(output_path, filename)
        scene.render.filepath = filepath

        # Render
        bpy.ops.render.render(write_still=True)

        # Progress indicator
        progress = (i + 1) / NUM_FRAMES * 100
        bar_length = 30
        filled = int(bar_length * (i + 1) / NUM_FRAMES)
        bar = "█" * filled + "░" * (bar_length - filled)

        print(f"[{bar}] {progress:5.1f}% | Frame {i+1:2d}/{NUM_FRAMES} | {angle_degrees:6.2f}° | {filename}")

    # Restore original rotation
    ship.rotation_euler = original_rotation

    print("━" * 50)
    print(f"✓ Rendered {NUM_FRAMES} frames successfully!")

def main():
    """Main rendering pipeline"""
    print("\n" + "=" * 50)
    print("MEW World Ship Frame Renderer")
    print("=" * 50 + "\n")

    # Verify blend file is loaded
    if not bpy.data.filepath:
        print("✗ ERROR: No blend file loaded!")
        print("  Run with: blender ship1.blend --background --python render-ship-frames.py")
        sys.exit(1)

    print(f"✓ Blend file: {bpy.data.filepath}")

    # Setup
    setup_scene()
    ship = find_ship_object()
    output_path = create_output_directory()

    # Render
    render_rotation_frames(ship, output_path)

    # Summary
    print("\n" + "=" * 50)
    print("Rendering Complete!")
    print("=" * 50)
    print(f"Output: {output_path}")
    print(f"Frames: ship_000.png - ship_063.png")
    print("\nNext step: Run assemble-sprite-sheet.sh")
    print("=" * 50 + "\n")

if __name__ == "__main__":
    main()
