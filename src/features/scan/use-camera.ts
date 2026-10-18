"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

import { normalizeBarcode } from "@/domain/barcode";

export type CameraStatus = "starting" | "ready" | "denied" | "unsupported";

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;
type TorchTrack = Omit<MediaStreamTrack, "getCapabilities"> & {
  getCapabilities?: () => MediaTrackCapabilities & { torch?: boolean };
};

const FORMATS = ["ean_13", "ean_8", "upc_a"];
// Caméra arrière ; une image nette en 1080p suffit : la photo est ensuite réduite à 768 px pour l'IA.
const VIDEO: MediaStreamConstraints = {
  video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  audio: false,
};

/**
 * Flux de la caméra arrière dans un élément vidéo, coupé dès que `active` repasse à faux ou que
 * l'écran se ferme. La lampe n'est proposée que si le téléphone la permet (Chrome Android ; pas
 * Safari sur iPhone).
 */
export function useCameraStream(active: boolean) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<TorchTrack | null>(null);
  const [status, setStatus] = useState<CameraStatus>("starting");
  const [torch, setTorch] = useState<{ available: boolean; on: boolean }>({ available: false, on: false });

  useEffect(() => {
    if (!active) return;
    const element = video.current;
    if (!element) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    setStatus("starting");

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setStatus("unsupported");
      try {
        stream = await navigator.mediaDevices.getUserMedia(VIDEO);
        if (cancelled) return stream.getTracks().forEach((each) => each.stop());
        element.srcObject = stream;
        await element.play();
        if (cancelled) return;
        const videoTrack: TorchTrack | undefined = stream.getVideoTracks()[0];
        track.current = videoTrack ?? null;
        setTorch({ available: Boolean(videoTrack?.getCapabilities?.().torch), on: false });
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported");
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((each) => each.stop());
      track.current = null;
      element.srcObject = null;
    };
  }, [active]);

  const toggleTorch = async () => {
    const current = track.current;
    if (!current) return;
    const on = !torch.on;
    try {
      await current.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch({ available: true, on });
    } catch {
      setTorch({ available: false, on: false });
    }
  };

  return { video, status: active ? status : ("starting" as CameraStatus), torch, toggleTorch };
}

/**
 * Cherche un code-barres alimentaire dans la vidéo déjà ouverte : API BarcodeDetector du
 * navigateur quand elle existe (Chrome Android), sinon décodeur ZXing chargé à la demande
 * (Safari iOS). Seuls les codes dont la clé de contrôle est valide sont remontés, une seule fois.
 */
export function useBarcodeDetection(
  video: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  onCode: (code: string) => void,
) {
  useEffect(() => {
    if (!enabled) return;
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
      const Native = (globalThis as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
      if (Native) {
        const detector = new Native({ formats: FORMATS });
        let timer: ReturnType<typeof setTimeout> | undefined;
        stop = () => clearTimeout(timer);
        const tick = async () => {
          if (cancelled) return;
          const codes = await detector.detect(element).catch(() => []);
          if (!codes.some((code) => found(code.rawValue)) && !cancelled) timer = setTimeout(tick, 200);
        };
        void tick();
        return;
      }
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import("@zxing/browser"),
        import("@zxing/library"),
      ]);
      if (cancelled) return;
      const hints = new Map([
        [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]],
      ]);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
      // Lit la vidéo telle quelle : arrêter le décodage ne coupe pas la caméra.
      const controls = await reader.decodeFromVideoElement(element, (result) => {
        if (result) found(result.getText());
      });
      stop = () => controls.stop();
      if (cancelled) stop();
    })().catch(() => {
      // Décodeur indisponible : la saisie des chiffres reste possible.
    });

    return () => {
      cancelled = true;
      stop();
    };
  }, [video, enabled, onCode]);
}

/** Image affichée par la vidéo, en JPEG, comme le ferait l'appareil photo du téléphone. */
export async function captureFrame(element: HTMLVideoElement): Promise<File | null> {
  const width = element.videoWidth;
  const height = element.videoHeight;
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(element, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return blob ? new File([blob], `repas-${Date.now()}.jpg`, { type: "image/jpeg" }) : null;
}
