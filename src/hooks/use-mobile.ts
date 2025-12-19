"use client";

import { useState, useEffect, useCallback } from 'react';

export interface DeviceInfo {
  isMobile: boolean;      // < 640px (phones)
  isTablet: boolean;      // 640px - 1024px (tablets)
  isDesktop: boolean;     // > 1024px
  isSmallMobile: boolean; // < 430px (small phones like iPhone SE)
  width: number;
  height: number;
}

// Breakpoints matching Tailwind defaults
export const BREAKPOINTS = {
  SM: 640,   // Small phones
  MD: 768,   // Tablets
  LG: 1024,  // Desktop
  XL: 1280,  // Large desktop
} as const;

/**
 * Hook to detect device type and screen size changes
 * Updates on window resize with debouncing for performance
 */
export function useMobile(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    // SSR-safe initial state
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isSmallMobile: false,
        width: 1920,
        height: 1080,
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    return {
      isMobile: width < BREAKPOINTS.MD,
      isTablet: width >= BREAKPOINTS.MD && width < BREAKPOINTS.LG,
      isDesktop: width >= BREAKPOINTS.LG,
      isSmallMobile: width < 430,
      width,
      height,
    };
  });

  const updateDeviceInfo = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    setDeviceInfo({
      isMobile: width < BREAKPOINTS.MD,
      isTablet: width >= BREAKPOINTS.MD && width < BREAKPOINTS.LG,
      isDesktop: width >= BREAKPOINTS.LG,
      isSmallMobile: width < 430,
      width,
      height,
    });
  }, []);

  useEffect(() => {
    // Set initial value on client
    updateDeviceInfo();

    // Debounced resize handler
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateDeviceInfo, 100);
    };

    window.addEventListener('resize', handleResize);

    // Also listen for orientation changes on mobile
    window.addEventListener('orientationchange', updateDeviceInfo);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', updateDeviceInfo);
      clearTimeout(timeoutId);
    };
  }, [updateDeviceInfo]);

  return deviceInfo;
}

/**
 * Simple hook to check if screen is below a specific breakpoint
 */
export function useBreakpoint(breakpoint: number = BREAKPOINTS.MD): boolean {
  const [isBelowBreakpoint, setIsBelowBreakpoint] = useState(false);

  useEffect(() => {
    const checkBreakpoint = () => {
      setIsBelowBreakpoint(window.innerWidth < breakpoint);
    };

    checkBreakpoint();

    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(checkBreakpoint, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [breakpoint]);

  return isBelowBreakpoint;
}

export default useMobile;
