// ─── Premium Wellness Core Shaders ─────────────────────────────────
// Organic blob with Perlin noise, liquid breathing, biometric energy core

// ─── Shared Simplex Noise Function ────────────────────────────────
const simplexNoise = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

// ─── Wellness Core Vertex Shader ──────────────────────────────────
// Organic blob with multi-octave Perlin displacement
export const coreVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  varying float vDisplacement;
  uniform float uTime;
  uniform float uScrollProgress;

  ${simplexNoise}

  void main() {
    vUv = uv;

    // Multi-octave organic displacement — liquid breathing blob
    float n1 = snoise(position * 1.2 + uTime * 0.12) * 0.08;
    float n2 = snoise(position * 2.4 - uTime * 0.08) * 0.04;
    float n3 = snoise(position * 4.8 + uTime * 0.2) * 0.02;
    float n4 = snoise(position * 0.6 + uTime * 0.05) * 0.06; // large-scale warping

    float displacement = n1 + n2 + n3 + n4;

    // Scroll-enhanced breathing
    float breathe = sin(uTime * 0.4) * 0.015 * (1.0 + uScrollProgress * 0.5);
    displacement += breathe;

    vDisplacement = displacement;

    vec3 newPosition = position + normal * displacement;
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(newPosition, 1.0)).xyz;
    vWorldPosition = newPosition;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

// ─── Wellness Core Fragment Shader ────────────────────────────────
// Biometric energy core with fresnel, chromatic patterns, scanner sweep
export const coreFragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  varying float vDisplacement;
  uniform float uTime;
  uniform float uScrollProgress;
  uniform float uHoverIntensity;

  ${simplexNoise}

  // Value noise for fragment detail
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
    vec3 viewDir = normalize(-vPosition);

    // ── Fresnel rim computation ──
    float fresnel = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float rimSoft = pow(fresnel, 2.0);
    float rimSharp = pow(fresnel, 4.0);

    // ── Color palette ──
    vec3 deepCore = vec3(0.01, 0.02, 0.06);
    vec3 tealPrimary = vec3(0.0, 0.75, 0.85);
    vec3 tealBright = vec3(0.0, 0.92, 1.0);
    vec3 violetAccent = vec3(0.45, 0.28, 0.85);
    vec3 cyanGlow = vec3(0.1, 0.85, 0.95);
    vec3 warmPulse = vec3(0.95, 0.65, 0.2);

    // ── Internal energy patterns ──
    float pattern1 = vnoise(vWorldPosition * 5.0 + uTime * 0.15);
    float pattern2 = vnoise(vWorldPosition * 10.0 - uTime * 0.12);
    float pattern3 = snoise(vWorldPosition * 3.0 + vec3(0.0, uTime * 0.2, 0.0));
    float energyField = pattern1 * 0.5 + pattern2 * 0.3 + pattern3 * 0.2;

    // ── Scanner sweep (biometric radar) ──
    float sweepAngle = mod(uTime * 0.6, 6.28318);
    float angle = atan(vWorldPosition.y, vWorldPosition.x);
    float sweepDist = abs(mod(angle - sweepAngle + 3.14159, 6.28318) - 3.14159);
    float sweep = smoothstep(0.8, 0.0, sweepDist) * 0.4;

    // ── Compose inner glow ──
    vec3 innerColor = mix(tealPrimary, violetAccent, energyField);
    innerColor = mix(innerColor, warmPulse, sweep * 0.3);

    // ── Displacement-based highlight ──
    float dispHighlight = smoothstep(-0.05, 0.1, vDisplacement);

    // ── Final color composition ──
    vec3 color = deepCore;
    color += innerColor * energyField * 0.35;
    color += tealBright * dispHighlight * 0.15;
    color += cyanGlow * rimSoft * 0.7;
    color += violetAccent * rimSharp * 0.5;
    color += tealBright * sweep;

    // ── Pulsing glow ──
    float pulse = sin(uTime * 0.6) * 0.12 + 0.88;
    color *= pulse;

    // ── Scroll-driven intensity ──
    color += tealPrimary * uScrollProgress * 0.08;

    // ── Hover intensity boost ──
    color += cyanGlow * uHoverIntensity * 0.15;

    // ── Sub-surface scattering approximation ──
    float sss = pow(max(dot(viewDir, -vNormal), 0.0), 1.5) * 0.12;
    color += tealPrimary * sss;

    // ── Alpha: solid core, glowing edges ──
    float alpha = 0.9 + rimSoft * 0.1;

    gl_FragColor = vec4(color, alpha);
  }
