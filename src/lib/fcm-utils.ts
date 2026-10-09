import { messaging, db } from '../firebase';
import { getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

export const DEFAULT_VAPID_KEY = 'BH5pHZc7Wf0ASibIMFNVtrRi-5Waime9pc9RYCnOh4XqHW3xbwAP8yBWofnR2tc3rbqQ4FnMd15liNgznCN5P08';

export interface FcmTokenDetails {
  token: string;
  userId?: string;
  role?: string;
  createdAt?: any;
}

export interface FcmTokenDetailedResult {
  token: string | null;
  error?: string;
  errorCode?: string;
  hint?: string;
}

/**
 * Universal browser notification permission request (handles Promise & Callback for mobile compatibility)
 */
export const requestBrowserNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const res = Notification.requestPermission();
    if (res && typeof res.then === 'function') {
      return await res;
    }
    return await new Promise<NotificationPermission>((resolve) => {
      Notification.requestPermission((p) => resolve(p));
    });
  } catch (e) {
    console.warn('[Notification] requestPermission error:', e);
    return Notification.permission || 'denied';
  }
};

/**
 * Universal platform notification display.
 * CRITICAL FOR ANDROID CHROME:
 * Calling 'new Notification()' on Chrome Android throws TypeError: Illegal constructor.
 * Web apps on Android mobile MUST use ServiceWorkerRegistration.showNotification().
 */
export const showPlatformNotification = async (title: string, options?: NotificationOptions): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  // Play audio sound if available
  try {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (_) {}

  // 1. Mobile/Android Service Worker showNotification (Mandatory for Android lock screen & shade)
  if ('serviceWorker' in navigator) {
    try {
      let reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) {
        reg = await navigator.serviceWorker.ready;
      }
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200],
          ...options
        } as any);
        return true;
      }
    } catch (swErr) {
      console.warn('[Notification] SW showNotification error:', swErr);
    }
  }

  // 2. Desktop fallback (Only works on Desktop browsers)
  try {
    new Notification(title, {
      icon: '/favicon.ico',
      ...options
    });
    return true;
  } catch (deskErr) {
    console.warn('[Notification] Desktop Notification constructor error:', deskErr);
    return false;
  }
};

/**
 * Sends a live test notification to the user's mobile device
 */
export const sendLocalTestNotification = async (
  title: string = 'Lumaro Mart Alert 🔔',
  body: string = 'Aapke Android phone par alerts bilkul sahi kaam kar rahe hain! 🎉'
): Promise<boolean> => {
  const perm = await requestBrowserNotificationPermission();
  if (perm === 'granted') {
    return await showPlatformNotification(title, {
      body,
      tag: 'test-notification',
      data: { url: '/notifications' }
    });
  }
  return false;
};

/**
 * Full diagnostic for device notifications
 */
export const getNotificationDiagnostic = () => {
  if (typeof window === 'undefined') {
    return {
      isSupported: false,
      isHttps: false,
      permission: 'unsupported' as const,
      isAndroid: false,
      isIframe: false,
      reason: 'Server side rendering'
    };
  }

  const isHttps = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const hasNotificationApi = 'Notification' in window;
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const isAndroid = /android/i.test(navigator.userAgent);
  const isIframe = window.self !== window.top;
  const permission = hasNotificationApi ? Notification.permission : ('unsupported' as const);

  let status: 'ready' | 'needs_permission' | 'blocked' | 'insecure' | 'unsupported_webview' = 'ready';
  let message = 'Notifications ready hain!';

  if (!isHttps) {
    status = 'insecure';
    message = 'App HTTPS par nahi hai. Android me notifications ke liye HTTPS zaroori hai.';
  } else if (!hasNotificationApi || !hasServiceWorker || !hasPushManager) {
    status = 'unsupported_webview';
    message = 'Yeh browser ya Android WebView Web Push notifications support nahi karta. Google Chrome me open karein.';
  } else if (permission === 'denied') {
    status = 'blocked';
    message = 'Android Chrome me notifications Blocked hain. URL ke bagal me 🔒 lock icon par tap karke Allow karein.';
  } else if (permission === 'default') {
    status = 'needs_permission';
    message = 'Notification permission abhi nahi di gayi hai. "Allow Notifications" par tap karein.';
  }

  return {
    isSupported: hasNotificationApi && hasServiceWorker && hasPushManager && isHttps,
    isHttps,
    hasNotificationApi,
    hasServiceWorker,
    hasPushManager,
    isAndroid,
    isIframe,
    permission,
    status,
    message
  };
};

/**
 * Checks whether the current browser/device supports Web Push & Service Workers
 */
export const isFcmSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    'Notification' in window &&
    'serviceWorker' in navigator
  );
};

/**
 * Get current browser notification permission
 */
export const getFcmPermissionStatus = (): NotificationPermission | 'unsupported' => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

/**
 * Requests notification permission from user, registers service worker and retrieves FCM token with detailed diagnostics
 */
