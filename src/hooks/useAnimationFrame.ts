import { useEffect, useRef } from "react";

export const useAnimationFrame = (
  callback: (deltaTime: number) => void,
  shouldAnimate = false
) => {
  const frameRef = useRef(0);
  const timeRef = useRef<number | undefined>(undefined);

  const animate = (time: number) => {
    if (timeRef.current != undefined) {
      const deltaTime = (time - timeRef.current) / 20;
      callback(deltaTime);
    }

    timeRef.current = time;
    frameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (shouldAnimate) {
      frameRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(frameRef.current);
    }

    return () => cancelAnimationFrame(frameRef.current);
  }, [shouldAnimate, callback]); // Added callback to deps
};
