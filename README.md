# 🌌 Gesture Galaxy — AI Planet

> An interactive 3D particle-based planet rendered in real-time with WebGL and Three.js, controlled by hand gestures via MediaPipe and animated by live audio analysis.

![Tech Stack](https://img.shields.io/badge/Three.js-0.160.0-00cfff?style=flat-square&logo=threedotjs)
![WebGL](https://img.shields.io/badge/WebGL-GLSL_Shaders-7b2fff?style=flat-square)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Hand_Tracking-ff2fa8?style=flat-square)
![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-Gesture_AI-00ff99?style=flat-square)

---

## ✨ Features

- **Particle Planet** — 18,000 GPU-driven particles forming a dynamic 3D sphere with simplex noise displacement
- **Custom GLSL Shaders** — Separate `planet.vert` / `planet.frag` and `atmosphere.vert` / `atmosphere.frag` for full visual control
- **Audio Reactive** — Bass, mid, and treble frequencies drive particle waves, glow intensity, and scale in real-time
- **Hand Gesture Control** — MediaPipe + TensorFlow.js classifier maps gestures to planet interactions
- **Adaptive Quality** — Auto-scales particle count and pixel ratio to maintain target FPS
- **Starfield Background** — Procedural star field with depth
- **Planetary Rings** — Animated ring system around the planet

---

## 🎮 Gesture Map

| Gesture | Action |
|---|---|
| ✋ Open Hand | Scale Up |
| ✊ Fist | Scale Down |
| 🤏 Pinch | Slow Spin |
| 🔄 Rotate | Fast Spin |
| 🔍 Zoom | Zoom In |

---

## 📁 Project Structure

```
gesture-galaxy/
├── index.html                  # Entry point
├── style.css                   # UI styles
├── shaders/
│   ├── planet.vert             # Planet particle vertex shader
│   ├── planet.frag             # Planet particle fragment shader
│   ├── atmosphere.vert         # Atmosphere vertex shader
│   └── atmosphere.frag         # Atmosphere fragment shader
└── js/
    ├── main.js                 # Orchestrator — scene, loop, UI
    ├── planet.js               # Planet class (particles + shader loading)
    ├── atmosphere.js           # Atmosphere shell rendering
    ├── rings.js                # Planetary ring system
    ├── starfield.js            # Background star field
    ├── audioengine.js          # Web Audio API (mic + file)
    ├── gestureEngine.js        # MediaPipe hand tracking
    └── classifier.js           # TF.js gesture classification
```

---

## 🚀 Getting Started

### Prerequisites

- A modern browser with WebGL support (Chrome / Firefox / Edge)
- A local dev server (required — `fetch()` won't work over `file://`)

### Run Locally

**Option 1 — VS Code Live Server (recommended)**
1. Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
2. Right-click `index.html` → **Open with Live Server**
3. Open `http://127.0.0.1:5500/index.html`

**Option 2 — Python**
```bash
python -m http.server 5500
# Open http://localhost:5500
```

**Option 3 — Node.js**
```bash
npx serve .
```

> ⚠️ **Important:** Always run via a local server. Opening `index.html` directly as a `file://` URL will block shader fetching due to CORS restrictions.

---

## 🔧 Shader Architecture

The planet is rendered as a `THREE.Points` object using a custom `ShaderMaterial`. Shaders are loaded asynchronously at runtime:

```js
// planet.js loads shaders via fetch
const [vert, frag] = await Promise.all([
  fetch('./shaders/planet.vert').then(r => r.text()),
  fetch('./shaders/planet.frag').then(r => r.text()),
]);
```

### Uniforms Reference

| Uniform | Type | Description |
|---|---|---|
| `uTime` | `float` | Elapsed time for animation |
| `uScale` | `float` | Overall planet scale (gesture-driven) |
| `uWaveAmp` | `float` | Noise displacement amplitude |
| `uAudioBass` | `float` | Bass frequency energy `[0–1]` |
| `uAudioMid` | `float` | Mid frequency energy `[0–1]` |
| `uAudioTreble` | `float` | Treble frequency energy `[0–1]` |

### Per-Particle Attributes

| Attribute | Type | Description |
|---|---|---|
| `aSize` | `float` | Particle point size |
| `aColor` | `vec3` | Base particle color |
| `aPhase` | `float` | Random phase offset for organic motion |

---

## 🎵 Audio Input

Click the **Sound** button in the UI to enable audio, then choose:
- **Mic** — uses your microphone as a live audio source
- **File** — upload an audio file (MP3, WAV, etc.)

Bass drives planet pulse, mid drives wave distortion, treble drives glow bloom.

---

## 📊 Adaptive Quality

The engine monitors rolling average FPS and automatically adjusts:

| Condition | Action |
|---|---|
| avg FPS < 35 | Reduce particles to 7,000 + lower pixel ratio |
| avg FPS > 55 | Restore particles to 18,000 + raise pixel ratio |

Toggle adaptive quality with the **⚡ Adaptive** button.

---

## 🛠️ Common Issues

**Black screen on load**
- Make sure you're running via a local server, not opening the file directly
- Open DevTools (F12) → Console and check for shader load errors
- Verify shader files exist: `shaders/planet.vert`, `shaders/planet.frag`, `shaders/atmosphere.vert`, `shaders/atmosphere.frag`

**Gesture not detected**
- Allow camera permissions when prompted
- Ensure good lighting on your hand
- Check console for MediaPipe initialization errors

**Low FPS**
- Enable Adaptive Quality (⚡ button)
- Try a Chromium-based browser for best WebGL performance

---

## 🧰 Tech Stack

| Technology | Purpose |
|---|---|
| [Three.js r160](https://threejs.org) | 3D rendering & WebGL abstraction |
| GLSL (WebGL 1) | Custom vertex & fragment shaders |
| [MediaPipe Hands](https://mediapipe.dev) | Real-time hand landmark detection |
| [TensorFlow.js](https://tensorflow.org/js) | Gesture classification model |
| Web Audio API | Microphone & file audio analysis |

---

## 📄 License

MIT — feel free to use, modify, and build on this project.

---

<p align="center">Made with 💜 · WebGL · MediaPipe · Three.js</p>
