// .js/main.js - Main orchestrator
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { Starfield }    from './starfield.js';
import { Planet }       from './planet.js';
import { Atmosphere }   from './atmosphere.js';
import { Rings }        from './rings.js';
import { AudioEngine }  from './audioengine.js';
import { GestureEngine } from './gestureEngine.js';
import { initClassifier, GESTURE_LABELS } from './classifier.js';

// ─── DOM References ──────────────────────────────────────────────
const canvas          = document.getElementById('galaxy-canvas');
const loadingScreen   = document.getElementById('loading-screen');
const loaderSub       = document.getElementById('loader-sub');
const fpsValue        = document.getElementById('fps-value');
const gestureLabel    = document.getElementById('gesture-label');
const confidenceBar   = document.getElementById('confidence-bar');
const confidenceValue = document.getElementById('confidence-value');
const btnAudio        = document.getElementById('btn-audio');
const btnQuality      = document.getElementById('btn-quality');
const btnCamera       = document.getElementById('btn-camera');
const audioControls   = document.getElementById('audio-controls');
const btnMic          = document.getElementById('btn-mic');
const btnFile         = document.getElementById('btn-file');
const audioFileInput  = document.getElementById('audio-file-input');
const barBass         = document.getElementById('bar-bass');
const barMid          = document.getElementById('bar-mid');
const barTreble       = document.getElementById('bar-treble');
const statusMediaPipe = document.getElementById('status-mediapipe');
const statusTF        = document.getElementById('status-tf');
const statusAudio     = document.getElementById('status-audio');
const webcamEl        = document.getElementById('webcam');
const landmarkCanvas  = document.getElementById('landmark-canvas');

// ─── State ───────────────────────────────────────────────────────
const appState = {
  audioActive:    false,
  gestureActive:  false,
  adaptiveQuality: true,
  qualityFactor:  1.0,
};

// ─── FPS Monitor ─────────────────────────────────────────────────
const fps = {
  frames: 0,
  last: performance.now(),
  value: 60,
  history: new Float32Array(30),
  histIdx: 0,
  update() {
    this.frames++;
    const now = performance.now();
    if (now - this.last >= 500) {
      this.value = (this.frames * 1000) / (now - this.last);
      this.history[this.histIdx++ % 30] = this.value;
      this.frames = 0;
      this.last = now;
      fpsValue.textContent = this.value.toFixed(0);
      fpsValue.style.color = this.value < 40 ? '#ff4466' : this.value < 55 ? '#ffaa00' : '#00f5ff';
    }
  },
  avg() {
    const n = Math.min(this.histIdx, 30);
    if (n === 0) return 60;
    let s = 0;
    for (let i = 0; i < n; i++) s += this.history[i];
    return s / n;
  }
};

// ─── THREE.js Setup ──────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000008, 1);
renderer.outputEncoding = THREE.LinearEncoding;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 4);

// ─── Scene Objects ───────────────────────────────────────────────
const starfield   = new Starfield(scene);
const planet      = new Planet(scene);
const atmosphere  = new Atmosphere(scene);
const rings       = new Rings(scene);

// ─── Engines ─────────────────────────────────────────────────────
const audioEngine   = new AudioEngine();
const gestureEngine = new GestureEngine();

// ─── Clock ───────────────────────────────────────────────────────
const clock = new THREE.Clock();

// ─── Adaptive Quality ────────────────────────────────────────────
let qualityTimer = 0;
function adaptQuality(dt) {
  if (!appState.adaptiveQuality) return;
  qualityTimer += dt;
  if (qualityTimer < 2.0) return;
  qualityTimer = 0;

  const avgFps = fps.avg();
  if (avgFps < 35 && appState.qualityFactor > 0.3) {
    appState.qualityFactor = Math.max(0.3, appState.qualityFactor - 0.1);
    planet.reduceParticles(appState.qualityFactor);
    renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - 0.25));
  } else if (avgFps > 55 && appState.qualityFactor < 1.0) {
    appState.qualityFactor = Math.min(1.0, appState.qualityFactor + 0.05);
    planet.reduceParticles(appState.qualityFactor);
    if (renderer.getPixelRatio() < Math.min(window.devicePixelRatio, 2)) {
      renderer.setPixelRatio(renderer.getPixelRatio() + 0.1);
    }
  }
}

// ─── Camera Orbit ────────────────────────────────────────────────
let camTheta = 0;
let camPhi   = Math.PI * 0.25;
let isDragging = false;
let prevMouse = { x: 0, y: 0 };

canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  prevMouse = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('mouseup', () => { isDragging = false; });
canvas.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = (e.clientX - prevMouse.x) * 0.005;
  const dy = (e.clientY - prevMouse.y) * 0.005;
  camTheta -= dx;
  camPhi   = Math.max(0.1, Math.min(Math.PI - 0.1, camPhi + dy));
  prevMouse = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('wheel', (e) => {
  camera.position.z = Math.max(2, Math.min(10, camera.position.z + e.deltaY * 0.005));
  e.preventDefault();
}, { passive: false });

// Touch support
canvas.addEventListener('touchstart', (e) => {
  isDragging = true;
  prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
});
canvas.addEventListener('touchend', () => { isDragging = false; });
canvas.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  const dx = (e.touches[0].clientX - prevMouse.x) * 0.005;
  const dy = (e.touches[0].clientY - prevMouse.y) * 0.005;
  camTheta -= dx;
  camPhi   = Math.max(0.1, Math.min(Math.PI - 0.1, camPhi + dy));
  prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
});

