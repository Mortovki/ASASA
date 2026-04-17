import { useState, useEffect } from 'react';

export const useBreakpoint = () => {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getBreakpoint = (w: number): 'desktop' | 'tablet' | 'mobile' => {
    if (w < 768) return 'mobile';
    if (w < 1280) return 'tablet';
    return 'desktop';
  };

  return {
    breakpoint: getBreakpoint(width),
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1280,
    isDesktop: width >= 1280,
    width
  };
};
