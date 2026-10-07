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
 * Checks whether the current browser/device supports Web Push & Service Workers
 */
export const isFcmSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    messaging !== null
  );
};

/**
 * Get current browser notification permission
 */
export const getFcmPermissionStatus = (): NotificationPermission | 'unsupported' => {
  if (!isFcmSupported()) return 'unsupported';
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
        new Notification(title, options);
      }
    });

    return unsubscribe;
  } catch (error) {
    console.warn('[FCM] Error setting up foreground message listener:', error);
    return null;
  }
};