function updateCamera() {
  const R = camera.position.z;
  camera.position.x = R * Math.sin(camPhi) * Math.sin(camTheta);
  camera.position.y = R * Math.cos(camPhi);
  camera.position.z = R * Math.sin(camPhi) * Math.cos(camTheta);
  camera.lookAt(0, 0, 0);
}

// ─── Animation Loop ──────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  const dt   = clock.getDelta();
  const time = clock.getElapsedTime();

  fps.update();
  adaptQuality(dt);

  // Get audio data
  const audio = audioEngine.update();

  // Update audio bar UI
  if (appState.audioActive) {
    barBass.style.height   = `${Math.min(40, audio.bass   * 120)}px`;
    barMid.style.height    = `${Math.min(40, audio.mid    * 120)}px`;
    barTreble.style.height = `${Math.min(40, audio.treble * 120)}px`;
  }

  // Get gesture state
  const gesture = appState.gestureActive
    ? gestureEngine.getState()
    : { scale: 1.0, spinY: 0.001, spinX: 0.0, wave: 0.0, zoom: 1.0 };

  // Update scene
  starfield.update(time);
  planet.update(time, audio, gesture);
  atmosphere.update(time, audio, gesture.scale);
  rings.update(time, audio, gesture);

  updateCamera();
  renderer.render(scene, camera);
}

// ─── UI Controls ─────────────────────────────────────────────────
btnAudio.addEventListener('click', () => {
  appState.audioActive = !appState.audioActive;
  btnAudio.classList.toggle('active', appState.audioActive);
  audioControls.classList.toggle('hidden', !appState.audioActive);

  if (!appState.audioActive) {
    audioEngine.stop();
    statusAudio.textContent = '● Audio: Off';
    statusAudio.className = '';
    barBass.style.height = barMid.style.height = barTreble.style.height = '4px';
  }
});

btnQuality.addEventListener('click', () => {
  appState.adaptiveQuality = !appState.adaptiveQuality;
  btnQuality.classList.toggle('active', appState.adaptiveQuality);
  if (!appState.adaptiveQuality) {
    appState.qualityFactor = 1.0;
    planet.reduceParticles(1.0);
  }
});

btnCamera.addEventListener('click', async () => {
  appState.gestureActive = !appState.gestureActive;
  btnCamera.classList.toggle('active', appState.gestureActive);
  webcamEl.classList.toggle('visible', appState.gestureActive);
  landmarkCanvas.classList.toggle('visible', appState.gestureActive);

  if (appState.gestureActive) {
    const ok = await gestureEngine.start(webcamEl, landmarkCanvas);
    if (!ok) {
      appState.gestureActive = false;
      btnCamera.classList.remove('active');
      webcamEl.classList.remove('visible');
      landmarkCanvas.classList.remove('visible');
      statusMediaPipe.textContent = '● MediaPipe: Failed';
      statusMediaPipe.className = 'err';
    } else {
      statusMediaPipe.textContent = '● MediaPipe: Active';
      statusMediaPipe.className = 'ok';
    }
  } else {
    gestureEngine.stop();
    statusMediaPipe.textContent = '● MediaPipe: Off';
    statusMediaPipe.className = '';
  }
});

btnMic.addEventListener('click', async () => {
  const ok = await audioEngine.startMic();
  if (ok) {
    statusAudio.textContent = '● Audio: Mic';
    statusAudio.className = 'ok';
    btnMic.classList.add('active');
    btnFile.classList.remove('active');
  } else {
    statusAudio.textContent = '● Audio: Mic denied';
    statusAudio.className = 'err';
  }
});

btnFile.addEventListener('click', () => { audioFileInput.click(); });

audioFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await audioEngine.startFile(file);
    statusAudio.textContent = `● Audio: ${file.name.substring(0, 12)}`;
    statusAudio.className = 'ok';
    btnFile.classList.add('active');
    btnMic.classList.remove('active');
  } catch (err) {
    statusAudio.textContent = '● Audio: File error';
    statusAudio.className = 'err';
  }
});

// Gesture UI updates
gestureEngine.onGestureDetected((idx, confidence, label) => {
  gestureLabel.textContent = label;
  gestureLabel.style.textShadow = `0 0 ${10 + confidence * 20}px var(--accent)`;
  confidenceBar.style.width = `${(confidence * 100).toFixed(0)}%`;
  confidenceValue.textContent = confidence.toFixed(2);
});

// ─── Resize ──────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  landmarkCanvas.width  = 160;
  landmarkCanvas.height = 120;
});

// ─── Init ────────────────────────────────────────────────────────
async function init() {
  loaderSub.textContent = 'Initializing Three.js...';
  await new Promise(r => setTimeout(r, 100));

  loaderSub.textContent = 'Loading AI classifier...';
  const tfOk = await initClassifier((msg) => {
    loaderSub.textContent = msg;
  });

  statusTF.textContent = tfOk ? '● TF.js: Ready' : '● TF.js: Fallback';
  statusTF.className   = tfOk ? 'ok' : 'err';

  // Set landmark canvas size
  landmarkCanvas.width  = 160;
  landmarkCanvas.height = 120;

  loaderSub.textContent = 'Starting render loop...';
  await new Promise(r => setTimeout(r, 200));

  // Start animation
  animate();

  // Fade out loading screen
  loadingScreen.classList.add('fade-out');
  setTimeout(() => {
    loadingScreen.style.display = 'none';
  }, 1000);

  statusMediaPipe.textContent = '● MediaPipe: Ready';
  statusMediaPipe.className = 'ok';
}

init();