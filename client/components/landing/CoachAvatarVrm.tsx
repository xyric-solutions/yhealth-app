"use client";

import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM } from "@pixiv/three-vrm";
import { IDLE_REST_POSE } from "@/lib/avatar/vrmPoses";

const VRM_URL = "/models/coach-avatar.vrm";
const CAMERA_POSITION = new THREE.Vector3(0, 0.9, 2.4);
const CAMERA_LOOK_AT = new THREE.Vector3(0, 0.75, 0);
const ROTATION_SPEED = 0.12; // radians per second (subtle spin)

export interface CoachAvatarVrmProps {
  vrmUrl?: string;
  className?: string;
  /** Slight continuous rotation when true. Default true. */
  autoRotate?: boolean;
}

export function CoachAvatarVrm({
  vrmUrl = VRM_URL,
  className = "",
  autoRotate = true,
}: CoachAvatarVrmProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.appendChild(canvas);

    const gl =
      canvas.getContext("webgl2", { alpha: true, antialias: true }) ||
      canvas.getContext("webgl", { alpha: true, antialias: true });
    if (!gl) {
      setError("WebGL not available");
      setLoading(false);
      return;
    }

    const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(width, height);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 20);
    camera.position.copy(CAMERA_POSITION);
    camera.lookAt(CAMERA_LOOK_AT);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(1, 2, 1);
    scene.add(dirLight);
    const ambLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambLight);

    let vrm: VRM | null = null;
    const clock = new THREE.Clock();

    const loadVrm = async () => {
      try {
        // Silence cosmetic blob:/data: texture errors — VRM still renders
        // with fallback materials for textures the browser can't decode.
        const manager = new THREE.LoadingManager();
        manager.onError = (failedUrl: string) => {
          if (failedUrl.startsWith("blob:") || failedUrl.startsWith("data:")) return;
          console.warn("[CoachAvatarVrm] Asset failed to load:", failedUrl);
        };
        const loader = new GLTFLoader(manager);
        loader.setCrossOrigin("anonymous");
        loader.register((parser) => new VRMLoaderPlugin(parser));
        const gltf = await loader.loadAsync(vrmUrl);
        const loaded = gltf.userData.vrm as VRM | undefined;
        if (!loaded) throw new Error("No VRM data in file");

        loaded.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) obj.frustumCulled = false;
        });
        scene.add(loaded.scene);
        loaded.humanoid?.setNormalizedPose(IDLE_REST_POSE);
        vrm = loaded;
        setError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load VRM";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    loadVrm();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width: w, height: h } = entry.contentRect;
      if (w === 0 || h === 0) return;
      canvas.width = w;
      canvas.height = h;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    let rafId: number;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      if (vrm?.scene && autoRotate) {
        vrm.scene.rotation.y += ROTATION_SPEED * dt;
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      if (vrm) {
        scene.remove(vrm.scene);
        vrm.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material?.dispose();
          }
        });
      }
      renderer.dispose();
      container.removeChild(canvas);
    };
  }, [vrmUrl, autoRotate]);

  return (
    <div
      ref={containerRef}
      className={`relative min-h-[280px] w-full overflow-hidden rounded-2xl bg-black/10 ${className}`}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
          <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">{error}</p>
        </div>
      )}
    </div>
  );
}
