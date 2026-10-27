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

  const [activeMode, setActiveModeState] = useState<DeviceMode>('phone');

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
  };

  const toggleDeviceMode = () => {
    setActiveModeState('phone');
  };

  // Hardware device type for reference
  const hardwareDeviceType: DeviceType = useMemo(() => {
    if (dimensions.width < 768) return 'phone';
    if (dimensions.width < 1024) return 'tablet';
    return 'desktop';
  }, [dimensions.width]);

  // App is phone-only
  const effectiveDeviceType: DeviceType = 'phone';
  const isPhone = true;
  const isTablet = false;
  const isDesktop = false;
  const isSimulatedPhone = dimensions.width >= 768;

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
