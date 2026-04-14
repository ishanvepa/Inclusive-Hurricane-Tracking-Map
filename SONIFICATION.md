# Hurricane Sonification Integration

## Overview
The hurricane sonification feature converts storm data into audio, allowing users to "hear" the intensity and movement of Hurricane Michael as they navigate through the visualization.

## Features

### Audio Mapping
- **Wind Speed** → Pitch and speed of woodwind-like notes (higher/faster winds = more rapid, higher-pitched notes)
- **Pressure** → Low drone intensity (lower pressure = lower, more ominous pitch with extra "growl" below 950 mb)
- **Category** → Brass warning motifs (Cat 0-5 with increasing complexity and volume)
- **Longitude** → Stereo panning (storm moves left-to-right in headphones)
- **Latitude** → High-pass filter modulation (brightness changes with north/south movement)

### User Controls

#### Sonification Button
Located in the taskbar, opens a popup with controls:

1. **Auto-play checkbox** (default: ON)
   - When enabled, plays audio automatically when you select a different time point
   - Great for exploring the storm's evolution step-by-step

2. **Play Current Point** button
   - Manually trigger audio for the currently selected time
   - Useful when auto-play is off

3. **Play Full Sequence** button
   - Plays through all time points in sequence (800ms per point)
   - Click again to stop the sequence
   - Watch and listen as the entire storm unfolds

### Integration Points

#### Time Dropdown
- Selecting any time in the dropdown will:
  1. Update the map visualization
  2. Automatically play the audio for that point (if auto-play is enabled)
  
#### Technical Details
- Uses **Tone.js** for Web Audio API synthesis
- Wind data converted from knots to mph for category derivation
- Multiple synthesis voices play simultaneously (strings, woodwinds, brass)
- Reverb and filtering applied for depth and realism

## Files Modified/Created

### New Files
- `sonification.js` - Core audio engine and Tone.js integration
- `SONIFICATION.md` - This documentation

### Modified Files
- `index.html` - Added Tone.js library, sonification button, and popup UI
- `map.js` - Integrated sonification controls and auto-play on time selection

## Usage Examples

### Listen to Storm Intensification
1. Open the time dropdown
2. Select an early time point (e.g., Oct 7, 2018)
3. Step through consecutive times to hear the storm intensify
4. Notice how the pitch drops and volume increases as pressure falls
5. Hear the brass motifs become more complex as category increases

### Play Full Evolution
1. Click the sonification button in the taskbar
2. Click "Play Full Sequence"
3. Watch the map and listen as Michael develops from tropical storm to Category 5
4. Hear the stereo panning as the storm moves from the Yucatan toward Florida

### Explore Specific Moments
1. Disable auto-play checkbox
2. Navigate the map freely using the time dropdown
3. Click "Play Current Point" when you want to hear that specific moment
4. Useful for comparing different time points without continuous audio

## Accessibility
- All controls are keyboard accessible
- Screen reader friendly with proper ARIA labels
- Audio provides an alternative way to perceive intensity changes
- Particularly valuable for visually impaired users

## Future Enhancements
- Volume controls for individual sound layers (strings/woodwinds/brass)
- Export audio as .wav file
- Speed control for sequence playback
- Alternative instrument/sound design options
- Support for other hurricanes/storms
