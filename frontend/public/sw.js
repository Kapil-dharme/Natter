const CACHE_NAME = "natter-v3";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
];

const activeConversations = new Map();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (error) {
          console.error("Failed to cache:", asset, error);
        }
      }
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }

        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match("/offline.html");
        });
      })
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "NATTER_ACTIVE_CONVERSATION") {
    const clientId = event.source?.id;

    if (!clientId) return;

    activeConversations.set(
      clientId,
      event.data.conversationId
        ? String(event.data.conversationId)
        : null
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.error("Invalid push payload:", error);
  }

  const conversationId = data.conversationId
    ? String(data.conversationId)
    : null;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const currentClientIds = new Set(
        clientList.map((client) => client.id)
      );

      for (const clientId of activeConversations.keys()) {
        if (!currentClientIds.has(clientId)) {
          activeConversations.delete(clientId);
        }
      }

      const conversationIsVisible = clientList.some((client) => {
        if (client.visibilityState !== "visible") {
          return false;
        }

        return (
          conversationId &&
          activeConversations.get(client.id) === conversationId
        );
      });

      if (conversationIsVisible) {
        return;
      }

      const title = data.title || "Natter";

      const options = {
        body: data.body || "You have a new message",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: {
          conversationId,
        },
        tag: conversationId
          ? `conversation-${conversationId}`
          : "natter-message",
        renotify: true,
      };

      await self.registration.showNotification(
        title,
        options
      );
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const conversationId =
    event.notification.data?.conversationId;

  event.waitUntil(
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if (conversationId) {
            client.postMessage({
              type: "OPEN_CONVERSATION",
              conversationId,
            });
          }

          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        const url = conversationId
          ? `/?conversation=${encodeURIComponent(conversationId)}`
          : "/";

        return self.clients.openWindow(url);
      }
    })
  );
});