`;

// ─── Outer Glow Aura Shader ──────────────────────────────────────
export const glowVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPos;
  uniform float uTime;

  ${simplexNoise}

  void main() {
    // Subtle warping of the glow shell
    float warp = snoise(position * 0.8 + uTime * 0.1) * 0.03;
    vec3 pos = position + normal * warp;

    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(pos, 1.0)).xyz;
    vWorldPos = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const glowFragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPos;
  uniform float uTime;
  uniform float uHoverIntensity;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = 1.0 - max(dot(viewDir, vNormal), 0.0);
    fresnel = pow(fresnel, 2.5);

    vec3 teal = vec3(0.0, 0.85, 1.0);
    vec3 violet = vec3(0.5, 0.3, 0.9);
    vec3 cyan = vec3(0.2, 0.95, 1.0);

    float colorMix = sin(uTime * 0.25 + vWorldPos.y * 2.0) * 0.5 + 0.5;
    vec3 color = mix(teal, violet, colorMix);

    // Add cyan streaks
    float streak = sin(vWorldPos.y * 8.0 + uTime * 0.5) * 0.5 + 0.5;
    color += cyan * streak * 0.15;

    float pulse = sin(uTime * 0.8) * 0.08 + 0.92;
    float alpha = fresnel * (0.3 + uHoverIntensity * 0.15) * pulse;

    gl_FragColor = vec4(color, alpha);
  }
`;

// ─── Scanner Ring Shader ─────────────────────────────────────────
// Transparent radar ring with animated sweep line
export const scannerVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;

  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const scannerFragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  uniform float uTime;
  uniform float uRadius;
  uniform vec3 uColor;

  void main() {
    // Compute angle and distance from center in the ring plane
    float angle = atan(vPos.y, vPos.x);
    float normalizedAngle = (angle + 3.14159) / 6.28318;

    // Sweep line
    float sweepAngle = mod(uTime * 0.4, 1.0);
    float dist = abs(mod(normalizedAngle - sweepAngle + 0.5, 1.0) - 0.5);
    float sweep = smoothstep(0.15, 0.0, dist);

    // Base ring visibility (thin line)
    float ringAlpha = 0.08;

    // Combine
    float alpha = ringAlpha + sweep * 0.35;

    // Tick marks every 30 degrees (12 ticks)
    float tickAngle = mod(normalizedAngle * 12.0, 1.0);
    float tick = smoothstep(0.02, 0.0, abs(tickAngle - 0.5));
    alpha += tick * 0.1;

    gl_FragColor = vec4(uColor, alpha);
  }
`;

// ─── HUD Arc Segment Shader ─────────────────────────────────────
export const hudArcVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const hudArcFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uArcStart;
  uniform float uArcEnd;
  uniform vec3 uColor;

  void main() {
    float progress = vUv.x;
    float inArc = step(uArcStart, progress) * step(progress, uArcEnd);

    // Animated edge glow
    float edgeDist = min(abs(progress - uArcStart), abs(progress - uArcEnd));
    float edgeGlow = smoothstep(0.05, 0.0, edgeDist) * 0.6;

    float alpha = inArc * (0.2 + edgeGlow);

    // Breathing
    alpha *= sin(uTime * 0.5) * 0.1 + 0.9;

    gl_FragColor = vec4(uColor, alpha);
  }
`;
