// Firebase Cloud Messaging (FCM) Service Worker for Lumaro Mart
// This service worker runs in the background to display push notifications even when the app/browser is closed.

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAbNr9VYo--GZZou_KxVpeaSXtT4iH_f94",
  authDomain: "studio-4472007664-90b88.firebaseapp.com",
  databaseURL: "https://studio-4472007664-90b88-default-rtdb.firebaseio.com",
  projectId: "studio-4472007664-90b88",
  storageBucket: "studio-4472007664-90b88.firebasestorage.app",
  messagingSenderId: "294397853899",
  appId: "1:294397853899:web:5eb3b86a8726b02f4e1b4e",
  measurementId: "G-XCRTB2T1VR"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || '🛍️ Lumaro Mart Alert';
  const notificationBody = payload.notification?.body || payload.data?.body || 'Aapke order par naya update aaya hai.';
  const defaultUrl = payload.data?.type === 'new_order' ? '/admin' : '/my-orders';
  const targetUrl = payload.data?.url || payload.fcmOptions?.link || defaultUrl;

  const notificationOptions = {
    body: notificationBody,
    icon: payload.notification?.icon || payload.data?.icon || '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [400, 200, 400, 200, 400],
    tag: payload.data?.tag || ('lumaro-' + (payload.data?.orderId || Date.now())),
    renotify: true,
    requireInteraction: true,
    data: {
      url: targetUrl,
      orderId: payload.data?.orderId
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Direct Web Push event listener for fallback/cross-browser push
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push event received:', event);
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_) {
      try {
        data = { body: event.data.text() };
      } catch (__) {
        data = {};
      }
    }
  }

  const title = data.notification?.title || data.title || '🛍️ Lumaro Mart Alert';
  const body = data.notification?.body || data.body || 'Naya update prapt hua hai.';
  const defaultUrl = (data.data?.type === 'new_order' || data.type === 'new_order') ? '/admin' : '/my-orders';
  const url = data.data?.url || data.url || defaultUrl;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [400, 200, 400, 200, 400],
      requireInteraction: true,
      renotify: true,
      tag: data.tag || data.data?.tag || ('lumaro-' + (data.data?.orderId || Date.now())),
      data: { url, orderId: data.data?.orderId }
    })
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event.notification);
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/my-orders';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this app
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then((focusedClient) => {
            if (focusedClient && 'navigate' in focusedClient && targetUrl !== '/') {
              return focusedClient.navigate(targetUrl);
            }
            return focusedClient;
          });
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
