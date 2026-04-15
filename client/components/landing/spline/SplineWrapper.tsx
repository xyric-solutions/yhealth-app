"use client";

import {
  Suspense,
  lazy,
  memo,
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type CSSProperties,
} from "react";

const SplineComponent = lazy(() => import("@splinetool/react-spline"));

interface SplineWrapperProps {
  sceneUrl: string;
  className?: string;
  style?: CSSProperties;
  fallback?: ReactNode;
  interactive?: boolean;
  onLoad?: () => void;
}

/**
 * Reusable Spline 3D scene wrapper.
 *
 * - Lazy-loads spline runtime (avoids SSR issues)
 * - Shows gradient shimmer skeleton while loading
 * - Falls back to gradient on error, mobile, or reduced-motion
 * - IntersectionObserver: only mounts canvas when near viewport
 */
function SplineWrapperInner({
  sceneUrl,
  className = "",
  style,
  fallback,
  interactive = false,
  onLoad,
}: SplineWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Detect mobile + reduced-motion on mount
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    setPrefersReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // IntersectionObserver — only render Spline when section is near viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isPlaceholder =
    !sceneUrl || sceneUrl.includes("PLACEHOLDER");
  const shouldRenderSpline =
    isVisible &&
    !isMobile &&
    !prefersReducedMotion &&
    !isPlaceholder &&
    !hasError;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      {/* Gradient fallback — always present, fades when Spline loads */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        {fallback || <DefaultFallback />}
      </div>

      {/* Loading shimmer — shows while Spline is downloading */}
      {shouldRenderSpline && !isLoaded && (
        <div className="absolute inset-0 z-[1]">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
        </div>
      )}

      {/* Spline canvas */}
      {shouldRenderSpline && (
        <Suspense fallback={null}>
          <div
            className={`absolute inset-0 z-[2] ${
              interactive ? "pointer-events-auto" : "pointer-events-none"
            }`}
          >
            <SplineComponent
              scene={sceneUrl}
              onLoad={() => {
                setIsLoaded(true);
                onLoad?.();
              }}
              onError={() => setHasError(true)}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </Suspense>
      )}
    </div>
  );
}

function DefaultFallback() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/8 via-cyan-600/5 to-emerald-600/8" />
      <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-br from-violet-500/10 to-cyan-500/10 blur-3xl" />
    </div>
  );
}

export const SplineWrapper = memo(SplineWrapperInner);
export default SplineWrapper;
