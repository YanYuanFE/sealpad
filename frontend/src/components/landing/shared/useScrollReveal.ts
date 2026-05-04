import { useEffect, useRef, useState } from "react";

type Options = { threshold?: number; once?: boolean; rootMargin?: string };

/**
 * Returns [ref, visible]. Attach `ref` to any element; `visible` flips to
 * true once the element crosses the IntersectionObserver threshold.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: Options = {},
) {
  const {
    threshold = 0.15,
    once = true,
    rootMargin = "0px 0px -50px 0px",
  } = options;
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries[0].isIntersecting;
        if (intersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once, rootMargin]);

  return [ref, visible] as const;
}
