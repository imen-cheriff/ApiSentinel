import { useEffect, useRef } from "react";

const DEFAULTS = {
  headColor: "#eafffb",
  trailColor: "#155e56",
  glyphSize: 14,
  speed: 4,
  angle: 0,
  density: 40,
  trail: 16,
  glyphs: "ｱｲｳｴｵｶｷｸ0123456789ABCDEFｸｿﾝ",
  shuffle: true,
  shuffleGlyphs: "ｱｲｳｴｵｶｷｸ0123456789ABCDEFｸｿﾝ",
};

// A stream either runs the full height or dies somewhere past this much of it.
const MIN_BURNOUT = 0.75;
// Share of streams that make it all the way across without fading.
const CROSSING_SHARE = 0.35;
// A column releases its next stream once the current one is this far down,
// randomised per release so columns never fall into a repeating pattern.
const MIN_RELEASE = 0.3;
const MAX_RELEASE = 0.8;

/**
 * Canvas-based ASCII / digital rain effect, sized to fill its parent.
 * Use inside a `fixed inset-0` wrapper to cover the viewport as a page background.
 */
function DigitalRain({
  headColor = DEFAULTS.headColor,
  trailColor = DEFAULTS.trailColor,
  glyphSize = DEFAULTS.glyphSize,
  speed = DEFAULTS.speed,
  angle = DEFAULTS.angle,
  density = DEFAULTS.density,
  trail = DEFAULTS.trail,
  glyphs = DEFAULTS.glyphs,
  shuffle = DEFAULTS.shuffle,
  shuffleGlyphs = DEFAULTS.shuffleGlyphs,
  style,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const source = shuffle
      ? shuffleGlyphs || DEFAULTS.shuffleGlyphs
      : glyphs || DEFAULTS.glyphs;
    const chars = [...source];
    const pick = () => chars[Math.floor(Math.random() * chars.length)];
    const rad = (angle * Math.PI) / 180;
    const rate = speed * glyphSize;
    const gap = glyphSize * (1 + (50 - density) / 12);
    const tailLength = Math.max(1, Math.round(trail));

    let alive = true;
    let raf = 0;
    let last = 0;
    let w = 0;
    let h = 0;
    let span = 0;
    let cols = 0;
    let columns = [];

    function spawn(y) {
      return {
        y,
        rate: rate * (0.75 + Math.random() * 0.5),
        burnout:
          Math.random() < CROSSING_SHARE
            ? Infinity
            : MIN_BURNOUT + Math.random() * (1 - MIN_BURNOUT),
        alpha: 1,
        chars: Array.from({ length: tailLength }, pick),
      };
    }

    function nextRelease() {
      return span * (MIN_RELEASE + Math.random() * (MAX_RELEASE - MIN_RELEASE));
    }

    function layout() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = wrap.clientWidth || 360;
      h = wrap.clientHeight || 320;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      span = Math.hypot(w, h);
      cols = Math.max(1, Math.ceil(span / gap));
      columns = Array.from({ length: cols }, () => ({
        streams: [spawn(Math.random() * span)],
        releaseAt: nextRelease(),
      }));
    }

    function draw(dt) {
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rad);
      ctx.font = `${glyphSize}px ui-monospace, Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const lead = tailLength * glyphSize;

      for (let i = 0; i < cols; i++) {
        const column = columns[i];
        const x = -span / 2 + i * gap + gap / 2;

        for (const stream of column.streams) {
          stream.y += stream.rate * dt;

          const travelled = stream.y / span;
          if (stream.burnout !== Infinity && travelled > stream.burnout) {
            stream.alpha -= dt * 1.5;
          }

          if (shuffle && Math.random() < 0.25) {
            stream.chars[Math.floor(Math.random() * stream.chars.length)] = pick();
          }

          const headY = -span / 2 + stream.y;
          const columnAlpha = Math.max(0, Math.min(1, stream.alpha));

          for (let j = 0; j < tailLength; j++) {
            const y = headY - j * glyphSize;
            if (y < -span / 2 - glyphSize || y > span / 2 + glyphSize) continue;
            const taper = j === 0 ? 1 : 1 - j / tailLength;
            ctx.globalAlpha = columnAlpha * taper;
            ctx.fillStyle = j === 0 ? headColor : trailColor;
            ctx.fillText(stream.chars[j], x, y);
          }
        }

        column.streams = column.streams.filter(
          (stream) => stream.alpha > 0 && stream.y - lead <= span
        );

        const newest = column.streams[column.streams.length - 1];
        if (!newest || newest.y >= column.releaseAt) {
          column.streams.push(spawn(-lead));
          column.releaseAt = nextRelease();
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function loop(time) {
      if (!alive) return;
      const dt = last ? Math.min((time - last) / 1000, 0.05) : 1 / 60;
      last = time;
      draw(dt);
      raf = requestAnimationFrame(loop);
    }

    layout();

    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(layout);
      ro.observe(wrap);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [
    headColor,
    trailColor,
    glyphSize,
    speed,
    angle,
    density,
    trail,
    glyphs,
    shuffle,
    shuffleGlyphs,
  ]);

  return (
    <div
      ref={wrapRef}
      style={{ ...style, position: "relative", overflow: "hidden" }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}

export default DigitalRain;