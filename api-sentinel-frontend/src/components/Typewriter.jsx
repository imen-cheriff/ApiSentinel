import { useEffect, useState } from "react";

/**
 * Types out text one character at a time. Pass multiple `texts` to cycle
 * through them (type, hold, delete, next). A single-item array types once
 * and stops, cursor left blinking — the right mode for a page title.
 *
 * `prefix` renders as static, untyped text before the animated part, so
 * e.g. prefix="API " + texts={["Sentinel"]} reproduces "API Sentinel"
 * with only "Sentinel" animated and independently colored.
 */
function Typewriter({
  texts = ["Sentinel"],
  prefix = "",
  typeSpeed = 70,
  holdTime = 1400,
  deleteSpeed = 40,
  showCursor = true,
  hideCursorOnType = false,
  cursorChar = "_",
  color = "#e7edf7",
  typedColor = "#ffb454",
  cursorColor,
  className = "",
  style,
}) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);

  const list = (texts ?? []).filter((t) => typeof t === "string");
  const hasTexts = list.length > 0;

  // Typing state machine: one string in flight, one timeout scheduled per render.
  useEffect(() => {
    if (!hasTexts) return;
    let timeout;
    const currentText = list[currentTextIndex] ?? "";

    if (isDeleting) {
      if (displayText === "") {
        setIsDeleting(false);
        setCurrentTextIndex((prev) => (prev + 1) % list.length);
        setCurrentIndex(0);
      } else {
        timeout = setTimeout(
          () => setDisplayText((prev) => prev.slice(0, -1)),
          deleteSpeed
        );
      }
    } else {
      if (currentIndex < currentText.length) {
        timeout = setTimeout(() => {
          setDisplayText((prev) => prev + currentText[currentIndex]);
          setCurrentIndex((prev) => prev + 1);
        }, typeSpeed);
      } else if (list.length > 1) {
        timeout = setTimeout(() => setIsDeleting(true), holdTime);
      }
      // single string, fully typed: stay put, no delete/loop
    }

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, displayText, isDeleting, currentTextIndex, hasTexts]);

  // Cursor blink, plain interval, no animation library needed.
  useEffect(() => {
    const blink = setInterval(() => setCursorVisible((v) => !v), 500);
    return () => clearInterval(blink);
  }, []);

  const currentText = list[currentTextIndex] ?? "";
  const isActivelyTyping =
    isDeleting || (currentIndex > 0 && currentIndex < currentText.length);
  const cursorHidden = hideCursorOnType && isActivelyTyping;
  const resolvedCursorColor = cursorColor || typedColor;

  return (
    <span className={className} style={{ color, ...style }}>
      {prefix}
      <span style={{ color: typedColor }}>{displayText}</span>
      {showCursor && (
        <span
          style={{
            color: resolvedCursorColor,
            marginLeft: "2px",
            opacity: cursorHidden ? 0 : cursorVisible ? 1 : 0,
            transition: "opacity 0.1s linear",
          }}
        >
          {cursorChar}
        </span>
      )}
    </span>
  );
}

export default Typewriter;