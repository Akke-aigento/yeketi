import { useRef, useState } from "react";
import { Play } from "lucide-react";
import mp4Asset from "@/assets/video/autogeen-lassen-720.mp4.asset.json";
import webmAsset from "@/assets/video/autogeen-lassen-540.webm.asset.json";
import posterAsset from "@/assets/video/autogeen-lassen-poster.jpg.asset.json";

type Props = {
  caption?: string;
  ariaLabel?: string;
  className?: string;
};

/**
 * Lazy-loaded, muted clip of the autogeen welding work.
 * preload="none" — no bytes fetched until the visitor presses play.
 */
export function WeldingVideo({ caption, ariaLabel, className }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function start() {
    const v = ref.current;
    if (!v) return;
    v.play().then(() => setPlaying(true)).catch(() => {});
  }

  return (
    <figure className={className} style={{ margin: 0 }}>
      <div
        className="relative"
        style={{ border: "1px solid var(--charcoal)", background: "var(--charcoal)" }}
      >
        <video
          ref={ref}
          poster={posterAsset.url}
          preload="none"
          playsInline
          muted
          loop
          controls={playing}
          aria-label={ariaLabel ?? "Autogeen-lassen in de werkplaats"}
          className="block w-full h-auto"
          style={{ aspectRatio: "16/9", objectFit: "cover" }}
          onClick={() => {
            if (!playing) start();
          }}
        >
          <source src={webmAsset.url} type="video/webm" />
          <source src={mp4Asset.url} type="video/mp4" />
        </video>
        {!playing && (
          <button
            type="button"
            onClick={start}
            aria-label="Speel de video — autogeen-lassen"
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(20,20,20,0.18)" }}
          >
            <span
              className="flex items-center justify-center"
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "50%",
                background: "var(--cream)",
                border: "1px solid var(--brass)",
                color: "var(--charcoal)",
              }}
            >
              <Play size={26} fill="currentColor" />
            </span>
          </button>
        )}
      </div>
      {caption && (
        <figcaption
          className="mt-3"
          style={{
            fontFamily: "var(--font-italic)",
            fontStyle: "italic",
            color: "var(--charcoal-soft)",
            fontSize: "0.9rem",
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}