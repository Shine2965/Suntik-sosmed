// ============================================================
// /api/service-worker.js
// Service Worker untuk Push Notification & Background Sync
// ============================================================

const CACHE_NAME = 'shine-shop';
const NOTIF_ICON = '/home/logo.png';
const NOTIF_BADGE = '/home/logo.png';

// ============================================================
// INSTALL EVENT
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

// ============================================================
// ACTIVATE EVENT
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    clients.claim() // Langsung ambil kendali semua tab
  );
});

// ============================================================
// PUSH EVENT — Terima push dari server
// ============================================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = {
    title: '💬 Pesan Baru dari CS',
    body: 'Anda punya pesan baru dari Customer Service',
    icon: NOTIF_ICON,
    badge: NOTIF_BADGE,
    tag: 'shine-cs-message',
    url: '/',
    senderRole: 'cs',
    messageId: null
  };
  
  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (err) {
    console.error('[SW] Failed to parse push data:', err);
  }
  
  // Emoji berdasarkan role
  const roleEmoji = data.senderRole === 'owner' ? '👑' 
                  : data.senderRole === 'admin' ? '🛡️' 
                  : '💼';
  
  const options = {
    body: data.body,
    icon: data.icon || NOTIF_ICON,
    badge: data.badge || NOTIF_BADGE,
    tag: data.tag || 'shine-cs-' + Date.now(),
    requireInteraction: true, // Notif tidak hilang otomatis
    silent: false,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || '/',
      messageId: data.messageId,
      senderRole: data.senderRole,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: '💬 Buka Chat',
        icon: NOTIF_BADGE
      },
      {
        action: 'close',
        title: '✕ Tutup'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(`${roleEmoji} ${data.title}`, options)
  );
});

// ============================================================
// NOTIFICATION CLICK — User klik notifikasi
// ============================================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  notification.close();
  
  // Kalau user klik "Tutup"
  if (action === 'close') {
    return;
  }
  
  // Buka / focus tab
  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then((windowClients) => {
      // Cari tab yang sudah terbuka
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(location.origin) && 'focus' in client) {
          // Kirim pesan ke tab untuk buka chat
          client.postMessage({
            type: 'OPEN_CHAT_FROM_NOTIFICATION',
            messageId: data.messageId,
            senderRole: data.senderRole
          });
          return client.focus();
        }
      }
      
      // Kalau tidak ada tab terbuka, buka tab baru
      if (clients.openWindow) {
        return clients.openWindow(data.url || '/');
      }
    })
  );
});

// ============================================================
// NOTIFICATION CLOSE — User tutup notifikasi
// ============================================================
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// ============================================================
// MESSAGE — Terima pesan dari halaman utama
// ============================================================
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  const data = event.data;
  
  if (!data || !data.type) return;
  
  if (data.type === 'SHOW_NOTIFICATION') {
    // Trigger notifikasi dari main thread (fallback)
    const roleEmoji = data.senderRole === 'owner' ? '👑' 
                    : data.senderRole === 'admin' ? '🛡️' 
                    : '💼';
    
    event.waitUntil(
      self.registration.showNotification(`${roleEmoji} ${data.title}`, {
        body: data.body,
        icon: NOTIF_ICON,
        badge: NOTIF_BADGE,
        tag: data.tag || 'shine-cs-' + Date.now(),
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
          url: data.url || '/',
          messageId: data.messageId,
          senderRole: data.senderRole,
          timestamp: Date.now()
        },
        actions: [
          { action: 'open', title: '💬 Buka Chat' },
          { action: 'close', title: '✕ Tutup' }
        ]
      })
    );
  }
  
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ============================================================
// BACKGROUND SYNC — Fallback jika offline
// ============================================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-cs-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  try {
    // Optional: fetch pesan baru dari server
    console.log('[SW] Syncing messages...');
  } catch (err) {
    console.error('[SW] Sync failed:', err);
  }
});

// ============================================================
// FETCH — Cache strategies (optional)
// ============================================================
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Supabase & API requests
  const url = new URL(event.request.url);
  if (
    url.hostname.includes('supabase') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('discord') ||
    url.pathname.includes('qiospay')
  ) {
    return;
  }
  
  // Network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

console.log('[SW] Service Worker loaded ✅');
