"use client";

import { useEffect, useRef, useState } from "react";

import { normalizeBarcode } from "@/domain/barcode";

export type ScannerStatus = "starting" | "scanning" | "denied" | "unsupported";

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

const FORMATS = ["ean_13", "ean_8", "upc_a"];
const VIDEO: MediaStreamConstraints = { video: { facingMode: { ideal: "environment" } }, audio: false };

/**
 * Lit les codes-barres alimentaires depuis la caméra arrière : API BarcodeDetector du
 * navigateur quand elle existe (Chrome Android), sinon décodeur ZXing chargé à la demande
 * (Safari iOS). Seuls les codes dont la clé de contrôle est valide sont remontés.
 */
export function useBarcodeScanner(active: boolean, onCode: (code: string) => void) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<ScannerStatus>("starting");

  useEffect(() => {
    if (!active) return;
    const element = video.current;
    if (!element) return;
    let cancelled = false;
    let stop = () => {};
    const found = (raw: string) => {
      const code = normalizeBarcode(raw);
      if (!code || cancelled) return false;
      cancelled = true;
      stop();
      onCode(code);
      return true;
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setStatus("unsupported");
      const Native = (globalThis as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
      try {
        if (Native) {
          const stream = await navigator.mediaDevices.getUserMedia(VIDEO);
          stop = () => stream.getTracks().forEach((track) => track.stop());
          if (cancelled) return stop();
          element.srcObject = stream;
          await element.play();
          setStatus("scanning");
          const detector = new Native({ formats: FORMATS });
          const tick = async () => {
            if (cancelled) return;
            const codes = await detector.detect(element).catch(() => []);
            if (!codes.some((code) => found(code.rawValue))) setTimeout(tick, 200);
          };
          void tick();
        } else {
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import("@zxing/browser"),
            import("@zxing/library"),
          ]);
          const hints = new Map([
            [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]],
          ]);
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
          const controls = await reader.decodeFromConstraints(VIDEO, element, (result) => {
            if (result) found(result.getText());
          });
          stop = () => controls.stop();
          if (cancelled) return stop();
          setStatus("scanning");
        }
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported");
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, onCode]);

  return { video, status: active ? status : ("starting" as ScannerStatus) };
}
