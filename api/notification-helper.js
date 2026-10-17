// ============================================================
// /api/notification-helper.js
// Modul helper untuk notifikasi browser
// Bisa dipanggil dari HTML via <script src="/api/notification-helper.js">
// ============================================================

(function() {
  'use strict';
  
  const CONFIG = {
    icon: '/home/logo.png',
    badge: '/home/logo.png',
    swPath: '/api/service-worker.js',
    defaultDuration: 15000,
    vibratePattern: [200, 100, 200, 100, 200]
  };
  
  // ============================================================
  // CEK SUPPORT
  // ============================================================
  function isSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }
  
  function getPermission() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }
  
  // ============================================================
  // REGISTER SERVICE WORKER
  // ============================================================
  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.log('⚠️ Service Worker tidak didukung');
      return null;
    }
    
    try {
      const registration = await navigator.serviceWorker.register(CONFIG.swPath, {
        scope: '/'
      });
      console.log('✅ Service Worker registered:', registration.scope);
      return registration;
    } catch (err) {
      console.error('❌ SW registration failed:', err);
      return null;
    }
  }
  
  // ============================================================
  // REQUEST PERMISSION
  // ============================================================
  async function requestPermission() {
    if (!isSupported()) {
      console.log('⚠️ Notification tidak didukung');
      return 'unsupported';
    }
    
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    
    try {
      const result = await Notification.requestPermission();
      console.log('🔔 Permission result:', result);
      return result;
    } catch (err) {
      console.error('❌ Permission request failed:', err);
      return 'denied';
    }
  }
  
  // ============================================================
  // SHOW NOTIFICATION
  // ============================================================
  async function showNotification(title, options = {}) {
    if (Notification.permission !== 'granted') {
      console.log('⚠️ Notification not granted');
      return false;
    }
    
    try {
      // Coba lewat Service Worker dulu
      const registration = await navigator.serviceWorker.ready;
      
      if (registration && registration.active) {
        const roleEmoji = options.senderRole === 'owner' ? '👑' 
                        : options.senderRole === 'admin' ? '🛡️' 
                        : options.senderRole === 'cs' ? '💼' 
                        : '💬';
        
        registration.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: title,
          body: options.body || '',
          icon: options.icon || CONFIG.icon,
          badge: options.badge || CONFIG.badge,
          tag: options.tag || 'shine-cs-' + Date.now(),
          url: options.url || '/',
          messageId: options.messageId,
          senderRole: options.senderRole
        });
        
        // Fallback: juga kirim via new Notification()
        // (SW message mungkin lambat, jadi kita fire langsung juga)
        try {
          const notif = new Notification(`${roleEmoji} ${title}`, {
            body: options.body || '',
            icon: CONFIG.icon,
            badge: CONFIG.badge,
            tag: options.tag || 'shine-cs-' + Date.now(),
            requireInteraction: true,
            silent: false
          });
          
          notif.onclick = () => {
            window.focus();
            notif.close();
            if (typeof window.openChatHub === 'function') {
              window.openChatHub('support');
            }
          };
          
          setTimeout(() => {
            try { notif.close(); } catch(e) {}
          }, CONFIG.defaultDuration);
        } catch (fallbackErr) {
          console.warn('Fallback notification failed:', fallbackErr);
        }
        
        return true;
      }
      
      // Kalau SW tidak ready, pakai Notification API langsung
      const roleEmoji = options.senderRole === 'owner' ? '👑' 
                      : options.senderRole === 'admin' ? '🛡️' 
                      : options.senderRole === 'cs' ? '💼' 
                      : '💬';
      
      const notif = new Notification(`${roleEmoji} ${title}`, {
        body: options.body || '',
        icon: CONFIG.icon,
        badge: CONFIG.badge,
        tag: options.tag || 'shine-cs-' + Date.now(),
        requireInteraction: true
      });
      
      notif.onclick = () => {
        window.focus();
        notif.close();
        if (typeof window.openChatHub === 'function') {
          window.openChatHub('support');
        }
      };
      
      setTimeout(() => {
        try { notif.close(); } catch(e) {}
      }, CONFIG.defaultDuration);
      
      return true;
    } catch (err) {
      console.error('❌ Show notification error:', err);
      return false;
    }
  }
  
  // ============================================================
  // NOTIFIKASI PESAN CS
  // ============================================================
  async function notifyCSMessage(msg) {
    if (!msg || !msg.message) return false;
    
    const roleLabel = msg.sender_role === 'owner' ? 'Owner' 
                    : msg.sender_role === 'admin' ? 'Admin' 
                    : 'Customer Service';
    
    return showNotification(`Pesan dari ${roleLabel}`, {
      body: msg.message.substring(0, 200),
      tag: 'cs-msg-' + (msg.id || Date.now()),
      messageId: msg.id,
      senderRole: msg.sender_role,
      url: '/'
    });
  }
  
  // ============================================================
  // LISTEN MESSAGE FROM SW
  // ============================================================
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('[Main] Message from SW:', event.data);
      
      if (event.data && event.data.type === 'OPEN_CHAT_FROM_NOTIFICATION') {
        // Buka chat CS
        if (typeof window.openChatHub === 'function') {
          window.openChatHub('support');
        }
      }
    });
  }
  
  // ============================================================
  // EXPORT KE GLOBAL
  // ============================================================
  window.ShineNotification = {
    isSupported,
    getPermission,
    requestPermission,
    registerServiceWorker,
    show: showNotification,
    notifyCS: notifyCSMessage,
    CONFIG
  };
  
  console.log('🔔 ShineNotification helper loaded');
})();
