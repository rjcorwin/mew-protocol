# Sound Effects for Seacat Combat System

This directory should contain 5 sound effect files for the ship combat system (Phase 5: c5x-ship-combat).

## Required Sound Files

The game expects these files to be present:

1. **cannon-fire.mp3** - Deep cannon boom sound (1-2 seconds)
2. **hit-impact.mp3** - Wood crack/rumble when cannonball hits ship (0.5-1 second)
3. **water-splash.mp3** - Splash when cannonball hits water (1 second)
4. **ship-sinking.mp3** - Creaking wood + bubbling water (5 seconds, will loop)
5. **ship-respawn.mp3** - Triumphant chime or horn (1-2 seconds)

## Where to Find Free Sound Effects

### Recommended Free Sources:

**Pixabay** (https://pixabay.com/sound-effects/)
- Royalty-free, no attribution required
- Search terms: "cannon", "artillery", "water splash", "ship creak", "respawn"
- Format: MP3 download available

**Freesound.org** (https://freesound.org/)
- Creative Commons licensed sounds
- Massive library of user-contributed sounds
- Requires free account for downloads

**OpenGameArt.org** (https://opengameart.org/)
- Game-focused sound effects
- Various Creative Commons licenses
- Good for game-specific sounds like respawns

**ZapSplat** (https://www.zapsplat.com/)
- Free sound effects with account
- Professional quality
- Good ship/nautical sounds

**Uppbeat** (https://uppbeat.io/sfx/)
- Free for creator use
- Good water and weapon sounds

## Download Instructions

1. Visit any of the sources above
2. Search for the sound types needed (cannon, splash, etc.)
3. Download MP3 format (preferred) or OGG
4. Rename files to match the exact names listed above
5. Place in this directory (`clients/seacat/assets/sounds/`)
6. Rebuild the game: `npm run build`

## File Requirements

- **Format**: MP3 or OGG (MP3 preferred for compatibility)
- **Size**: Keep under 500KB each for fast loading
- **Quality**: 44.1kHz sample rate recommended
- **Length**: Follow duration guidelines above

## Volume Levels

The game uses these default volume settings:
- Cannon fire: 0.5 (50%)
- Hit impact: 0.6 (60%)
- Water splash: 0.4 (40%)
- Ship sinking: 0.5 (50%, loops)
- Ship respawn: 0.7 (70%)

Adjust source audio levels accordingly to avoid clipping.

## Testing Without Sounds

If sound files are missing, the game will log errors but should still load and play. However, the combat experience will be significantly diminished without audio feedback.

To test without real sounds, you can create silent placeholder files using:
```bash
# Requires ffmpeg installed
ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -q:a 9 -acodec libmp3lame cannon-fire.mp3
# Repeat for each file...
```

## License Considerations

- Ensure downloaded sounds are licensed for your use case (commercial/non-commercial)
- Check if attribution is required
- Keep copies of license information
- Some Creative Commons licenses require attribution in your project credits
