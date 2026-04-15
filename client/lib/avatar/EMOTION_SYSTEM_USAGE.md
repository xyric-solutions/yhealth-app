# Enhanced Emotion System Usage Guide

## Overview

The VRM avatar now features an enhanced emotion system with:

- **16 base emotions** (up from 6)
- **Micro-expressions** - Brief 200-500ms emotional flashes during conversation
- **Multi-expression blending** - Emotions can be blended for complex states
- **Emotion-specific breathing** - Breathing rate and depth vary by emotion
- **Enhanced body movements** - Head tilts, nods, posture shifts
- **Contextual gesture triggers** - Automatic micro-expressions during speaking/listening/thinking

## Available Emotions

### Basic Emotions
- `neutral` - Baseline state
- `happy` - Joy, contentment
- `sad` - Sorrow, disappointment
- `angry` - Frustration, irritation
- `relaxed` - Calm, at ease
- `surprised` - Shock, amazement

### Complex Emotions (New)
- `curiosity` - Inquisitive, interested
- `concern` - Worried, caring
- `confusion` - Puzzled, uncertain
- `disgust` - Disapproval, aversion
- `fear` - Anxious, afraid
- `embarrassment` - Self-conscious, awkward
- `excitement` - Enthusiastic, eager
- `empathy` - Understanding, compassionate
- `contemplation` - Thoughtful, reflective
- `determination` - Resolute, focused

## Usage in Components

### Setting Emotion from Chat

```typescript
import { useVoiceAssistant } from "@/app/context/VoiceAssistantContext";

const { setUserMood } = useVoiceAssistant();

// When user expresses confusion
setUserMood("confused");
// Avatar will automatically map to 'confusion' expression
```

### Direct Emotion Control

```typescript
// Access the emotion via the imperative handle
avatarRef.current?.setEmotion("concern", 0.8);

// Set emotion with confidence (for backend emotion detection)
avatarRef.current?.setEmotionFromBackend("concern", 0.9);
```

### Context-Aware Micro-Expressions

The system automatically triggers micro-expressions based on conversation state:

```typescript
// During speaking - occasional emphasis flashes
if (currentState === "speaking" && Math.random() < 0.01) {
  microEngine.trigger("emphasizing", emotion, elapsed * 1000);
}

// During listening - attentive acknowledgments
if (currentState === "listening" && Math.random() < 0.005) {
  microEngine.trigger("listening", emotion, elapsed * 1000);
}

// During thinking - contemplative moments
if (currentState === "thinking" && Math.random() < 0.008) {
  microEngine.trigger("transitioning", emotion, elapsed * 1000);
}
```

## Emotion Modulation Parameters

Each emotion defines:

| Parameter | Description |
|-----------|-------------|
| `amplitudeScale` | Animation movement intensity |
| `frequencyScale` | Animation speed |
| `postureLean` | Forward/backward spine tilt (radians) |
| `shoulderOffset` | Shoulder raise/drop (radians) |
| `headTilt` | Head tilt left/right (radians) |
| `headNod` | Head nod up/down (radians) |
| `blinkInterval` | [min, max] seconds between blinks |
| `doubleBlinkProb` | Chance of double-blink (0-1) |
| `saccadeInterval` | Eye movement frequency [min, max] |
| `saccadeAmplitude` | Eye movement range [min, max] degrees |
| `fingerCurlOffset` | Hand curl amount (radians) |
| `gestureScale` | Speaking gesture size |
| `gestureSpeed` | Speaking gesture speed |
| `breathingRate` | Breaths per second multiplier |
| `breathingDepth` | Breath amplitude multiplier |
| `microExpressionProb` | Chance of micro-expression (0-1) |
| `bodyTension` | Stiffness of movements (0-1) |

## Example: Fear vs Relaxed

### Fear
```typescript
{
  amplitudeScale: 0.5,    // Small movements
  frequencyScale: 1.3,    // Fast, jittery
  postureLean: -0.01,     // Slight back lean
  blinkInterval: [1, 2.5], // Rapid blinking
  saccadeInterval: [0.2, 0.6], // Darting eyes
  breathingRate: 1.6,     // Rapid breathing
  breathingDepth: 0.5,    // Shallow breaths
  bodyTension: 0.95,      // Very tense
}
```

### Relaxed
```typescript
{
  amplitudeScale: 1.1,    // Flowing movements
  frequencyScale: 0.8,    // Slow, smooth
  postureLean: -0.01,     // Back lean
  blinkInterval: [3, 7], // Slow blinking
  saccadeInterval: [1.0, 2.5], // Calm gaze
  breathingRate: 0.8,     // Slow breathing
  breathingDepth: 1.3,    // Deep breaths
  bodyTension: 0.15,      // Loose
}
```

## Adding Custom Micro-Expressions

```typescript
import { MICRO_EXPRESSIONS } from "@/lib/avatar/microExpressions";

// Add custom context
MICRO_EXPRESSIONS.celebration = [
  {
    name: "victory_smile",
    expression: "happy",
    intensity: 0.5,
    durationMs: 600,
    attackSpeed: 0.3,
    releaseSpeed: 0.2,
    weight: 3,
    headOffset: { tilt: 0.02, nod: -0.01 },
  },
];
```

## Performance Notes

- All emotion calculations run in the RAF loop
- Micro-expressions auto-trigger based on state probability
- Emotion blending uses smooth interpolation (1s transition)
- No React re-renders during animation
- Memory efficient: reuses quaternion/euler objects
