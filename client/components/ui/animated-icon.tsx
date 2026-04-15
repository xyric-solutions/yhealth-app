"use client";

/**
 * @file Animated Icon Component
 * @description Wrapper around Lordicon animated icons with hover/click triggers.
 * Uses free Lordicon CDN icons — no API key needed.
 *
 * Usage:
 *   <AnimatedIcon icon="wallet" size={32} trigger="hover" />
 *   <AnimatedIcon icon="receipt" size={24} trigger="loop" colors={{ primary: "#34d399" }} />
 *
 * Icon catalog: https://lordicon.com/icons
 */

import { useEffect, useRef, useState } from "react";

// Lordicon CDN icon URLs — free animated icons
const ICON_MAP: Record<string, string> = {
  // Finance
  wallet:      "https://cdn.lordicon.com/qhviklyi.json",
  money:       "https://cdn.lordicon.com/ifsxxxte.json",
  receipt:     "https://cdn.lordicon.com/fpmskzsv.json",
  chart:       "https://cdn.lordicon.com/fyhbrifa.json",
  trending:    "https://cdn.lordicon.com/aklfruoc.json",
  piggyBank:   "https://cdn.lordicon.com/lniltbhx.json",
  creditCard:  "https://cdn.lordicon.com/qmcsqnle.json",
  bank:        "https://cdn.lordicon.com/wlpxtupd.json",

  // Actions
  scan:        "https://cdn.lordicon.com/fqbvgezn.json",
  upload:      "https://cdn.lordicon.com/smwmetfi.json",
  download:    "https://cdn.lordicon.com/ternnbni.json",
  check:       "https://cdn.lordicon.com/oqdmuxru.json",
  plus:        "https://cdn.lordicon.com/mecwbjnp.json",
  edit:        "https://cdn.lordicon.com/wloilxuq.json",
  trash:       "https://cdn.lordicon.com/skkahier.json",
  search:      "https://cdn.lordicon.com/kkvxgpti.json",
  filter:      "https://cdn.lordicon.com/zniqnylq.json",

  // Categories
  food:        "https://cdn.lordicon.com/ndydpcaq.json",
  shopping:    "https://cdn.lordicon.com/slkvcfos.json",
  health:      "https://cdn.lordicon.com/enzmygww.json",
  transport:   "https://cdn.lordicon.com/uetqnvvg.json",
  education:   "https://cdn.lordicon.com/kipaqhoz.json",
  entertainment: "https://cdn.lordicon.com/aklfruoc.json",

  // Wellness / General
  sparkle:     "https://cdn.lordicon.com/hvuelaug.json",
  fire:        "https://cdn.lordicon.com/lqxfrfew.json",
  trophy:      "https://cdn.lordicon.com/jxzkkoed.json",
  star:        "https://cdn.lordicon.com/surjmvno.json",
  bell:        "https://cdn.lordicon.com/psnhyobz.json",
  settings:    "https://cdn.lordicon.com/hwuyodym.json",
  target:      "https://cdn.lordicon.com/ggihhudh.json",
  rocket:      "https://cdn.lordicon.com/akqsdstj.json",
  brain:       "https://cdn.lordicon.com/brecebjk.json",
  heart:       "https://cdn.lordicon.com/ohfmmfhn.json",
  lightning:   "https://cdn.lordicon.com/qhkvfxpn.json",
  eye:         "https://cdn.lordicon.com/fmjvulnr.json",
  camera:      "https://cdn.lordicon.com/vixtkkbk.json",
  music:       "https://cdn.lordicon.com/kiqfzwfb.json",
  lock:        "https://cdn.lordicon.com/eouimtlu.json",
  ai:          "https://cdn.lordicon.com/hvuelaug.json",
  success:     "https://cdn.lordicon.com/oqdmuxru.json",
  error:       "https://cdn.lordicon.com/usownftb.json",
  loading:     "https://cdn.lordicon.com/xjovhxra.json",
  notification: "https://cdn.lordicon.com/psnhyobz.json",

  // Sidebar Navigation
  dashboard:   "https://cdn.lordicon.com/wmwqvixz.json",
  dumbbell:    "https://cdn.lordicon.com/zpcieyfp.json",
  calendar:    "https://cdn.lordicon.com/abfverha.json",
  award:       "https://cdn.lordicon.com/yqzmiobz.json",
  users:       "https://cdn.lordicon.com/bhfjfgqz.json",
  flower:      "https://cdn.lordicon.com/jkgunhbs.json",
  book:        "https://cdn.lordicon.com/zyzoecaw.json",
  smile:       "https://cdn.lordicon.com/ioanmawh.json",
  lightbulb:   "https://cdn.lordicon.com/vdjwmfqs.json",
  leaf:        "https://cdn.lordicon.com/svnahxzb.json",
  message:     "https://cdn.lordicon.com/fdxqrdfe.json",
  microphone:  "https://cdn.lordicon.com/ssvybplt.json",
  phone:       "https://cdn.lordicon.com/tftaqjwp.json",
  user:        "https://cdn.lordicon.com/kthelypq.json",
  sliders:     "https://cdn.lordicon.com/gqdnbnwt.json",
  shield:      "https://cdn.lordicon.com/jmkrnisz.json",
  logout:      "https://cdn.lordicon.com/moscwhoj.json",
};

