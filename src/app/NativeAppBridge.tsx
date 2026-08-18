"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Android-only browser behavior. It is inert when the same code runs on the web.
 */
export function NativeAppBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    document.documentElement.dataset.nativePlatform = Capacitor.getPlatform();
    let disposed = false;

    const listener = App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        return;
      }

      void App.minimizeApp();
    });

    void listener.then((handle) => {
      if (disposed) {
        void handle.remove();
      }
    });

    return () => {
      disposed = true;
      delete document.documentElement.dataset.nativePlatform;
      void listener.then((handle) => handle.remove());
    };
  }, []);

  return null;
}
