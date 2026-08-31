import { useEffect, useRef, useCallback } from "react";

export function useTabNotification() {
  const originalTitleRef = useRef(document.title);
  const blinkIntervalRef = useRef(null);
  const isTabVisibleRef = useRef(!document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = !document.hidden;
      if (isTabVisibleRef.current) {
        stopBlinking();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const stopBlinking = useCallback(() => {
    if (blinkIntervalRef.current) {
      clearInterval(blinkIntervalRef.current);
      blinkIntervalRef.current = null;
      document.title = originalTitleRef.current;
    }
  }, []);

  const startBlinking = useCallback((blinkText) => {
    if (isTabVisibleRef.current) return;
    stopBlinking();
    originalTitleRef.current = document.title;
    let showBlink = true;
    blinkIntervalRef.current = setInterval(() => {
      document.title = showBlink ? blinkText : originalTitleRef.current;
      showBlink = !showBlink;
    }, 1000);
  }, [stopBlinking]);

  const requestPermissionIfNeeded = useCallback(async () => {
    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission === "default") {
      try {
        return await Notification.requestPermission();
      } catch {
        return "denied";
      }
    }
    return Notification.permission;
  }, []);

  const sendBrowserNotification = useCallback((title, body) => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      const n = new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: "api-sentinel-audit",
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // silencieux
    }
  }, []);

  const notify = useCallback(
    ({ title = "Analyse terminée ✅", body = "", blinkText = "✅ Analyse terminée" }) => {
      if (!isTabVisibleRef.current) {
        startBlinking(blinkText);
        sendBrowserNotification(title, body);
      }
    },
    [startBlinking, sendBrowserNotification]
  );

  useEffect(() => stopBlinking, [stopBlinking]);

  return { notify, requestPermissionIfNeeded };
}