// js/gestureEngine.js - MediaPipe Hands + classifier + EMA smoothing
import { predict, GESTURE_LABELS } from './classifier.js';

const EMA_ALPHA      = 0.2;
const VELOCITY_ALPHA = 0.3;

export class GestureEngine {
  constructor() {
    this.hands     = null;
    this.camera    = null;
    this.active    = false;
    this.landmarks = null;
    this._lastLandmarks = null;

    // EMA-smoothed gesture state
    this.state = {
      scale:    1.0,
      spinY:    0.001,
      spinX:    0.0,
      wave:     0.0,
      zoom:     1.0,
    };

    this._smooth = { ...this.state };

    // Wrist velocity tracking
    this._prevWristX = null;
    this._prevWristY = null;
    this._wristVelX  = 0;
    this._wristVelY  = 0;

    // Gesture output
    this.gestureIndex = 0;
    this.confidence   = 0;

    this._onGesture = null;
    this._initMediaPipe();
  }

  onGestureDetected(cb) { this._onGesture = cb; }

  async _initMediaPipe() {
    return new Promise((resolve) => {
      // Load MediaPipe Hands via CDN
      const script1 = document.createElement('script');
      script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
      script1.onload = () => {
        const script2 = document.createElement('script');
        script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js';
        script2.onload = () => {
          const script3 = document.createElement('script');
          script3.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
          script3.onload = () => {
            this._setupHands();
            resolve(true);
          };
          script3.onerror = () => resolve(false);
          document.head.appendChild(script3);
        };
        script2.onerror = () => resolve(false);
        document.head.appendChild(script2);
      };
      script1.onerror = () => resolve(false);
      document.head.appendChild(script1);
    });
  }

  _setupHands() {
    try {
      this.hands = new window.Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });

