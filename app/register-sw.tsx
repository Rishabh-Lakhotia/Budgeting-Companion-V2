"use client";

import { useEffect } from "react";

export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log(
            "Wallet service worker registered:",
            registration.scope
          );
        })
        .catch((error) => {
          console.error(
            "Wallet service worker registration failed:",
            error
          );
        });
    }
  }, []);

  return null;
}
