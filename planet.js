/**
 * planet.js — Particle-based planet using external shader files
 * Exports a Planet class compatible with main.js
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const DEFAULT_COUNT = 18000;
const LOW_COUNT     = 7000;

function buildGeo(count) {
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const sz  = new Float32Array(count);
  const col = new Float32Array(count * 3);
  const phase = new Float32Array(count);   // ← aPhase attribute used in planet.vert

  const palette = [
    new THREE.Color(0x00cfff),
    new THREE.Color(0x7b2fff),
    new THREE.Color(0xff2fa8),
    new THREE.Color(0x00ff99),
    new THREE.Color(0xffffff),
  ];

  const R = 1.5;
  for (let i = 0; i < count; i++) {
    const phi   = Math.acos(1 - (2 * (i + 0.5)) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const x = Math.sin(phi) * Math.cos(theta) * R;
    const y = Math.sin(phi) * Math.sin(theta) * R;
    const z = Math.cos(phi) * R;

    pos[i * 3]     = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;

    const L = Math.sqrt(x * x + y * y + z * z);
    nrm[i * 3]     = x / L;
    nrm[i * 3 + 1] = y / L;
    nrm[i * 3 + 2] = z / L;

    sz[i]    = 2.5 + Math.random() * 2.5;
    phase[i] = Math.random() * Math.PI * 2;   // random phase per particle

    const c = palette[Math.floor(Math.random() * palette.length)];
    const t = Math.random() * 0.4 + 0.6;
    col[i * 3]     = c.r * t;
    col[i * 3 + 1] = c.g * t;
    col[i * 3 + 2] = c.b * t;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos,   3));
  geo.setAttribute('normal',   new THREE.BufferAttribute(nrm,   3));
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sz,    1));
  geo.setAttribute('aColor',   new THREE.BufferAttribute(col,   3));
  geo.setAttribute('aPhase',   new THREE.BufferAttribute(phase, 1));
  return geo;
}

export class Planet {
  constructor(scene) {
    this.scene        = scene;
    this.group        = new THREE.Group();
    this.mesh         = null;
    this.material     = null;
    this.currentCount = DEFAULT_COUNT;
    this.ready        = false;

    // Uniforms — names match planet.vert / planet.frag exactly
    this.uniforms = {
      uTime:        { value: 0 },
      uWaveAmp:     { value: 0.04 },
      uScale:       { value: 1.0 },
      uAudioBass:   { value: 0 },
      uAudioMid:    { value: 0 },
      uAudioTreble: { value: 0 },
    };

    scene.add(this.group);
    this._load();
  }

  async _load() {
    try {
      const [vert, frag] = await Promise.all([
        fetch('../shaders/planet.vert').then(r => {
          if (!r.ok) throw new Error(`planet.vert: ${r.status}`);
          return r.text();
        }),
        fetch('../shaders/planet.frag').then(r => {
          if (!r.ok) throw new Error(`planet.frag: ${r.status}`);
          return r.text();
        }),
      ]);

      this.material = new THREE.ShaderMaterial({
        vertexShader:   vert,
        fragmentShader: frag,
        uniforms:       this.uniforms,
        transparent:    true,
        depthWrite:     false,
        blending:       THREE.AdditiveBlending,
      });

      this._buildMesh(DEFAULT_COUNT);
      this.ready = true;
      console.log('%c[Planet] Shaders loaded ✓', 'color:#00f5ff');

    } catch (err) {
      console.error('[Planet] Shader load failed:', err);
      // Fallback: minimal inline shader so something renders
      this.material = new THREE.ShaderMaterial({
        vertexShader: `
          attribute float aSize;
          attribute vec3  aColor;
          attribute float aPhase;
          uniform float uTime;
          uniform float uScale;
          uniform float uAudioBass;
          varying vec3  vColor;
          varying float vAlpha;
          void main() {
            vColor = aColor;
            vAlpha = 0.8;
            vec3 pos = position * uScale * (1.0 + uAudioBass * 0.2);
            vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = aSize * (300.0 / -mvPos.z);
            gl_Position  = projectionMatrix * mvPos;
          }`,
        fragmentShader: `
          varying vec3  vColor;
          varying float vAlpha;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            if (d > 0.5) discard;
            float a = smoothstep(0.5, 0.0, d) * vAlpha;
            gl_FragColor = vec4(vColor, a);
          }`,
        uniforms:    this.uniforms,
        transparent: true,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
      });
      this._buildMesh(DEFAULT_COUNT);
      console.warn('[Planet] Using fallback inline shaders. Check shaders/ folder.');
    }
  }

  _buildMesh(count) {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    const geo  = buildGeo(count);
    this.mesh  = new THREE.Points(geo, this.material);
    this.group.add(this.mesh);
    this.currentCount = count;
  }

  // Called every frame by main.js: planet.update(time, audio, gesture)
  update(time, audio = {}, gesture = {}) {
    if (!this.ready) return;

    const u = this.uniforms;
    u.uTime.value        = time;
    u.uAudioBass.value   = audio.bass   ?? 0;
    u.uAudioMid.value    = audio.mid    ?? 0;
    u.uAudioTreble.value = audio.treble ?? 0;
    u.uScale.value       = gesture.scale ?? 1.0;
    u.uWaveAmp.value     = 0.04 + (audio.mid ?? 0) * 0.06;

    // Spin from gesture
    this.group.rotation.y += gesture.spinY ?? 0.001;
    this.group.rotation.x += gesture.spinX ?? 0.0;
  }

  // Called by adaptive quality system in main.js
  reduceParticles(factor) {
    const target = factor < 0.6 ? LOW_COUNT : DEFAULT_COUNT;
    if (target !== this.currentCount && this.material) {
      this._buildMesh(target);
    }
  }
}