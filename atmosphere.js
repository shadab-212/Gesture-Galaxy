/**
 * atmosphere.js — Outer glow sphere for planet atmosphere
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const ATMOSPHERE_VERT = `
uniform float uTime;
uniform float uScale;
attribute float aWave;
varying float vAlpha;

void main() {
  vAlpha = 0.3 + 0.2 * sin(uTime * 0.5 + aWave);
  vec3 pos = position * (1.0 + 0.15 * sin(uTime + aWave));
  vec4 mvPos = modelViewMatrix * vec4(pos * uScale, 1.0);
  gl_Position = projectionMatrix * mvPos;
}`;

const ATMOSPHERE_FRAG = `
varying float vAlpha;
void main() {
  gl_FragColor = vec4(0.0, 0.8, 1.0, vAlpha * 0.5);
}`;

export class Atmosphere {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.mesh = null;
    this.uniforms = {
      uTime:  { value: 0 },
      uScale: { value: 1.0 },
    };
    
    scene.add(this.group);
    this._buildMesh();
  }

  _buildMesh() {
    const geometry = new THREE.IcosahedronGeometry(2.2, 32);
    
    // Add wave attribute
    const count = geometry.attributes.position.count;
    const wave = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      wave[i] = Math.random() * Math.PI * 2;
    }
    geometry.setAttribute('aWave', new THREE.BufferAttribute(wave, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader:   ATMOSPHERE_VERT,
      fragmentShader: ATMOSPHERE_FRAG,
      uniforms:       this.uniforms,
      transparent:    true,
      side:           THREE.BackSide,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false,
    });

    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }

    this.mesh = new THREE.Mesh(geometry, material);
    this.group.add(this.mesh);
  }

  update(time, audio = {}, scale = 1.0) {
    this.uniforms.uTime.value = time;
    this.uniforms.uScale.value = scale * (1.0 + (audio.bass || 0) * 0.2);
    this.mesh.rotation.y += 0.0002;
    this.mesh.rotation.x += 0.00015;
  }
}