export const requestFcmTokenDetailed = async (customVapidKey?: string): Promise<FcmTokenDetailedResult> => {
  if (!isFcmSupported() || !messaging) {
    return {
      token: null,
      error: 'Push notifications are not supported in this browser or platform.',
      errorCode: 'unsupported_browser',
      hint: 'Chrome, Edge, ya Android browser me open karein.'
    };
  }

  // Check if app is inside an iframe (e.g. AI Studio preview panel)
  const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
  if (isInsideIframe) {
    console.warn('[FCM] App is running inside an iframe. Notifications might be blocked by browser sandbox.');
  }

  try {
    // 1. Request browser permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        token: null,
        error: `Notification permission denied (${permission}).`,
        errorCode: 'permission_denied',
        hint: isInsideIframe 
          ? 'Browser ne iframe ke andar notification block kar diya hai. Kripya app ko new tab me open karein.'
          : 'Browser ke URL bar me lock (🔒) icon par click karke Notifications ko "Allow" karein.'
      };
    }

    // 2. Register or fetch active service worker
    let swRegistration: ServiceWorkerRegistration | undefined;
    try {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      await navigator.serviceWorker.ready;
      console.log('[FCM] Service worker ready with scope:', swRegistration.scope);
    } catch (swErr: any) {
      console.warn('[FCM] SW explicit registration warning:', swErr);
      try {
        swRegistration = await navigator.serviceWorker.ready;
      } catch (_) {}
    }

    // 3. Resolve VAPID Key
    let vapidKey = customVapidKey?.trim();
    if (!vapidKey) {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
        if (settingsSnap.exists() && settingsSnap.data().fcmVapidKey) {
          vapidKey = settingsSnap.data().fcmVapidKey.trim();
        }
      } catch (err) {
        console.warn('[FCM] Could not fetch VAPID key from Firestore settings:', err);
      }
    }

    if (!vapidKey || vapidKey.length < 10) {
      vapidKey = DEFAULT_VAPID_KEY;
    }

    // 4. Request token with fallback
    let currentToken: string | null = null;
    try {
      const tokenOptions: { serviceWorkerRegistration?: ServiceWorkerRegistration; vapidKey?: string } = {
        vapidKey
      };
      if (swRegistration) {
        tokenOptions.serviceWorkerRegistration = swRegistration;
      }

      currentToken = await getToken(messaging, tokenOptions);
    } catch (tokenErr: any) {
      console.warn('[FCM] Initial getToken failed, trying fallback without explicit swRegistration:', tokenErr);
      // Fallback: let Firebase SDK handle the worker discovery directly
      currentToken = await getToken(messaging, { vapidKey });
    }

    if (currentToken) {
      console.log('[FCM] Device token successfully acquired:', currentToken.substring(0, 15) + '...');
      localStorage.setItem('lumaro_fcm_token', currentToken);
      return { token: currentToken };
    } else {
      return {
        token: null,
        error: 'No registration token returned by Firebase.',
        errorCode: 'no_token',
        hint: 'Check karein ki Firebase Console me VAPID key valid hai.'
      };
    }
  } catch (error: any) {
    console.error('[FCM] Detailed error in retrieving FCM token:', error);
    const errorCode = error?.code || 'unknown_error';
    const errorMsg = error?.message || String(error);

    let hint = 'Firebase Console me VAPID Key check karein.';
    if (errorCode.includes('invalid-vapid-key') || errorMsg.includes('sender ID') || errorMsg.includes('vapid')) {
      hint = 'Yeh VAPID Key kisi doosre Firebase Project ki lagti hai. Jo project app ke firebase-applet-config.json me configured hai (messagingSenderId: 294397853899), key usi project se generate honi chahiye.';
    } else if (errorCode.includes('permission') || errorMsg.includes('permission')) {
      hint = 'Browser notifications allowed nahi hain. Settings me jakar Allow karein.';
    } else if (isInsideIframe) {
      hint = 'Aap AI Studio ke preview me hain. App ko top-right icon se New Tab me open karke connect karein.';
    }

    return {
      token: null,
      error: errorMsg,
      errorCode,
      hint
    };
  }
};

/**
 * Requests notification permission from user, registers service worker and retrieves FCM token
 */
export const requestFcmToken = async (customVapidKey?: string): Promise<string | null> => {
  const result = await requestFcmTokenDetailed(customVapidKey);
  return result.token;
};

/**
 * Saves the FCM token to Firestore under user profile and the fcm_tokens collection
 */
export const saveFcmToken = async (
  userId: string,
  token: string,
  role: 'user' | 'admin' = 'user'
): Promise<boolean> => {
  if (!userId || !token) return false;

  try {
    // 1. Save in user profile
    await setDoc(
      doc(db, 'users', userId),
      {
        fcmToken: token
      },
      { merge: true }
    );

    // 2. Save in dedicated fcm_tokens collection for broadcasts & audits
    // Sanitize token for doc id or encode safe key
    const tokenDocId = token.slice(-40).replace(/[^a-zA-Z0-9_-]/g, '_');
    await setDoc(
      doc(db, 'fcm_tokens', tokenDocId),
      {
        token,
        userId,
        role,
        platform: 'web',
        updatedAt: serverTimestamp(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
      },
      { merge: true }
    );

    return true;
  } catch (err) {
    console.warn('[FCM] Could not sync FCM token to Firestore:', err);
    return false;
  }
};

/**
 * Listen for foreground push notifications (when user is active on the website)
 */
export const setupForegroundPushListener = (
  onNotification?: (payload: MessagePayload) => void
): (() => void) | null => {
  if (!isFcmSupported() || !messaging) return null;

  try {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message received:', payload);

      // Play soft chime sound if available
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (_) {}

      // Trigger custom UI callback
      if (onNotification) {
        onNotification(payload);
      }

      // If page is hidden or backgrounded, show native notification
      if (document.hidden && Notification.permission === 'granted') {
        const title = payload.notification?.title || payload.data?.title || 'Lumaro Mart';
        const options: NotificationOptions = {
          body: payload.notification?.body || payload.data?.body || '',
          icon: payload.notification?.icon || payload.data?.icon || '/favicon.ico',
          data: {
            url: payload.data?.url || '/'
          }
        };
        showPlatformNotification(title, options);
      }
    });

    return unsubscribe;
  } catch (error) {
    console.warn('[FCM] Error setting up foreground message listener:', error);
    return null;
  }
};
