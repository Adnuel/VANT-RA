import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

export type DeviceType = 'phone' | 'tablet' | 'desktop';
export type DeviceMode = 'auto' | 'phone' | 'desktop';

interface DeviceContextType {
  deviceType: DeviceType;
  activeMode: DeviceMode;
  setActiveMode: (mode: DeviceMode) => void;
  toggleDeviceMode: () => void;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  width: number;
  height: number;
  isSimulatedPhone: boolean;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  const [activeMode, setActiveModeState] = useState<DeviceMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vantera_device_mode');
      if (saved === 'phone' || saved === 'desktop' || saved === 'auto') {
        return saved;
      }
    }
    return 'auto';
  });

  const [isTouch, setIsTouch] = useState<boolean>(false);

  useEffect(() => {
    const checkTouch = () => {
      const hasTouch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches;
      setIsTouch(Boolean(hasTouch));
    };

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    checkTouch();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const setActiveMode = (mode: DeviceMode) => {
    setActiveModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vantera_device_mode', mode);
    }
  };

  const toggleDeviceMode = () => {
    setActiveModeState((prev) => {
      const next: DeviceMode = prev === 'auto' ? 'phone' : prev === 'phone' ? 'desktop' : 'auto';
      if (typeof window !== 'undefined') {
        localStorage.setItem('vantera_device_mode', next);
      }
      return next;
    });
  };

  // Physical screen category based on viewport
  const hardwareDeviceType: DeviceType = useMemo(() => {
    if (dimensions.width < 768) return 'phone';
    if (dimensions.width < 1024) return 'tablet';
    return 'desktop';
  }, [dimensions.width]);

  // Effective layout device type
  const effectiveDeviceType: DeviceType = useMemo(() => {
    if (activeMode === 'phone') return 'phone';
    if (activeMode === 'desktop') return 'desktop';
    return hardwareDeviceType;
  }, [activeMode, hardwareDeviceType]);

  const isPhone = effectiveDeviceType === 'phone';
  const isTablet = effectiveDeviceType === 'tablet';
  const isDesktop = effectiveDeviceType === 'desktop';

  // If user selected 'phone' mode while viewing on a wide desktop screen
  const isSimulatedPhone = activeMode === 'phone' && dimensions.width >= 768;

  const value = useMemo(
    () => ({
      deviceType: effectiveDeviceType,
      activeMode,
      setActiveMode,
      toggleDeviceMode,
      isPhone,
      isTablet,
      isDesktop,
      isTouch,
      width: dimensions.width,
      height: dimensions.height,
      isSimulatedPhone,
    }),
    [effectiveDeviceType, activeMode, isPhone, isTablet, isDesktop, isTouch, dimensions, isSimulatedPhone]
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
};

export const useDevice = (): DeviceContextType => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
};
