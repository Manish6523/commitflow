import React, { useEffect, useRef, useState } from 'react';

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

/** Below this width there isn't room for both panes side by side, so they stack. */
const STACK_BELOW = 680;
const MAX_LEFT_SHARE = 0.45;

export const ResizableSplit: React.FC<ResizableSplitProps> = ({
  left,
  right,
  initialWidth = 320,
  minWidth = 200,
  maxWidth = 640,
}) => {
  const [width, setWidth] = useState(initialWidth);
  const [containerWidth, setContainerWidth] = useState(Infinity);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(containerRef.current!);
    return () => observer.disconnect();
  }, []);

  const clamp = (value: number) => Math.min(maxWidth, Math.max(minWidth, value));
  const leftWidth = Math.min(width, Math.max(minWidth, containerWidth * MAX_LEFT_SHARE));

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging) return;
    setWidth(clamp(event.clientX - containerRef.current!.getBoundingClientRect().left));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') setWidth((w) => clamp(w - 16));
    if (event.key === 'ArrowRight') setWidth((w) => clamp(w + 16));
  };

  const stacked = containerWidth < STACK_BELOW;

  return (
    <div ref={containerRef} className={`flex h-full min-h-0 overflow-hidden ${stacked ? 'flex-col' : ''}`}>
      <div
        style={stacked ? { height: '40%' } : { width: leftWidth }}
        className={`shrink-0 min-w-0 ${stacked ? 'border-b border-vscode-border' : 'h-full'}`}
      >
        {left}
      </div>
      {!stacked && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={leftWidth}
          tabIndex={0}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={() => setDragging(false)}
          onKeyDown={onKeyDown}
          className={`w-1 shrink-0 cursor-col-resize transition-colors hover:bg-blue-500/60 ${
            dragging ? 'bg-blue-500/60' : 'bg-vscode-border'
          }`}
        />
      )}
      <div className="flex-1 min-w-0 min-h-0">{right}</div>
    </div>
  );
};
