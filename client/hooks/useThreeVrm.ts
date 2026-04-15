"use client";

/**
 * @file useThreeVrm Hook
 * @description Initializes a Three.js scene with VRM 1.0 model loading, camera setup,
 * lighting, data-driven full-body idle animation, state-based pose blending, blink,
 * and a single RAF loop that reads shared refs for visemes and expression values.
 *
 * All Three.js objects live in refs — zero React re-renders in the animation path.
 */

import { useEffect, useRef, useState, useCallback, type MutableRefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";
import {
  IDLE_REST_POSE,
  IDLE_ANIM_CHANNELS,
  SPEAKING_GESTURE_CHANNELS,
  LISTENING_GESTURE_CHANNELS,
  FINGER_IDLE_CHANNELS,
  SPEAKING_FINGER_CHANNELS,
  EMOTION_HAND_OFFSETS,
  STATE_POSE_OFFSETS,
  EMOTION_SPEAKING_POSES,
  ARM_CLAMP_LIMITS,
  ALL_ANIMATED_BONES,
  type IdleAnimChannel,
} from "@/lib/avatar/vrmPoses";
import {
  EMOTION_MODULATORS,
  MODULATOR_NUMERIC_KEYS,
  MODULATOR_TUPLE_KEYS,
  type EmotionModulators,
  getEmotionModulator,
  blendEmotionModulators,
} from "@/lib/avatar/emotionModulation";
import { lerp } from "@/lib/avatar/smoothing";
import {
  createMicroExpressionEngine,
  type MicroExpressionEngine,
} from "@/lib/avatar/microExpressions";
import { GesturePlayer, type GestureType } from "@/lib/avatar/gestureSystem";

// ============================================
// CAMERA CONSTANTS
// ============================================

const CAMERA_LOOK_AT = new THREE.Vector3(0, 0.75, 0);
const CAMERA_FOV = 32;

/** Camera Z distance — further back on large screens (20% smaller model). */
function getCameraZ(): number {
  if (typeof window === "undefined") return 3.8;
  return window.innerWidth >= 768 ? 3.8 : 3.0;
}

const CAMERA_POSITION = new THREE.Vector3(0, 0.8, getCameraZ());

// ============================================
// TYPES
// ============================================

export interface UseThreeVrmOptions {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  vrmUrl?: string;
  mouthValueRef: MutableRefObject<number>;
  expressionValuesRef: MutableRefObject<Record<string, number>>;
  /** Per-viseme weight output from useLipSync. */
  visemeValuesRef: MutableRefObject<Record<string, number>>;
  /** Current avatar state — drives body pose blending. */
  avatarStateRef: MutableRefObject<string>;
  /** Called each frame so useLipSync can update its refs. */
  lipSyncTickRef?: MutableRefObject<(() => void) | null>;
  /** Called each frame so useExpressions can update expressionValuesRef. */
  expressionsTickRef?: MutableRefObject<(() => void) | null>;
  /** Called each frame so useEyeMovement can update eyeValuesRef. */
  eyeMovementTickRef?: MutableRefObject<(() => void) | null>;
  /** Per-eye-direction expression weights from useEyeMovement. */
  eyeValuesRef: MutableRefObject<Record<string, number>>;
  /** Current emotion name — drives animation modulation. */
  emotionModRef: MutableRefObject<string>;
}

export interface UseThreeVrmReturn {
  vrmRef: MutableRefObject<VRM | null>;
  loadVrm: (url: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  /** Queue a named discrete gesture (wave, point, shrug, etc.). */
  queueGesture: (type: GestureType) => void;
}

// ============================================
// STATE BLEND
// ============================================

const STATE_BLEND_SPEED = 3.0; // ~333ms transition

// ============================================
// HOOK
// ============================================

export function useThreeVrm({
  canvasRef,
  vrmUrl,
  mouthValueRef: _mouthValueRef,
  expressionValuesRef,
  visemeValuesRef,
  avatarStateRef,
  lipSyncTickRef,
  expressionsTickRef,
  eyeMovementTickRef,
  eyeValuesRef,
  emotionModRef,
}: UseThreeVrmOptions): UseThreeVrmReturn {
  const vrmRef = useRef<VRM | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const rafIdRef = useRef<number>(0);
  const hipsBaseYRef = useRef<number>(0);
  const hipsBaseXRef = useRef<number>(0);

  // Cached rest-pose bone quaternions (set after VRM load)
  const restQuatsRef = useRef<Map<string, THREE.Quaternion>>(new Map());

  // State blend tracking
  const prevStateRef = useRef<string>("idle");
  const stateBlendRef = useRef<number>(1.0); // 1.0 = fully transitioned

  // Blink state — enhanced with queue for double-blinks
  const blinkQueueRef = useRef<Array<{ startTime: number; progress: number }>>([]);
  const nextBlinkRef = useRef<number>(0);
  const blinkProgressRef = useRef<number>(-1);

  // Emotion modulator — smoothly lerped toward target each frame
  const currentModRef = useRef<EmotionModulators>({ ...EMOTION_MODULATORS.neutral });

  // Micro-expression engine for brief emotional flashes
  const microExprEngineRef = useRef<MicroExpressionEngine>(createMicroExpressionEngine());
  const gesturePlayerRef = useRef<GesturePlayer>(new GesturePlayer());

  // Auto-gesture: cycles through conversational gestures during speaking state
  const nextAutoGestureRef = useRef<number>(0);

  // Breathing phase offset for smooth emotion-based breathing
  const breathingPhaseRef = useRef<number>(0);

  // Reusable temporaries (allocated once, reused each frame)
  const tempQuatRef = useRef(new THREE.Quaternion());
  const tempEulerRef = useRef(new THREE.Euler());
  const _tempVec3Ref = useRef(new THREE.Vector3());

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- VRM Loading ----

  const loadVrm = useCallback(
    async (url: string) => {
      const scene = sceneRef.current;
      if (!scene) return;

      setIsLoading(true);
      setError(null);

      try {
        // Dedicated LoadingManager so we can silence cosmetic texture errors.
        // VRMs commonly embed textures the browser can't decode (KTX2/BASIS)
        // or whose blob: URLs the dev server rejects. Three.js logs each
        // failure as a console error even though the VRM renders fine with
        // fallback materials. We downgrade those specific errors to a single
        // aggregated warn so the console stays readable.
        const manager = new THREE.LoadingManager();
        let failedTextures = 0;
        manager.onError = (failedUrl: string) => {
          if (failedUrl.startsWith("blob:") || failedUrl.startsWith("data:")) {
            failedTextures++;
            return;
          }
          console.warn("[useThreeVrm] Asset failed to load:", failedUrl);
        };

        const loader = new GLTFLoader(manager);
        loader.setCrossOrigin("anonymous");
        loader.register((parser) => new VRMLoaderPlugin(parser));

        const gltf = await loader.loadAsync(url);
        if (failedTextures > 0) {
          console.warn(
            `[useThreeVrm] ${failedTextures} embedded texture(s) failed to decode — VRM loaded with fallback materials.`,
          );
        }
        const vrm = gltf.userData.vrm as VRM | undefined;
        if (!vrm) throw new Error("No VRM data found in file");

        // Defensive: ensure every texture has colorSpace set. Some VRM files
        // ship with texture slots the MToon/GLTF extensions later read as
        // `texture.colorSpace` — undefined textures there trigger
        // "Cannot read properties of undefined (reading 'colorSpace')".
        vrm.scene.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((mat) => {
            if (!mat) return;
            const slots = ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap", "lightMap"];
            for (const slot of slots) {
              const tex = (mat as unknown as Record<string, THREE.Texture | undefined>)[slot];
              if (tex && !tex.colorSpace) tex.colorSpace = THREE.SRGBColorSpace;
            }
          });
        });

        // Remove previous VRM
        if (vrmRef.current) {
          scene.remove(vrmRef.current.scene);
          vrmRef.current.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              obj.geometry?.dispose();
              if (Array.isArray(obj.material)) {
                obj.material.forEach((m) => m.dispose());
              } else {
                obj.material?.dispose();
              }
            }
          });
          vrmRef.current = null;
        }

        // Disable frustum culling to prevent disappearing
        vrm.scene.traverse((obj) => {
          obj.frustumCulled = false;
        });

        scene.add(vrm.scene);

        // Apply natural idle rest pose (fixes T-pose)
        if (vrm.humanoid) {
          vrm.humanoid.setNormalizedPose(IDLE_REST_POSE);

          // Force immediate normalized→raw bone sync so the rest pose is
          // visible on the very first render frame.
          vrm.update(0);
        }

        // Capture hips base position for breathing/weight-shift animation
        const hips = vrm.humanoid?.getNormalizedBoneNode("hips");
        if (hips) {
          hipsBaseYRef.current = hips.position.y;
          hipsBaseXRef.current = hips.position.x;
        }

        // Cache rest-pose bone quaternions so the RAF loop can reset + layer.
        // IMPORTANT: This must complete BEFORE setting vrmRef so the RAF loop
        // never sees the VRM without valid rest quaternions.
        const boneQuats = new Map<string, THREE.Quaternion>();
        for (const boneName of ALL_ANIMATED_BONES) {
          const node = vrm.humanoid?.getNormalizedBoneNode(boneName as VRMHumanBoneName);
          if (node) {
            boneQuats.set(boneName, node.quaternion.clone());
          }
        }
        restQuatsRef.current = boneQuats;

        // Make VRM visible to RAF loop AFTER rest quats are cached
        vrmRef.current = vrm;

        setIsLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load VRM";
        setError(message);
        setIsLoading(false);
        console.error("[useThreeVrm] VRM load error:", err);
      }
    },
    []
  );

  // ---- Scene Setup + RAF Loop ----

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ensure canvas has non-zero dimensions before WebGL context creation.
    const parent = canvas.parentElement;
    const rect = parent?.getBoundingClientRect();
    const w = rect?.width || 320;
    const h = rect?.height || 420;
    canvas.width = w;
    canvas.height = h;

    // Pre-flight: verify WebGL context can be obtained.
    const testGl =
      canvas.getContext("webgl2", { alpha: true, antialias: true }) ||
      canvas.getContext("webgl", { alpha: true, antialias: true });
    if (!testGl) {
      console.warn("[useThreeVrm] WebGL context unavailable — skipping init");
      setError("WebGL not available");
      return;
    }

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: testGl,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(w, h);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera — fuller body framing (hands + upper legs visible)
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, w / h, 0.1, 20);
    camera.position.copy(CAMERA_POSITION);
    camera.lookAt(CAMERA_LOOK_AT);
    cameraRef.current = camera;

    // Lights
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(1, 2, 1);
    scene.add(dirLight);

    const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambLight);

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        // Responsive camera distance — further on desktop (smaller model)
        camera.position.z = getCameraZ();
        camera.updateProjectionMatrix();
      }
    });
    if (parent) resizeObserver.observe(parent);

    // Clock
    const clock = clockRef.current;
    clock.start();

    // ---- Helper: apply animation channels with emotion modulation ----
    const applyChannelsModulated = (
      vrm: VRM,
      channels: IdleAnimChannel[],
      elapsed: number,
      ampScale: number = 1.0,
      freqScale: number = 1.0,
      isBreathing: boolean = false,
      breathingRate: number = 1.0,
      breathingDepth: number = 1.0,
    ) => {
      const tempEuler = tempEulerRef.current;
      const tempQuat = tempQuatRef.current;

      for (const ch of channels) {
        const bone = vrm.humanoid?.getNormalizedBoneNode(ch.boneName as VRMHumanBoneName);
        if (!bone) continue;

        // Apply breathing rate/depth modifiers for breathing channels
        let finalFreq = ch.frequency * freqScale;
        let finalAmp = ch.amplitude * ampScale;

        if (isBreathing && (ch.boneName === "hips" || ch.boneName === "spine" || ch.boneName === "leftShoulder" || ch.boneName === "rightShoulder")) {
          finalFreq *= breathingRate;
          finalAmp *= breathingDepth;
        }

        const value =
          Math.sin(elapsed * finalFreq * Math.PI * 2 + ch.phase) *
          finalAmp;

        if (ch.type === "rotation") {
          tempEuler.set(
            ch.axis === "x" ? value : 0,
            ch.axis === "y" ? value : 0,
            ch.axis === "z" ? value : 0,
          );
          tempQuat.setFromEuler(tempEuler);
          if (ch.space === "parent") {
            bone.quaternion.premultiply(tempQuat);
          } else {
            bone.quaternion.multiply(tempQuat);
          }
        } else {
          // Position offset (hips breathing / weight shift)
          if (ch.boneName === "hips") {
            if (ch.axis === "y") {
              bone.position.y = hipsBaseYRef.current + value;
            } else if (ch.axis === "x") {
              bone.position.x = hipsBaseXRef.current + value;
            }
          }
        }
      }
    };

    // ---- Helper: apply ABSOLUTE target pose via slerp from rest ----
    // Used for state poses (speaking, thinking, listening) where arm bones
    // need correct world-space targeting.
    const applyStatePose = (
      vrm: VRM,
      targetPose: Record<string, { rotation?: [number, number, number, number] }>,
      blend: number,
      boneRestQuats: Map<string, THREE.Quaternion>,
    ) => {
      const tempQuat = tempQuatRef.current;

      for (const [boneName, transform] of Object.entries(targetPose)) {
        if (!transform.rotation) continue;
        const bone = vrm.humanoid?.getNormalizedBoneNode(boneName as VRMHumanBoneName);
        if (!bone) continue;

        tempQuat.set(
          transform.rotation[0],
          transform.rotation[1],
          transform.rotation[2],
          transform.rotation[3],
        );

        // Slerp from rest-pose quaternion to absolute target
        const rest = boneRestQuats.get(boneName);
        if (rest) {
          bone.quaternion.copy(rest).slerp(tempQuat, blend);
        } else {
          bone.quaternion.set(0, 0, 0, 1).slerp(tempQuat, blend);
        }
      }
    };

    // ---- Helper: apply pose offsets via multiply (for finger/emotion poses) ----
    const applyPoseMultiply = (
      vrm: VRM,
      poseOffset: Record<string, { rotation?: [number, number, number, number] }>,
      blend: number,
    ) => {
      const tempQuat = tempQuatRef.current;
      const identity = new THREE.Quaternion();

      for (const [boneName, transform] of Object.entries(poseOffset)) {
        if (!transform.rotation) continue;
        const bone = vrm.humanoid?.getNormalizedBoneNode(boneName as VRMHumanBoneName);
        if (!bone) continue;

        tempQuat.set(
          transform.rotation[0],
          transform.rotation[1],
          transform.rotation[2],
          transform.rotation[3],
        );
        identity.set(0, 0, 0, 1);
        identity.slerp(tempQuat, blend);
        bone.quaternion.multiply(identity);
      }
    };

    // ---- Helper: lerp emotion modulator toward target ----
    const lerpModulators = (
      current: EmotionModulators,
      target: EmotionModulators,
      speed: number,
    ) => {
      for (const key of MODULATOR_NUMERIC_KEYS) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (current as any)[key] = lerp(
          current[key] as number,
          target[key] as number,
          speed,
        );
      }
      for (const key of MODULATOR_TUPLE_KEYS) {
        const cur = current[key] as [number, number];
        const tgt = target[key] as [number, number];
        cur[0] = lerp(cur[0], tgt[0], speed);
        cur[1] = lerp(cur[1], tgt[1], speed);
      }
    };

    // ---- RAF Loop ----
    let frameCount = 0;
    const animate = () => {
      rafIdRef.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.elapsedTime;
      const vrm = vrmRef.current;

      if (vrm) {
        try {
        frameCount++;
        if (frameCount === 1) {
          console.log("[useThreeVrm] RAF loop active — VRM detected, rest quats:", restQuatsRef.current.size, "bones");
        }
        // 0. Lerp emotion modulators toward target (~1s smooth transition)
        const targetMod =
          EMOTION_MODULATORS[emotionModRef.current] || EMOTION_MODULATORS.neutral;
        const mod = currentModRef.current;
        lerpModulators(mod, targetMod, 0.03);

        // 0b. Update micro-expression engine
        const microEngine = microExprEngineRef.current;
        const microExpr = microEngine.tick(elapsed * 1000);

        // Calculate effective modulators blending base emotion with micro-expression
        let effectiveMod = mod;
        if (microExpr.expression && microExpr.intensity > 0) {
          const microMod = getEmotionModulator(microExpr.expression);
          effectiveMod = blendEmotionModulators(mod, microMod, microExpr.intensity);
        }

        // Update breathing phase with emotion-based rate
        breathingPhaseRef.current += delta * effectiveMod.breathingRate;

        // 1. Update VRM (spring bones + normalized→raw bone sync)
        vrm.update(delta);

        // 2. Reset all animated bones to rest-pose quaternions
        const restQuats = restQuatsRef.current;
        for (const [boneName, restQuat] of restQuats) {
          const bone = vrm.humanoid?.getNormalizedBoneNode(boneName as VRMHumanBoneName);
          if (bone) {
            bone.quaternion.copy(restQuat);
          }
        }

        // 3. State-based pose blending
        const currentState = avatarStateRef.current;
        if (currentState !== prevStateRef.current) {
          stateBlendRef.current = 0;
          prevStateRef.current = currentState;
        }
        if (stateBlendRef.current < 1.0) {
          stateBlendRef.current = Math.min(
            1.0,
            stateBlendRef.current + delta * STATE_BLEND_SPEED,
          );
        }

        // For speaking state, use emotion-specific pose; fallback to default
        let stateOffset = STATE_POSE_OFFSETS[currentState];
        if (currentState === "speaking") {
          const emotionPose = EMOTION_SPEAKING_POSES[emotionModRef.current];
          if (emotionPose) stateOffset = emotionPose;
        }
        if (stateOffset) {
          applyStatePose(vrm, stateOffset, stateBlendRef.current, restQuats);
        }

        // 3b. Emotion posture modulation (spine lean + shoulder offset + head tilt + head nod)
        if (effectiveMod.postureLean !== 0) {
          const spine = vrm.humanoid?.getNormalizedBoneNode("spine" as VRMHumanBoneName);
          if (spine) {
            tempEulerRef.current.set(effectiveMod.postureLean, 0, 0);
            tempQuatRef.current.setFromEuler(tempEulerRef.current);
            spine.quaternion.multiply(tempQuatRef.current);
          }
        }
        if (effectiveMod.shoulderOffset !== 0) {
          const lShoulder = vrm.humanoid?.getNormalizedBoneNode("leftShoulder" as VRMHumanBoneName);
          const rShoulder = vrm.humanoid?.getNormalizedBoneNode("rightShoulder" as VRMHumanBoneName);
          if (lShoulder) {
            tempEulerRef.current.set(0, 0, effectiveMod.shoulderOffset);
            tempQuatRef.current.setFromEuler(tempEulerRef.current);
            lShoulder.quaternion.multiply(tempQuatRef.current);
          }
          if (rShoulder) {
            tempEulerRef.current.set(0, 0, -effectiveMod.shoulderOffset);
            tempQuatRef.current.setFromEuler(tempEulerRef.current);
            rShoulder.quaternion.multiply(tempQuatRef.current);
          }
        }

        // Apply head tilt and nod + micro-expression offsets
        const head = vrm.humanoid?.getNormalizedBoneNode("head" as VRMHumanBoneName);
        if (head) {
          const totalTilt = effectiveMod.headTilt + microExpr.headTilt;
          const totalNod = effectiveMod.headNod + microExpr.headNod;

          if (totalTilt !== 0 || totalNod !== 0) {
            tempEulerRef.current.set(totalNod, 0, totalTilt);
            tempQuatRef.current.setFromEuler(tempEulerRef.current);
            head.quaternion.multiply(tempQuatRef.current);
          }
        }

        // 4. Layer idle sway animation channels (emotion-modulated with breathing)
        applyChannelsModulated(
          vrm, IDLE_ANIM_CHANNELS, elapsed,
          effectiveMod.amplitudeScale, effectiveMod.frequencyScale,
          true, effectiveMod.breathingRate, effectiveMod.breathingDepth,
        );

        // 4b. Layer finger idle micro-movements (emotion-modulated)
        applyChannelsModulated(
          vrm, FINGER_IDLE_CHANNELS, elapsed,
          effectiveMod.fingerMicroScale * effectiveMod.amplitudeScale, effectiveMod.frequencyScale,
        );

        // 4c. Apply emotion-linked hand pose offsets (multiply — fine for fingers)
        const handOffset = EMOTION_HAND_OFFSETS[emotionModRef.current];
        if (handOffset) {
          applyPoseMultiply(vrm, handOffset, stateBlendRef.current);
        }

        // 5. Layer state-specific gestures
        if (currentState === "speaking") {
          // 5a. Speaking gestures + finger channels
          // Gesture phase drift — slowly shifts patterns for natural variety (~7s cycle)
          const gesturePhaseShift = elapsed * 0.15;

          // Apply base speaking channels (reduced amplitude when discrete gesture is active)
          const baseGestureScale = gesturePlayerRef.current.isPlaying
            ? effectiveMod.gestureScale * 0.35  // Reduce base when discrete gesture playing
            : effectiveMod.gestureScale;
          applyChannelsModulated(
            vrm, SPEAKING_GESTURE_CHANNELS,
            elapsed + gesturePhaseShift,
            baseGestureScale, effectiveMod.gestureSpeed,
          );
          applyChannelsModulated(
            vrm, SPEAKING_FINGER_CHANNELS, elapsed,
            baseGestureScale, effectiveMod.gestureSpeed,
          );

          // 5a-auto. Auto-trigger discrete gestures every 2-4s during speech
          // Produces natural hand movement variety beyond sine waves
          if (elapsed >= nextAutoGestureRef.current && !gesturePlayerRef.current.isPlaying) {
            const speakingGestures: GestureType[] = [
              'open_palm_up', 'both_hands_out', 'point_forward', 'soft_nod',
              'reach_out', 'counting_fingers', 'hands_together',
            ];
            const pick = speakingGestures[Math.floor(Math.random() * speakingGestures.length)];
            gesturePlayerRef.current.play(pick);
            // Next auto-gesture in 2.5-4.5s (randomized)
            nextAutoGestureRef.current = elapsed + 2.5 + Math.random() * 2.0;
          }

          // 5b. Occasionally trigger micro-expressions during speech
          if (Math.random() < 0.01) {
            microEngine.trigger("emphasizing", emotionModRef.current, elapsed * 1000);
          }
        } else if (currentState === "listening") {
          // 5a. Listening gestures — subtle attentive movement so avatar isn't frozen
          applyChannelsModulated(
            vrm, LISTENING_GESTURE_CHANNELS, elapsed,
            effectiveMod.amplitudeScale * 0.6, effectiveMod.frequencyScale * 0.8,
          );

          // 5b. Trigger listening micro-expressions
          if (Math.random() < 0.005) {
            microEngine.trigger("listening", emotionModRef.current, elapsed * 1000);
          }
        } else if (currentState === "thinking") {
          // Trigger thinking micro-expressions
          if (Math.random() < 0.008) {
            microEngine.trigger("transitioning", emotionModRef.current, elapsed * 1000);
          }
        }

        // 5b. Discrete gesture layer — named gestures from ConversationDirector
        // Upper arms and shoulders use premultiply (parent space) because their
        // rest pose has large Z rotations — local-space multiply would push arms backward.
        const PARENT_SPACE_GESTURE_BONES = new Set([
          'leftUpperArm', 'rightUpperArm', 'leftShoulder', 'rightShoulder',
        ]);
        const gestureOffsets = gesturePlayerRef.current.tick(delta);
        for (const boneName in gestureOffsets) {
          const bone = vrm.humanoid?.getNormalizedBoneNode(boneName as VRMHumanBoneName);
          if (bone) {
            const offset = gestureOffsets[boneName];
            tempQuatRef.current.set(offset[0], offset[1], offset[2], offset[3]);
            if (PARENT_SPACE_GESTURE_BONES.has(boneName)) {
              bone.quaternion.premultiply(tempQuatRef.current);
            } else {
              bone.quaternion.multiply(tempQuatRef.current);
            }
          }
        }

        // 5c. Arm rotation clamping — prevent unnatural poses after all gesture layers
        if (currentState === "speaking" || currentState === "listening") {
          const clampEuler = tempEulerRef.current;
          for (const side of ["left", "right"] as const) {
            const upperName = side === "left" ? "leftUpperArm" : "rightUpperArm";
            const upperBone = vrm.humanoid?.getNormalizedBoneNode(upperName as VRMHumanBoneName);
            if (upperBone) {
              clampEuler.setFromQuaternion(upperBone.quaternion, "XYZ");
              // Clamp forward/back (X)
              clampEuler.x = Math.max(ARM_CLAMP_LIMITS.upperArmX.min, Math.min(ARM_CLAMP_LIMITS.upperArmX.max, clampEuler.x));
              // Clamp spread (Z) — mirrored for right arm
              if (side === "left") {
                clampEuler.z = Math.max(ARM_CLAMP_LIMITS.upperArmZ.min, Math.min(ARM_CLAMP_LIMITS.upperArmZ.max, clampEuler.z));
              } else {
                clampEuler.z = Math.max(-ARM_CLAMP_LIMITS.upperArmZ.max, Math.min(-ARM_CLAMP_LIMITS.upperArmZ.min, clampEuler.z));
              }
              upperBone.quaternion.setFromEuler(clampEuler);
            }

            const lowerName = side === "left" ? "leftLowerArm" : "rightLowerArm";
            const lowerBone = vrm.humanoid?.getNormalizedBoneNode(lowerName as VRMHumanBoneName);
            if (lowerBone) {
              clampEuler.setFromQuaternion(lowerBone.quaternion, "XYZ");
              clampEuler.x = Math.max(ARM_CLAMP_LIMITS.lowerArmX.min, Math.min(ARM_CLAMP_LIMITS.lowerArmX.max, clampEuler.x));
              lowerBone.quaternion.setFromEuler(clampEuler);
            }
          }
        }

        // 6. Enhanced blink (emotion-modulated interval + double-blink + micro-expression modifier)
        const blinkQueue = blinkQueueRef.current;
        const blinkMultiplier = microExpr.blinkMultiplier;

        // Schedule new blink
        if (blinkQueue.length === 0 && blinkProgressRef.current < 0) {
          if (elapsed >= nextBlinkRef.current) {
            blinkQueue.push({ startTime: elapsed, progress: 0 });

            // Roll for double-blink
            if (Math.random() < effectiveMod.doubleBlinkProb) {
              blinkQueue.push({ startTime: elapsed + 0.25, progress: 0 });
            }

            // Schedule next blink from emotion modulator, modified by micro-expressions
            let [minBlink, maxBlink] = effectiveMod.blinkInterval;
            minBlink /= blinkMultiplier;
            maxBlink /= blinkMultiplier;
            nextBlinkRef.current = elapsed + minBlink + Math.random() * (maxBlink - minBlink);
          }
        }

        // Process blink queue
        let blinkValue = 0;
        for (let i = blinkQueue.length - 1; i >= 0; i--) {
          const blink = blinkQueue[i];
          if (elapsed < blink.startTime) continue; // not started yet

          blink.progress += delta / 0.15; // 150ms blink duration
          if (blink.progress >= 1) {
            blinkQueue.splice(i, 1);
            continue;
          }

          // Triangular wave: 0→1→0
          const v = blink.progress < 0.5
            ? blink.progress * 2
            : 2 - blink.progress * 2;
          blinkValue = Math.max(blinkValue, v);
        }
        vrm.expressionManager?.setValue("blink", Math.max(0, blinkValue));

        // 7. Tick external hooks (lip-sync + expressions + eye movement)
        lipSyncTickRef?.current?.();
        expressionsTickRef?.current?.();
        eyeMovementTickRef?.current?.();

        // 8. Apply emotion expression values from shared ref
        const exprValues = expressionValuesRef.current;
        for (const [name, value] of Object.entries(exprValues)) {
          vrm.expressionManager?.setValue(name, value);
        }

        // 9. Apply multi-viseme values (lip-sync mouth shapes)
        const visemes = visemeValuesRef.current;
        let hasActiveViseme = false;
        for (const [visemeName, weight] of Object.entries(visemes)) {
          vrm.expressionManager?.setValue(visemeName, weight);
          if (weight > 0.05) hasActiveViseme = true;
        }

        // 9b. Fallback mouth animation when speaking but no viseme data
        // (AudioContext not connected, VRM model lacks viseme shapes, etc.)
        if (currentState === "speaking" && !hasActiveViseme) {
          // Drive aa (jaw open) with multi-frequency oscillation for natural look
          const mouthOpen =
            0.25 +
            0.20 * Math.sin(elapsed * 4.5 * Math.PI * 2) +
            0.15 * Math.sin(elapsed * 2.8 * Math.PI * 2 + 0.7) +
            0.10 * Math.sin(elapsed * 7.2 * Math.PI * 2 + 1.3);
          const clampedMouth = Math.max(0, Math.min(1, mouthOpen));
          vrm.expressionManager?.setValue("aa", clampedMouth * 0.7);
          vrm.expressionManager?.setValue("oh", clampedMouth * 0.3);
        }

        // 10. Apply eye gaze values (lookLeft/Right/Up/Down)
        const eyeValues = eyeValuesRef.current;
        for (const [name, value] of Object.entries(eyeValues)) {
          vrm.expressionManager?.setValue(name, value);
        }

        } catch (err) {
          // Log but don't crash the RAF loop — avatar stays alive even if one frame errors
          console.error("[useThreeVrm] RAF loop error:", err);
        }
      }

      renderer.render(scene, camera);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    // Auto-load if vrmUrl provided
    if (vrmUrl) {
      loadVrm(vrmUrl);
    }

    // Cleanup
    return () => {
      cancelAnimationFrame(rafIdRef.current);
      resizeObserver.disconnect();

      // Dispose VRM
      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
        vrmRef.current.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material?.dispose();
            }
          }
        });
        vrmRef.current = null;
      }

      // Dispose renderer (do NOT call forceContextLoss — breaks Strict Mode)
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queueGesture = useCallback((type: GestureType) => {
    gesturePlayerRef.current.play(type);
  }, []);

  return { vrmRef, loadVrm, isLoading, error, queueGesture };
}
