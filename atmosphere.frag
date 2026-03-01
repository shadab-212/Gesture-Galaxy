// atmosphere.frag - Fresnel + gradient glow
uniform float uTime;
uniform float uAudioTreble;
uniform float uScale;

varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.5);
  
  // Blue-purple gradient based on view angle
  vec3 colorA = vec3(0.1, 0.4, 1.0);  // blue
  vec3 colorB = vec3(0.6, 0.1, 1.0);  // purple
  float t = 0.5 + 0.5 * sin(uTime * 0.5);
  vec3 glowColor = mix(colorA, colorB, t);

  // Audio treble intensifies glow
  float intensity = fresnel * (0.7 + uAudioTreble * 0.5);
  
  gl_FragColor = vec4(glowColor * intensity, intensity * 0.6);
}
