"use client";

import { useBarcodeDetection, useCameraStream } from "./use-camera";

export type ScannerStatus = "starting" | "scanning" | "denied" | "unsupported";

/**
 * Lit les codes-barres alimentaires depuis la caméra arrière (voir useCameraStream et
 * useBarcodeDetection). Seuls les codes dont la clé de contrôle est valide sont remontés.
 */
export function useBarcodeScanner(active: boolean, onCode: (code: string) => void) {
  const camera = useCameraStream(active);
  useBarcodeDetection(camera.video, active && camera.status === "ready", onCode);
  const status: ScannerStatus = camera.status === "ready" ? "scanning" : camera.status;
  return { video: camera.video, status };
}
