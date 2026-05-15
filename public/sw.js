/**
 * Mailmind service worker.
 *
 * Two responsibilities:
 *   1. Receive Web Push notifications from the server and display them
 *   2. Handle notification clicks (focus existing tab or open new one)
 *
 * No offline shell caching yet — Next.js handles asset caching well enough
 * via standard HTTP cache headers. Add caching strategies later if needed.
 */

const VERSION = "mailmind-sw-v1";

self.addEventListener("install", (event) => {
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of all open pages right away
  event.waitUntil(self.clients.claim());
});

// ── Push event — show notification ──────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Mailmind", body: event.data.text() };
  }

  const title = payload.title ?? "Mailmind";
  const options = {
    body:    payload.body ?? "",
    icon:    "/web-app-manifest-192x192.png",
    badge:   "/web-app-manifest-192x192.png",
    tag:     payload.tag ?? "mailmind-default",
    data:    { url: payload.url ?? "/app/inbox" },
    // Re-notify even if a notification with the same tag already exists
    renotify: !!payload.tag,
    // Vibrate pattern for Android
    vibrate: [120, 60, 120],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click — focus or open ──────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? "/app/inbox";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If any Mailmind tab is open, focus it and navigate
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
