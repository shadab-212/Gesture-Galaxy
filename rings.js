/**
 * rings.js — Saturn-style particle ring system
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const RING_VERT = `
attribute float aAngle;
attribute float aRadius;
attribute float aHeight;
attribute float aSize;
attribute vec3  aColor;
uniform float uTime;
uniform float uBass;
varying vec3  vColor;
varying float vAlpha;

void main() {
  vColor = aColor;
  float distort = uBass * 0.12 * sin(aAngle * 8.0 + uTime * 3.0);
  float r = aRadius + distort;
  float x = cos(aAngle) * r;
  float y = aHeight + sin(uTime * 1.5 + aAngle * 3.0) * 0.015;
  float z = sin(aAngle) * r;
  float flicker = 0.7 + 0.3 * sin(uTime * 4.0 + aAngle * 20.0);
  vAlpha = flicker;
  vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
  gl_PointSize = aSize * (250.0 / -mv.z);
  gl_Position  = projectionMatrix * mv;
}`;

const RING_FRAG = `
varying vec3  vColor;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float dist = length(uv);
  if (dist > 0.5) discard;
  float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
  gl_FragColor = vec4(vColor, alpha);
}`;

const COUNT = 12000, INNER = 2.0, OUTER = 3.4;

export class Rings {
  constructor(scene) {
    this.scene = scene;
    this.result = createRings(scene);
    this.mesh = this.result.mesh;
    this.uniforms = this.result.uniforms;
  }

  update(time, audio = {}, gesture = {}) {
    updateRings(this.result, {
      time,
      rotY: gesture.spinY || 0.001,
      bass: audio.bass || 0
    });
  }
}

export function createRings(scene) {
  const angles = new Float32Array(COUNT), radii = new Float32Array(COUNT);
  const heights = new Float32Array(COUNT), sizes = new Float32Array(COUNT);
  const colors = new Float32Array(COUNT * 3), positions = new Float32Array(COUNT * 3);
  const palette = [new THREE.Color(0xaaccff), new THREE.Color(0x88aaee), new THREE.Color(0xccddff), new THREE.Color(0x6688cc)];

  for (let i = 0; i < COUNT; i++) {
    angles[i]  = Math.random() * Math.PI * 2;
    radii[i]   = INNER + Math.random() * (OUTER - INNER);
    heights[i] = (Math.random() - 0.5) * 0.08;
    sizes[i]   = 1.2 + Math.random() * 1.5;
    const c = palette[Math.floor(Math.random() * palette.length)];
    const t = 0.5 + Math.random() * 0.5;
    colors[i*3] = c.r*t; colors[i*3+1] = c.g*t; colors[i*3+2] = c.b*t;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aAngle',   new THREE.BufferAttribute(angles, 1));
  geo.setAttribute('aRadius',  new THREE.BufferAttribute(radii, 1));
  geo.setAttribute('aHeight',  new THREE.BufferAttribute(heights, 1));
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));

  const uniforms = { uTime: { value: 0 }, uBass: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Points(geo, mat);
  mesh.rotation.x = Math.PI * 0.15;
  scene.add(mesh);
  return { mesh, uniforms };
}



export function updateRings(rings, { time, rotY = 0, bass = 0 }) {
  rings.uniforms.uTime.value = time;
  rings.uniforms.uBass.value = bass;
  rings.mesh.rotation.y = rotY * 0.4;
}