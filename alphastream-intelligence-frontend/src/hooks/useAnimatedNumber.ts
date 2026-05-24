import { useState, useEffect, useRef } from 'react';

/**
 * Easing function: ease-out cubic — 1 - (1-t)^3
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface UseAnimatedNumberOptions {
  /** Animation duration in ms. Default: 300 */
  duration?: number;
  /** Custom easing function (t: 0..1) => 0..1 */
  easing?: (t: number) => number;
  /** Round to N decimal places for the output value. Default: no rounding */
  decimals?: number;
}

/**
 * Smoothly animates a number value using requestAnimationFrame.
 * Returns the current animated value.
 *
 * @example
 * const animatedPrice = useAnimatedNumber(price, { duration: 300, decimals: 2 });
 */
export function useAnimatedNumber(
  target: number,
  options: UseAnimatedNumberOptions = {}
): number {
  const {
    duration = 300,
    easing = easeOutCubic,
    decimals,
  } = options;

  const [current, setCurrent] = useState<number>(target);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef<number>(target);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef<number>(target);

  useEffect(() => {
    // Skip animation on first mount — just set directly
    if (targetRef.current === target && startRef.current === null) {
      setCurrent(target);
      return;
    }

    fromRef.current = current;
    targetRef.current = target;
    startRef.current = null;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    const animate = (timestamp: number) => {
      if (startRef.current === null) {
        startRef.current = timestamp;
      }

      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);

      const next = fromRef.current + (targetRef.current - fromRef.current) * easedProgress;

      const rounded =
        decimals !== undefined
          ? parseFloat(next.toFixed(decimals))
          : next;

      setCurrent(rounded);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return current;
}

export default useAnimatedNumber;
