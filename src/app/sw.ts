import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, RouteHandlerCallbackOptions, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// --- Pages de l'app hors ligne -------------------------------------------------------

/** Pages déjà consultées (dont l'accueil et le journal du jour), pour les relire sans réseau. */
const PAGES_CACHE = "app-pages";
const pages = new NetworkFirst({
  cacheName: PAGES_CACHE,
  // Réseau lent ou capricieux : on montre la dernière version enregistrée plutôt qu'un écran blanc.
  networkTimeoutSeconds: 6,
  plugins: [new ExpirationPlugin({ maxEntries: 48, maxAgeSeconds: 7 * 24 * 3600 })],
});

async function pageHandler(options: RouteHandlerCallbackOptions): Promise<Response> {
  try {
    return await pages.handle(options);
  } catch {
    // Même page avec d'autres paramètres (une autre date du journal…), sinon la page hors ligne.
    const cache = await caches.open(PAGES_CACHE);
    const similar = await cache.match(options.request, { ignoreSearch: true });
    return similar ?? (await serwist.matchPrecache("/~offline")) ?? Response.error();
  }
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin && request.mode === "navigate" && !url.pathname.startsWith("/api/"),
      handler: pageHandler,
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

/**
 * Messages de l'app : `warm-pages` met en cache des pages pour le hors-ligne (l'accueil et le
 * journal du jour, sans attendre de les avoir ouvertes) ; `clear-pages` les efface à la
 * déconnexion, pour que le prochain membre sur ce téléphone ne voie pas les données du précédent.
 */
// Traités dans l'ordre d'arrivée : un effacement à la connexion ne doit pas rattraper le cache
// rempli juste après.
let messages: Promise<unknown> = Promise.resolve();

self.addEventListener("message", (event) => {
  const data = event.data as { type?: string; urls?: unknown } | null;
  const task =
    data?.type === "clear-pages"
      ? clearPages
      : data?.type === "warm-pages" && Array.isArray(data.urls)
        ? () => warmPages(data.urls as unknown[])
        : null;
  if (!task) return;
  messages = messages.then(task, task);
  event.waitUntil(messages);
});

async function clearPages(): Promise<void> {
  const names = await caches.keys();
  await Promise.all(names.filter((name) => !name.includes("precache")).map((name) => caches.delete(name)));
}

async function warmPages(urls: unknown[]): Promise<void> {
  const cache = await caches.open(PAGES_CACHE);
  const paths = urls.filter((url): url is string => typeof url === "string" && /^\/[\w\-/]*$/.test(url));
  await Promise.all(
    paths.map(async (path) => {
      const response = await fetch(path, { credentials: "same-origin" }).catch(() => null);
      // Une redirection (session expirée…) ne doit pas remplacer une page valable.
      if (response?.ok && !response.redirected) await cache.put(path, response);
    }),
  );
}

// --- Notifications Web Push ---------------------------------------------------------

type PushMessage = { title: string; body: string; url: string; tag: string };

self.addEventListener("push", (event) => {
  let message: PushMessage;
  try {
    message = event.data?.json() as PushMessage;
  } catch {
    return;
  }
  if (!message?.title) return;
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: message.url },
    }),
  );
});

/** Un clic ouvre la page visée, dans une fenêtre de l'app déjà ouverte si possible. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = typeof event.notification.data?.url === "string" ? event.notification.data.url : "/";
  // Uniquement un chemin de l'app (jamais une adresse extérieure).
  const url = new URL(path.startsWith("/") && !path.startsWith("//") ? path : "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows[0];
      if (open) {
        await open.navigate(url);
        return open.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
