/** Message au service worker, dès qu'il est actif (il n'y en a pas en développement). */
export function postToWorker(message: { type: "warm-pages"; urls: string[] } | { type: "clear-pages" }): void {
  if (!("serviceWorker" in navigator)) return;
  const controller = navigator.serviceWorker.controller;
  if (controller) controller.postMessage(message);
  else void navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage(message));
}
