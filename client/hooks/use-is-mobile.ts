"use client";

import { useState, useEffect } from "react";

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
}

const MOBILE_QUERY = "(max-width: 768px)";
const TABLET_QUERY = "(min-width: 769px) and (max-width: 1024px)";

export function useIsMobile(): DeviceInfo {
  const [device, setDevice] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
  });

  useEffect(() => {
    const mobileMatch = window.matchMedia(MOBILE_QUERY);
    const tabletMatch = window.matchMedia(TABLET_QUERY);

    const update = () => {
      setDevice({
        isMobile: mobileMatch.matches || ("ontouchstart" in window && window.innerWidth <= 768),
        isTablet: tabletMatch.matches,
      });
    };

    update();
    mobileMatch.addEventListener("change", update);
    tabletMatch.addEventListener("change", update);

    return () => {
      mobileMatch.removeEventListener("change", update);
      tabletMatch.removeEventListener("change", update);
    };
  }, []);

  return device;
}
