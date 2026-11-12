import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';

interface BackToTopButtonProps {
  isDarkMode?: boolean;
  scrollThreshold?: number;
}

export const BackToTopButton: React.FC<BackToTopButtonProps> = ({
  isDarkMode = false,
  scrollThreshold = 300,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const scrolledElementsRef = useRef<Set<HTMLElement>>(new Set());

  useEffect(() => {
    const checkScrollPosition = (target?: EventTarget | null) => {
      const windowScrollY =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;

      if (
        target &&
        target instanceof HTMLElement &&
        target !== document.documentElement &&
        target !== document.body &&
        target.clientHeight >= 250
      ) {
        if (target.scrollTop > scrollThreshold) {
          scrolledElementsRef.current.add(target);
        } else {
          scrolledElementsRef.current.delete(target);
        }
      }

      // Clean up any detached elements or elements that returned to top
      scrolledElementsRef.current.forEach((el) => {
        if (!document.body.contains(el) || el.scrollTop <= scrollThreshold) {
          scrolledElementsRef.current.delete(el);
        }
      });

      const hasScrolledContainer = scrolledElementsRef.current.size > 0;
      setIsVisible(windowScrollY > scrollThreshold || hasScrolledContainer);
    };

    const handleScroll = (e: Event) => {
      checkScrollPosition(e.target);
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    checkScrollPosition();

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true } as EventListenerOptions);
    };
  }, [scrollThreshold]);

  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });

    if (document.documentElement) {
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (document.body) {
      document.body.scrollTo({ top: 0, behavior: 'smooth' });
    }

    scrolledElementsRef.current.forEach((el) => {
      try {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        el.scrollTop = 0;
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleScrollToTop}
      aria-label="Volver arriba"
      title="Volver arriba"
      className={`fixed bottom-6 right-6 z-40 group flex items-center justify-center rounded-full p-3.5 shadow-xl transition-all duration-300 ease-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 ${
        isDarkMode
          ? 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30 shadow-indigo-950/60'
          : 'bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500/20 shadow-indigo-600/30'
      } ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 translate-y-4 scale-90 pointer-events-none'
      } active:scale-95`}
    >
      <ArrowUp
        size={20}
        className="stroke-[2.5] shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5"
      />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-black uppercase tracking-wider opacity-0 transition-all duration-300 ease-out group-hover:max-w-[120px] group-hover:pl-2 group-hover:pr-1 group-hover:opacity-100">
        Volver arriba
      </span>
    </button>
  );
};
