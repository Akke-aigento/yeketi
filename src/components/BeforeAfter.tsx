import { useRef, useState, useCallback, useEffect } from "react";

export function BeforeAfter({
  before,
  after,
  alt,
}: {
  before: string;
  after: string;
  alt: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      setFromClientX(e.clientX);
    };
    const up = () => (dragging.current = false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [setFromClientX]);

  return (
    <div
      ref={ref}
      className="relative w-full select-none overflow-hidden"
      style={{ aspectRatio: "16 / 11", border: "1px solid var(--charcoal)" }}
      onPointerDown={(e) => {
        dragging.current = true;
        setFromClientX(e.clientX);
      }}
      role="img"
      aria-label={alt}
    >
      <img
        src={after}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <div
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${pos}%` }}
      >
        <img
          src={before}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full object-cover"
          style={{ width: `${(100 / pos) * 100}%`, maxWidth: "none" }}
          draggable={false}
        />
      </div>

      {/* Labels */}
      <span className="absolute top-3 left-3 eyebrow" style={{ color: "var(--cream)", background: "color-mix(in oklab, var(--charcoal) 70%, transparent)", padding: "4px 10px" }}>
        Voor
      </span>
      <span className="absolute top-3 right-3 eyebrow" style={{ color: "var(--cream)", background: "color-mix(in oklab, var(--charcoal) 70%, transparent)", padding: "4px 10px" }}>
        Na
      </span>

      {/* Divider + handle */}
      <div
        className="absolute inset-y-0"
        style={{ left: `${pos}%`, width: "1px", background: "var(--cream)" }}
      >
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          style={{
            width: "44px",
            height: "44px",
            background: "var(--cream)",
            border: "1px solid var(--charcoal)",
            color: "var(--charcoal)",
            fontFamily: "var(--font-display)",
          }}
        >
          ‹ ›
        </div>
      </div>
    </div>
  );
}