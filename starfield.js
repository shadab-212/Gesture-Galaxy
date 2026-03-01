/**
 * starfield.js — 11,000 particle starfield with parallax layers + twinkling
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const STAR_VERT = `
attribute float aSize;
attribute float aTwinkleOffset;
uniform float uTime;
varying float vAlpha;

void main() {
  float twinkle = 0.6 + 0.4 * sin(uTime * 2.5 + aTwinkleOffset);
  vAlpha = twinkle;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (200.0 / -mvPos.z);
  gl_Position  = projectionMatrix * mvPos;
}`;

const STAR_FRAG = `
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.0, d) * vAlpha;
  gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
}`;

const LAYERS = [
  { count: 5000, radius: 900, sizeRange: [0.5, 1.2], speed: 0.00008 },
  { count: 4000, radius: 500, sizeRange: [1.0, 2.0], speed: 0.00015 },
  { count: 2000, radius: 250, sizeRange: [1.5, 3.0], speed: 0.0003 },
];

function buildLayer({ count, radius, sizeRange, speed }) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const offsets = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const u = Math.random(), v = Math.random();
    const th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1);
    positions[i*3]   = radius * Math.sin(ph) * Math.cos(th);
    positions[i*3+1] = radius * Math.sin(ph) * Math.sin(th);
    positions[i*3+2] = radius * Math.cos(ph);
    sizes[i]   = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
    offsets[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',       new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize',          new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aTwinkleOffset', new THREE.BufferAttribute(offsets, 1));

  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Points(geo, mat);
  return { mesh, uniforms, speed };
}

export class Starfield {
  constructor(scene) {
    this.scene = scene;
    this.layers = LAYERS.map(cfg => {
      const layer = buildLayer(cfg);
      scene.add(layer.mesh);
      return layer;
    });
  }

  update(time) {
    for (const layer of this.layers) {
      layer.uniforms.uTime.value = time;
      layer.mesh.rotation.y += layer.speed;
      layer.mesh.rotation.x += layer.speed * 0.3;
    }
  }
}

export function createStarfield(scene) {
  return LAYERS.map(cfg => {
    const layer = buildLayer(cfg);
    scene.add(layer.mesh);
    return layer;
  });
}

export function updateStarfield(layers, time) {
  for (const layer of layers) {
    layer.uniforms.uTime.value = time;
    layer.mesh.rotation.y += layer.speed;
    layer.mesh.rotation.x += layer.speed * 0.3;
  }
}