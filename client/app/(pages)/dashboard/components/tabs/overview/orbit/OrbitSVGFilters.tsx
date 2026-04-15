'use client';

/**
 * Shared SVG <defs> for glow halos, specular highlights, and gradient strokes.
 * Rendered once inside the root <svg> of the orbit graph.
 */
export function OrbitSVGFilters() {
  return (
    <defs>
      {/* ── glow halos ── */}
      <filter id="glow-sm" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="glow-md" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="10" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="glow-lg" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="20" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="glow-xl" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="35" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* ── edge flow animation gradient ── */}
      <linearGradient id="edge-flow" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="rgba(255,255,255,0)" />
        <stop offset="40%" stopColor="rgba(255,255,255,0.15)" />
        <stop offset="60%" stopColor="rgba(255,255,255,0.15)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
      </linearGradient>

      {/* ── specular highlight ── */}
      <radialGradient id="specular" cx="35%" cy="30%" r="35%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
      </radialGradient>

      {/* ── hub core radial ── */}
      <radialGradient id="hub-core" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#67e8f9" />
        <stop offset="30%" stopColor="#22d3ee" />
        <stop offset="60%" stopColor="#0891b2" />
        <stop offset="100%" stopColor="#164e63" />
      </radialGradient>

      <radialGradient id="hub-halo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(34,211,238,0.4)" />
        <stop offset="50%" stopColor="rgba(34,211,238,0.1)" />
        <stop offset="100%" stopColor="rgba(34,211,238,0)" />
      </radialGradient>

      {/* ── noise texture ── */}
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.04" />
        </feComponentTransfer>
        <feBlend in="SourceGraphic" mode="overlay" />
      </filter>
    </defs>
  );
}
