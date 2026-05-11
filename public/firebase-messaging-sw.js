importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// These values are from firebase-applet-config.json
firebase.initializeApp({
  apiKey: "AIzaSyAbNr9VYo--GZZou_KxVpeaSXtT4iH_f94",
  projectId: "studio-4472007664-90b88",
  messagingSenderId: "294397853899",
  appId: "1:294397853899:web:5eb3b86a8726b02f4e1b4e",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico', // Adjust as needed
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
