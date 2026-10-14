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

  const type = payload.data?.type || '';
  const isNewOrder = type === 'new_order';
  const isStockAlert = type === 'stock_alert';

  let defaultTitle = '🛍️ Order Status Update';
  let defaultBody = 'Aapke order par naya status update aaya hai.';

  if (isNewOrder) {
    defaultTitle = '🛍️ Naya Order Recieve Hua!';
    defaultBody = 'Store par naya order receive hua hai! Tap karke Admin Dashboard me accept karein.';
  } else if (isStockAlert) {
    defaultTitle = '🚨 Stock Out Alert!';
    defaultBody = 'Product stock out ho gaya hai! Jaldi restock karein.';
  }

  const notificationTitle = payload.notification?.title || payload.data?.title || defaultTitle;
  const notificationBody = payload.notification?.body || payload.data?.body || defaultBody;
  const defaultUrl = (isNewOrder || isStockAlert) ? '/admin' : '/my-orders';
  const targetUrl = payload.data?.url || payload.fcmOptions?.link || defaultUrl;

  const notificationOptions = {
    body: notificationBody,
    icon: payload.notification?.icon || payload.data?.icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: isNewOrder ? [500, 200, 500, 200, 500, 200, 500] : [400, 200, 400, 200, 400],
    tag: payload.data?.tag || (isNewOrder ? `admin-order-${payload.data?.orderId || Date.now()}` : `lumaro-${payload.data?.productId || payload.data?.orderId || Date.now()}`),
    renotify: true,
    requireInteraction: true,
    data: {
      url: targetUrl,
      orderId: payload.data?.orderId,
      productId: payload.data?.productId,
      type
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

  const type = data.data?.type || data.type || '';
  const isNewOrder = type === 'new_order';
  const isStockAlert = type === 'stock_alert';

  let defaultTitle = '🛍️ Order Status Update';
  let defaultBody = 'Aapke order par naya status update aaya hai.';

  if (isNewOrder) {
    defaultTitle = '🛍️ Naya Order Recieve Hua!';
    defaultBody = 'Store par naya order receive hua hai! Tap karke Admin Dashboard me accept karein.';
  } else if (isStockAlert) {
    defaultTitle = '🚨 Stock Out Alert!';
    defaultBody = 'Product stock out ho gaya hai! Jaldi restock karein.';
  }

  const title = data.notification?.title || data.data?.title || data.title || defaultTitle;
  const body = data.notification?.body || data.data?.body || data.body || defaultBody;
  const defaultUrl = (isNewOrder || isStockAlert) ? '/admin' : '/my-orders';
  const url = data.data?.url || data.url || defaultUrl;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: data.notification?.icon || data.data?.icon || '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: isNewOrder ? [500, 200, 500, 200, 500, 200, 500] : [400, 200, 400, 200, 400],
      requireInteraction: true,
      renotify: true,
      tag: data.tag || data.data?.tag || (isNewOrder ? `admin-order-${data.data?.orderId || Date.now()}` : `lumaro-${data.data?.orderId || Date.now()}`),
      data: { url, orderId: data.data?.orderId, type }
    })
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event.notification);
  event.notification.close();

  const rawUrl = event.notification.data?.url || '/my-orders';
  const targetUrl = rawUrl.startsWith('/#') ? rawUrl : ('/#' + (rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl));

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this app
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then((focusedClient) => {
            if (focusedClient && 'navigate' in focusedClient) {
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
