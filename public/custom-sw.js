// Custom Service Worker
// This file is imported by the Workbox-generated SW via importScripts

// ============================================================
// Push Notifications
// ============================================================

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || 'Neue Nachricht',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'BMR Bau', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});

// ============================================================
// Stream-Proxy fuer beliebig grosse Datei-Downloads
// (StreamSaver.js-Pattern, ohne externe Dependency)
//
// Pattern:
//   1. Client registriert einen Download mit ID + Datei-Meta + MessagePort
//   2. Client triggert iframe.src = `${SW_DOWNLOAD_PREFIX}/<id>`
//   3. SW antwortet auf diesen Fetch mit ReadableStream, deren Bytes von
//      dem MessagePort kommen → Browser interpretiert das als Download
//      und schreibt direkt aufs Filesystem (kein Blob im RAM)
//   4. Client pumpt ZIP-Bytes via Port; "end"-Marker schliesst den Stream
// ============================================================

const SW_DOWNLOAD_PREFIX = '/__stream_download/';
const activeDownloads = new Map();

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'stream-download:register') return;

  const { id, filename, mimeType } = data;
  const port = event.ports && event.ports[0];
  if (!id || !port) return;

  const stream = new ReadableStream({
    start(controller) {
      port.onmessage = (e) => {
        const chunk = e.data;
        if (chunk === 'end') {
          try { controller.close(); } catch (_) { /* noop */ }
        } else if (chunk === 'abort') {
          try { controller.error(new Error('aborted')); } catch (_) { /* noop */ }
        } else if (chunk instanceof Uint8Array) {
          try { controller.enqueue(chunk); } catch (_) { /* noop */ }
        }
      };
      port.start && port.start();
    },
    cancel() {
      try { port.postMessage('cancel'); } catch (_) { /* noop */ }
    },
  });

  activeDownloads.set(id, {
    stream,
    filename: filename || 'download.bin',
    mimeType: mimeType || 'application/octet-stream',
  });

  // Reply back so client knows the SW is ready for this id
  try {
    port.postMessage('ready');
  } catch (_) { /* noop */ }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith(SW_DOWNLOAD_PREFIX)) return;

  const id = url.pathname.slice(SW_DOWNLOAD_PREFIX.length);
  const download = activeDownloads.get(id);
  if (!download) {
    // Unknown id — let it 404 normally
    return;
  }
  activeDownloads.delete(id);

  // Sanitize filename for header (RFC 6266 fallback to ASCII)
  const safeName = (download.filename || 'download.bin').replace(/[^\x20-\x7e]/g, '_');
  const headers = new Headers({
    'Content-Type': download.mimeType || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${safeName}"`,
    // No Content-Length — chunked transfer encoding will be used
  });

  event.respondWith(new Response(download.stream, { headers, status: 200 }));
});
