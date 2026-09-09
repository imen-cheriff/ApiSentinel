import { useEffect, useState } from "react";
import { looksNonEnglish, translateToEnglish } from "../lib/translateText";
import { cn } from "../lib/utils";

export function TranslatedText({
  text,
  className,
  as: Comp = "span",
  block = false,
  children,
  showOriginal: showOriginalProp,
  onToggle,
  showToggle,
}) {
  const [english, setEnglish] = useState(null);
  const [internalOriginal, setInternalOriginal] = useState(false);
  const foreign = looksNonEnglish(text);
  const showOriginal = showOriginalProp ?? internalOriginal;

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
  const autoToggle = foreign && translatedDiffers;
  const showButton = showToggle ?? autoToggle;

  const handleToggle = () => {
    if (onToggle) onToggle();
    else setInternalOriginal((v) => !v);
  };

  return (
    <span className={cn(block && "block")}>
      {children ? (
        children(shown)
      ) : (
        <Comp className={className}>{shown}</Comp>
      )}
      {showButton && (
        <button
          type="button"
          onClick={handleToggle}
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
