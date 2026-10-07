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

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Lumaro Mart Alert';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Aapke pass naya notification aaya hai.',
    icon: payload.notification?.icon || payload.data?.icon || '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    tag: payload.data?.tag || 'lumaro-notification',
    data: {
      url: payload.data?.url || payload.fcmOptions?.link || '/'
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event.notification);
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

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
