'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import { getCountryCoords } from './country-coords';

interface CountryBreakdown {
  countryCode: string;
  countryName: string;
  uniqueVisitors: number;
}

interface GlobalReachGlobeProps {
  byCountry: CountryBreakdown[];
  totalCountries: number;
  totalVisits: number;
  className?: string;
}

interface GlobePointData {
  lat: number;
  lng: number;
  countryName: string;
  countryCode: string;
  uniqueVisitors: number;
  color: string;
  level: string;
}

interface ThreeObject {
  type: string;
  children?: ThreeObject[];
  geometry?: unknown;
  rotation?: { y: number };
}

// Activity level colors: High 50+ red, Medium 20-50 orange, Growing 1-20 green
function getActivityColor(visitors: number): string {
  if (visitors >= 50) return '#ef4444';
  if (visitors >= 20) return '#f97316';
  return '#22c55e';
}

function getActivityLevel(visitors: number): string {
  if (visitors >= 50) return 'High (50+)';
  if (visitors >= 20) return 'Medium (20-50)';
  return 'Growing (1-20)';
}

export function GlobalReachGlobe({
  byCountry,
  className = '',
}: GlobalReachGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [GlobeComponent, setGlobeComponent] = useState<React.ComponentType<any> | null>(null);
  const [size, setSize] = useState({ width: 800, height: 420 });

  const pointsData = useMemo(() => {
    const points = byCountry
      .filter((c) => c.uniqueVisitors > 0)
      .map((c) => {
        // Handle "Unknown" country - place it in a visible location (center of Atlantic)
        const [lat, lng] = c.countryCode === 'XX' || !c.countryCode 
          ? [20, -30] // Center of Atlantic Ocean for "Unknown"
          : getCountryCoords(c.countryCode);
        return {
          lat,
          lng,
          countryName: c.countryName || 'Unknown',
          countryCode: c.countryCode || 'XX',
          uniqueVisitors: c.uniqueVisitors,
          color: getActivityColor(c.uniqueVisitors),
          level: getActivityLevel(c.uniqueVisitors),
        };
      });
    
    // Debug: Log points data to verify it's being created
    if (points.length > 0) {
      console.log('[GlobalReachGlobe] Points data:', points);
    }
    
    return points;
  }, [byCountry]);

  useEffect(() => {
    import('react-globe.gl').then((mod) => setGlobeComponent(() => mod.default));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 800, height: 420 };
      setSize({ width: Math.max(300, width), height: Math.max(300, height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [GlobeComponent]);

  useEffect(() => {
    return () => {
      // Cleanup animation frame on unmount
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  if (!GlobeComponent) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-slate-900/40 border border-slate-800/60 ${className}`} style={{ minHeight: 420 }}>
        <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', width: '100%', height: 420 }}>
      <GlobeComponent
        ref={globeRef}
        width={size.width}
        height={size.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointRadius={(d: object) => {
          const point = d as GlobePointData;
          // Make points more visible - minimum 0.5, scale with visitors
          const baseRadius = 0.5;
          const visitorScale = Math.min(point.uniqueVisitors / 50, 1); // Scale up to 50 visitors
          return baseRadius + (visitorScale * 0.5);
        }}
        pointAltitude={0.03}
        pointResolution={3}
        pointsMerge={false}
        pointLabel={(d: object) => {
          const point = d as GlobePointData;
          return `
          <div style="
            background: rgba(15,23,42,0.95);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 8px 12px;
            color: #fff;
            font-size: 12px;
            max-width: 200px;
          ">
            <strong>${point.countryName}</strong><br/>
            ${point.uniqueVisitors} unique visitors<br/>
            <span style="color: ${point.color}">${point.level}</span>
          </div>
        `;
        }}
        showAtmosphere
        atmosphereColor="#1de9b6"
        atmosphereAltitude={0.15}
        enablePointerInteraction={true}
        onGlobeReady={() => {
          if (globeRef.current) {
            // Access the Three.js controls for auto-rotation
            const controls = globeRef.current.controls();
            if (controls) {
              controls.autoRotate = true;
              controls.autoRotateSpeed = 0.8; // Rotation speed (0.8 = smooth, moderate rotation)
              controls.enableDamping = true;
              controls.dampingFactor = 0.1;

              // Set up continuous animation loop to update controls
              const animate = () => {
                if (controls && globeRef.current) {
                  controls.update();
                }
                animationFrameRef.current = requestAnimationFrame(animate);
              };
              animate();
            } else {
              // Fallback: manually rotate the globe if controls aren't available
              const globeScene = globeRef.current.scene?.();
              const animate = () => {
                if (globeScene) {
                  // Find and rotate the globe mesh
                  const findGlobeMesh = (obj: ThreeObject): ThreeObject | null => {
                    if (obj.type === 'Group' && obj.children) {
                      for (const child of obj.children) {
                        if (child.type === 'Mesh' && child.geometry) {
                          return child;
                        }
                        const found = findGlobeMesh(child);
                        if (found) return found;
                      }
                    }
                    return null;
                  };

                  const globeMesh = findGlobeMesh(globeScene as unknown as ThreeObject);
                  if (globeMesh?.rotation) {
                    globeMesh.rotation.y += 0.002; // Slow, smooth rotation
                  }
                }
                animationFrameRef.current = requestAnimationFrame(animate);
              };
              animate();
            }
          }
        }}
      />
    </div>
  );
}