export type AnimatedIconName = keyof typeof ICON_MAP;
export type AnimatedIconTrigger = "hover" | "click" | "loop" | "loop-on-hover" | "morph" | "bouncein" | "in" | "sequence";

interface AnimatedIconProps {
  icon: AnimatedIconName;
  size?: number;
  trigger?: AnimatedIconTrigger;
  delay?: number;
  colors?: {
    primary?: string;
    secondary?: string;
  };
  className?: string;
  stroke?: number;
}

/**
 * Renders an animated Lordicon icon using the native <lord-icon> web component.
 * Falls back gracefully if the script hasn't loaded.
 */
export function AnimatedIcon({
  icon,
  size = 28,
  trigger = "hover",
  delay = 0,
  colors,
  className = "",
  stroke,
}: AnimatedIconProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [_scriptLoaded, setScriptLoaded] = useState(false);

  // Load the Lordicon player script once
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already loaded
    if (document.querySelector('script[src*="lordicon"]')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync check for already-loaded script
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.lordicon.com/lordicon.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Don't remove — other instances may need it
    };
  }, []);

  const src = ICON_MAP[icon];
  if (!src) return null;

  const colorStr = colors
    ? `primary:${colors.primary || "#34d399"},secondary:${colors.secondary || "#38bdf8"}`
    : "primary:#34d399,secondary:#38bdf8";

  return (
    <div
      ref={containerRef}
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* @ts-expect-error lord-icon is a web component */}
      <lord-icon
        src={src}
        trigger={trigger}
        delay={delay}
        colors={colorStr}
        style={{ width: `${size}px`, height: `${size}px` }}
        {...(stroke ? { stroke: String(stroke) } : {})}
      />
    </div>
  );
}

/**
 * Predefined icon configurations for common use cases
 */
export const AnimatedIcons = {
  walletHover: (size = 28) => <AnimatedIcon icon="wallet" size={size} trigger="hover" />,
  receiptScan: (size = 28) => <AnimatedIcon icon="scan" size={size} trigger="hover" colors={{ primary: "#38bdf8" }} />,
  moneyUp: (size = 28) => <AnimatedIcon icon="trending" size={size} trigger="loop" colors={{ primary: "#34d399" }} />,
  successCheck: (size = 28) => <AnimatedIcon icon="success" size={size} trigger="in" colors={{ primary: "#34d399" }} />,
  sparkleAI: (size = 28) => <AnimatedIcon icon="sparkle" size={size} trigger="loop" delay={2000} colors={{ primary: "#a78bfa" }} />,
  fireStreak: (size = 28) => <AnimatedIcon icon="fire" size={size} trigger="loop" delay={1500} colors={{ primary: "#f59e0b", secondary: "#ef4444" }} />,
  trophyWin: (size = 28) => <AnimatedIcon icon="trophy" size={size} trigger="in" colors={{ primary: "#f59e0b" }} />,
  heartPulse: (size = 28) => <AnimatedIcon icon="heart" size={size} trigger="loop" delay={1000} colors={{ primary: "#f43f5e" }} />,
  rocketLaunch: (size = 28) => <AnimatedIcon icon="rocket" size={size} trigger="hover" colors={{ primary: "#8b5cf6" }} />,
  loadingLoop: (size = 28) => <AnimatedIcon icon="loading" size={size} trigger="loop" />,
};
