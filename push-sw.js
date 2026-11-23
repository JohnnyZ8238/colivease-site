// ColivEase browser notifications (served at the site root as /push-sw.js; registered by src/lib/platform/push.js).
// The server sends { title, body, kind, refId, url } encrypted with Web Push (supabase/functions/api/notify.ts).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "ColivEase", body: event.data ? event.data.text() : "" };
  }
  // Open app tabs fetch their inbox now.
  self.clients.matchAll({ type: "window" }).then((list) => list.forEach((c) => c.postMessage({ type: "cv-push" })));
  event.waitUntil(
    self.registration.showNotification(data.title || "ColivEase", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/favicon-32.png",
      // One notification per chat / application: a newer one replaces the older instead of piling up.
      tag: data.refId ? `${data.kind || "note"}:${data.refId}` : undefined,
      renotify: Boolean(data.refId),
      data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.refId ? `/app.html?notify=${encodeURIComponent(data.kind || "")}&ref=${encodeURIComponent(data.refId)}` : data.url || "/app.html";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // An open app tab: bring it forward and open the screen there.
      const app = list.find((c) => /\/app\.html/.test(new URL(c.url).pathname) || "/" === new URL(c.url).pathname);
      if (app && /\/app\.html/.test(new URL(app.url).pathname)) {
        app.postMessage({ type: "cv-open", kind: data.kind, refId: data.refId });
        return app.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
