import { useEffect, useRef } from "react";

/**
 * Canvas-based interactive + flickering grid background.
 * Squares gently pulse on their own and brighten near the cursor.
 */
function FlickeringGrid({
  color = "56, 240, 224", // cyan, as an "r, g, b" string
  squareSize = 4,
  gap = 6,
  maxOpacity = 0.28,
  interactiveRadius = 260,
}) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const cell = squareSize + gap;

    let raf;
    let squares = [];
    let cols, rows, w, h;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      cols = Math.ceil(w / cell) + 1;
      rows = Math.ceil(h / cell) + 1;
      squares = new Array(cols * rows).fill(0).map(() => ({
        base: Math.random() * maxOpacity,
        phase: Math.random() * Math.PI * 2,
      }));
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      const { x: cx, y: cy } = mouseRef.current;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const sq = squares[i];
          const x = c * cell;
          const y = r * cell;

          const flicker = 0.5 + 0.5 * Math.sin(t * 0.0012 + sq.phase);
          let opacity = sq.base * flicker;

          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < interactiveRadius) {
            const boost = 1 - dist / interactiveRadius;
            opacity = Math.min(0.85, opacity + boost * 0.6);
          }

          if (opacity > 0.015) {
            ctx.fillStyle = `rgba(${color}, ${opacity})`;
            ctx.fillRect(x, y, squareSize, squareSize);
          }
        }
      }
      raf = requestAnimationFrame(draw);
    }

    function handleMouseMove(e) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }
    function handleMouseLeave() {
      mouseRef.current = { x: -9999, y: -9999 };
    }

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [color, squareSize, gap, maxOpacity, interactiveRadius]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}

export default FlickeringGrid;