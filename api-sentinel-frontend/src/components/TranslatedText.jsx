import { useEffect, useState } from "react";
import { looksNonEnglish, translateToEnglish } from "../lib/translateText";
import { cn } from "../lib/utils";

export function TranslatedText({ text, className, as: Comp = "span", block = false, children }) {
  const [english, setEnglish] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const foreign = looksNonEnglish(text);

  useEffect(() => {
    if (!foreign || !text) {
      setEnglish(null);
      return;
    }
    let cancelled = false;
    translateToEnglish(text).then((translated) => {
      if (!cancelled) setEnglish(translated);
    });
    return () => {
      cancelled = true;
    };
  }, [text, foreign]);

  if (!text) return null;

  const translatedDiffers =
    !!english && english.trim().toLowerCase() !== text.trim().toLowerCase();
  const shown = foreign && !showOriginal && english ? english : text;
  const showToggle = foreign && translatedDiffers;

  return (
    <span className={cn(block && "block")}>
      {children ? (
        children(shown)
      ) : (
        <Comp className={className}>{shown}</Comp>
      )}
      {showToggle && (
        <button
          type="button"
          onClick={() => setShowOriginal((v) => !v)}
          className={cn(
            "text-[10px] text-blue-500 hover:text-blue-700 hover:underline",
            block ? "mt-1.5 block" : "ml-1.5 align-baseline"
          )}
        >
          {showOriginal ? "Show English" : "Show original"}
        </button>
      )}
    </span>
  );
}

export default TranslatedText;