      this.hands.onResults((results) => this._onResults(results));
      this._handsReady = true;
    } catch (e) {
      console.error('MediaPipe setup failed:', e);
      this._handsReady = false;
    }
  }

  async start(videoEl, landmarkCanvas) {
    if (!this._handsReady) {
      console.warn('MediaPipe not ready');
      return false;
    }

    this.landmarkCtx = landmarkCanvas.getContext('2d');
    this.landmarkCanvas = landmarkCanvas;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
      videoEl.srcObject = stream;
      await videoEl.play();

      this.camera = new window.Camera(videoEl, {
        onFrame: async () => {
          if (this.active) {
            await this.hands.send({ image: videoEl });
          }
        },
        width: 320,
        height: 240,
      });
      await this.camera.start();
      this.active = true;
      return true;
    } catch (e) {
      console.error('Camera start failed:', e);
      return false;
    }
  }

  stop() {
    this.active = false;
    if (this.camera) {
      try { this.camera.stop(); } catch (e) {}
      this.camera = null;
    }
  }

  async _onResults(results) {
    if (!this.active) return;

    // Draw landmarks on overlay canvas
    if (this.landmarkCanvas && results.multiHandLandmarks) {
      this._drawLandmarks(results);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      this.landmarks = results.multiHandLandmarks[0];
      this._updateVelocity(this.landmarks);
      const { classIndex, confidence } = await predict(this.landmarks);
      this.gestureIndex = classIndex;
      this.confidence   = confidence;
      this._applyGestureToState(classIndex, confidence);
      if (this._onGesture) {
        this._onGesture(classIndex, confidence, GESTURE_LABELS[classIndex]);
      }
    } else {
      this.landmarks = null;
      this._decayState();
    }
  }

  _drawLandmarks(results) {
    const ctx = this.landmarkCtx;
    const w = this.landmarkCanvas.width;
    const h = this.landmarkCanvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!results.multiHandLandmarks) return;

    for (const lms of results.multiHandLandmarks) {
      // Draw connections
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.6)';
      ctx.lineWidth = 1;
      const CONNECTIONS = [
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [5,9],[9,10],[10,11],[11,12],
        [9,13],[13,14],[14,15],[15,16],
        [13,17],[17,18],[18,19],[19,20],
        [0,17]
      ];
      for (const [a, b] of CONNECTIONS) {
        ctx.beginPath();
        // Mirror x for selfie view
        ctx.moveTo((1 - lms[a].x) * w, lms[a].y * h);
        ctx.lineTo((1 - lms[b].x) * w, lms[b].y * h);
        ctx.stroke();
      }

      // Draw points
      for (let i = 0; i < lms.length; i++) {
        const lm = lms[i];
        const x = (1 - lm.x) * w;
        const y = lm.y * h;
        ctx.fillStyle = i === 8 || i === 4 ? '#ff44aa' : '#00f5ff';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _updateVelocity(landmarks) {
    const wrist = landmarks[0];
    if (this._prevWristX !== null) {
      const dx = wrist.x - this._prevWristX;
      const dy = wrist.y - this._prevWristY;
      this._wristVelX = VELOCITY_ALPHA * dx + (1 - VELOCITY_ALPHA) * this._wristVelX;
      this._wristVelY = VELOCITY_ALPHA * dy + (1 - VELOCITY_ALPHA) * this._wristVelY;
    }
    this._prevWristX = wrist.x;
    this._prevWristY = wrist.y;
  }

  _applyGestureToState(classIdx, confidence) {
    const t = Math.min(confidence * 1.5, 1.0); // confidence gate
    const lms = this.landmarks;

    let targetScale = this._smooth.scale;
    let targetSpinY = this._smooth.spinY;
    let targetWave  = this._smooth.wave;
    let targetZoom  = this._smooth.zoom;

    switch (classIdx) {
      case 1: // Open Hand → scale up
        targetScale = 1.0 + 0.4 * t;
        targetSpinY = 0.002;
        targetWave  = 0.1 * t;
        break;

      case 2: // Fist → compress
        targetScale = 0.7 + 0.3 * (1 - t);
        targetSpinY = 0.001;
        targetWave  = 0.05;
        break;

      case 3: // Pinch → fine control / wave distortion
        targetWave  = 0.3 * t;
        targetSpinY = 0.001;
        break;

      case 4: // Rotate → spin velocity based on wrist velocity
        targetSpinY = this._wristVelX * 10.0 * t;
        targetWave  = 0.15 * t;
        break;

      case 5: // Zoom → scale based on hand size (thumb-pinky distance)
        if (lms) {
          const thumb = lms[4];
          const pinky = lms[20];
          const span = Math.hypot(thumb.x - pinky.x, thumb.y - pinky.y);
          targetScale = 0.5 + span * 4.0;
          targetZoom  = targetScale;
        }
        break;

      default: // Idle
        targetScale = 1.0;
        targetSpinY = 0.001;
        targetWave  = 0.0;
    }

    // Clamp
    targetScale = Math.max(0.3, Math.min(2.5, targetScale));
    targetSpinY = Math.max(-0.05, Math.min(0.05, targetSpinY));

    // EMA smooth
    const a = EMA_ALPHA;
    this._smooth.scale  = a * targetScale + (1 - a) * this._smooth.scale;
    this._smooth.spinY  = a * targetSpinY + (1 - a) * this._smooth.spinY;
    this._smooth.wave   = a * targetWave  + (1 - a) * this._smooth.wave;
    this._smooth.zoom   = a * targetZoom  + (1 - a) * this._smooth.zoom;
    this._smooth.spinX  = a * (this._wristVelY * 5.0 * t) + (1 - a) * this._smooth.spinX;

    this.state = { ...this._smooth };
  }

  _decayState() {
    const decay = 0.95;
    this._smooth.scale  = 1.0 + (this._smooth.scale - 1.0) * decay;
    this._smooth.spinY  = 0.001 + (this._smooth.spinY - 0.001) * decay;
    this._smooth.wave   *= decay;
    this._smooth.spinX  *= decay;
    this.state = { ...this._smooth };
    this.gestureIndex = 0;
    this.confidence   = 0;
    this._wristVelX  *= decay;
    this._wristVelY  *= decay;
  }

  getState()        { return this.state; }
  getGestureLabel() { return GESTURE_LABELS[this.gestureIndex]; }
  getConfidence()   { return this.confidence; }
}