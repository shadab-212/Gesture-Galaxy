// planet.frag — Planet particle fragment shader
uniform float uTime;
uniform float uAudioTreble;

varying vec3  vColor;
varying float vAlpha;

void main() {
  vec2  center = gl_PointCoord - 0.5;
  float dist   = length(center);
  if (dist > 0.5) discard;

  float softEdge = 1.0 - smoothstep(0.3, 0.5, dist);
  float glow     = exp(-dist * 4.0);

  float brightness = 1.0 + uAudioTreble * 0.8;
  vec3  finalColor = vColor * brightness;

  // Rim glow halo driven by treble
  finalColor += vec3(0.1, 0.5, 1.0) * glow * 0.4 * uAudioTreble;

  float alpha = vAlpha * softEdge * 0.85;
  gl_FragColor = vec4(finalColor, alpha);
}
