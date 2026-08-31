import { useEffect, useCallback } from "react";

// État partagé au niveau module : survit au montage/démontage de n'importe
// quel composant qui utilise le hook (ex: OpenApiUploader qui disparaît
// après un succès et laisse la place au dashboard).
let originalTitle = typeof document !== "undefined" ? document.title : "";
let blinkIntervalId = null;
let isTabVisible =
  typeof document !== "undefined" ? !document.hidden && document.hasFocus() : true;
let listenerCount = 0;

function computeVisible() {
  return !document.hidden && document.hasFocus();
}

function stopBlinking() {
  if (blinkIntervalId) {
    clearInterval(blinkIntervalId);
    blinkIntervalId = null;
    document.title = originalTitle;
  }
}

function startBlinking(blinkText) {
  if (isTabVisible) return;
  stopBlinking();
  originalTitle = document.title;
  let showBlink = true;
  blinkIntervalId = setInterval(() => {
    document.title = showBlink ? blinkText : originalTitle;
    showBlink = !showBlink;
  }, 1000);
}

function markHidden() {
  isTabVisible = false;
}

function markVisibleIfActive() {
  isTabVisible = computeVisible();
  if (isTabVisible) stopBlinking();
}

function handleVisibilityChange() {
  if (document.hidden) markHidden();
  else markVisibleIfActive();
}

export function useTabNotification() {
  // Les listeners globaux ne sont attachés qu'une seule fois, tant qu'au
  // moins un composant utilise le hook (compteur de référence).
  useEffect(() => {
    listenerCount += 1;
    if (listenerCount === 1) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("blur", markHidden);
      window.addEventListener("focus", markVisibleIfActive);
    }
    return () => {
      listenerCount -= 1;
      if (listenerCount === 0) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("blur", markHidden);
        window.removeEventListener("focus", markVisibleIfActive);
      }
    };
  }, []);

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
    ({ title = "Analyse terminée", body = "", blinkText = "Analyse terminée" }) => {
      if (!isTabVisible) {
        startBlinking(blinkText);
        sendBrowserNotification(title, body);
      }
    },
    [sendBrowserNotification]
  );

  return { notify, requestPermissionIfNeeded };
}