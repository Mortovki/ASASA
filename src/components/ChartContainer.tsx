import React, { useRef, useState, useEffect } from 'react';
import { ResponsiveContainer } from 'recharts';

interface ChartContainerProps {
  children: React.ReactElement;
  height?: number | string;
  minHeight?: number;
  className?: string;
  isDarkMode?: boolean;
  aspect?: number;
  debounce?: number;
}

/**
 * Resilient chart wrapper that completely prevents Recharts `width(-1)` / `height(-1)`
 * layout warnings by measuring the container with a ResizeObserver and only mounting
 * the chart once valid positive dimensions (> 0) are established.
 */
export const ChartContainer: React.FC<ChartContainerProps> = ({
  children,
  height = '100%',
  minHeight = 220,
  className = '',
  isDarkMode = false,
  aspect,
  debounce = 60,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Check initial dimensions immediately if available
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({ width: rect.width, height: rect.height });
      setIsReady(true);
    }

    let timeoutId: any;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entry = entries[0];
      const { width, height: entryHeight } = entry.contentRect;

      if (width > 0 && entryHeight > 0) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setDimensions({ width, height: entryHeight });
          setIsReady(true);
        }, 16); // 1 frame debounce
      }
    });

    observer.observe(el);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full min-w-0 relative flex-1 ${className}`}
      style={{
        minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
        height: typeof height === 'number' ? `${height}px` : height,
        minWidth: 0,
      }}
    >
      {isReady && dimensions.width > 0 && dimensions.height > 0 ? (
        <ResponsiveContainer
          width={dimensions.width}
          height={dimensions.height}
          minWidth={1}
          minHeight={1}
          aspect={aspect}
          debounce={debounce}
        >
          {children}
        </ResponsiveContainer>
      ) : (
        <div 
          className={`w-full h-full flex items-center justify-center rounded-xl transition-colors ${
            isDarkMode ? 'bg-white/[0.02]' : 'bg-slate-50/50'
          }`}
          style={{ minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight }}
        >
          <div className="flex flex-col items-center gap-2 opacity-40">
            <div className={`w-6 h-6 border-2 rounded-full animate-spin ${
              isDarkMode ? 'border-white/20 border-t-indigo-400' : 'border-slate-300 border-t-indigo-600'
            }`} />
            <span className={`text-[10px] font-bold tracking-wider uppercase tabular-nums ${
              isDarkMode ? 'text-gray-400' : 'text-slate-500'
            }`}>
              Cargando gráfico...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartContainer;
