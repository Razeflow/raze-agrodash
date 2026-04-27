import { useState, useEffect, useRef } from "react";

/**
 * Keeps a component mounted during its CSS exit transition.
 *
 * @param open  - the "logical" open state from the parent
 * @param duration - ms to wait for the exit animation before unmounting (default 250)
 * @returns { mounted, visible }
 *   mounted — render the DOM when true; false = safe to return null
 *   visible — apply the "enter" CSS class when true; remove it to trigger exit
 */
export function useAnimatedMount(open: boolean, duration = 250) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (open) {
      clearTimeout(timerRef.current);
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      timerRef.current = setTimeout(() => setMounted(false), duration);
    }
    return () => clearTimeout(timerRef.current);
  }, [open, duration]);

  return { mounted, visible };
}
