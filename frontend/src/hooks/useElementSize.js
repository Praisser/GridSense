import { useCallback, useLayoutEffect, useState } from "react";

export function useElementSize() {
  const [node, setNode] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ref = useCallback((nextNode) => setNode(nextNode), []);

  useLayoutEffect(() => {
    if (!node || typeof window === "undefined") return undefined;

    let frameId;
    const updateSize = (rect = node.getBoundingClientRect()) => {
      const nextSize = {
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      };

      setSize((current) =>
        current.width === nextSize.width && current.height === nextSize.height
          ? current
          : nextSize,
      );
    };

    updateSize();
    frameId = window.requestAnimationFrame(() => updateSize());

    if (!window.ResizeObserver) {
      const handleResize = () => updateSize();
      window.addEventListener("resize", handleResize);
      return () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener("resize", handleResize);
      };
    }

    const observer = new ResizeObserver(([entry]) => {
      updateSize(entry.contentRect);
    });

    observer.observe(node);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [node]);

  return [ref, size];
}
