import { messaging, db } from '../firebase';
import { getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp, getDoc, collection, addDoc, updateDoc, arrayUnion, query, where, getDocs } from 'firebase/firestore';
import { sendFcmV1Push } from './fcm-v1-client';

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
export const showPlatformNotification = async (
  title: string, 
  options?: NotificationOptions & { orderId?: string }
): Promise<boolean> => {
  // 1. Android Native App Channel (JavascriptInterface from MainActivity.java)
  // Triggers OS-level Heads-Up Notification, Status Bar alert, Ringtone & Vibration
  if (typeof window !== 'undefined') {
    const androidNotification = (window as unknown as {
      AndroidNotification?: {
        showNotification: (t: string, b: string, id: string) => void;
        showNotificationWithRoute?: (t: string, b: string, id: string, route: string) => void;
        triggerVibration: (duration: number) => void;
      };
    }).AndroidNotification;

    if (androidNotification) {
      try {
        const bodyText = (options?.body as string) || '';
        const orderId = options?.orderId || (options?.data?.orderId as string) || '';
        const route = (options?.data?.url as string) || '';
        if (typeof androidNotification.showNotificationWithRoute === 'function') {
          androidNotification.showNotificationWithRoute(title, bodyText, orderId, route);
        } else if (typeof androidNotification.showNotification === 'function') {
          androidNotification.showNotification(title, bodyText, orderId);
        }
        return true;
      } catch (nativeErr) {
        console.warn('[Notification] Android Native Channel error:', nativeErr);
      }
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  // Play audio sound if available
  try {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (_) {}

  // 2. Mobile/Android Service Worker showNotification (Mandatory for Android lock screen & shade in Chrome)
  if ('serviceWorker' in navigator) {
    try {
      let reg: ServiceWorkerRegistration | undefined;
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs && regs.length > 0) {
        reg = regs[0];
      }
      if (!reg) {
        reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1500))
        ]);
      }
      if (!reg) {
        try {
          reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
          await navigator.serviceWorker.ready;
        } catch (_) {}
      }
      if (!reg) {
        reg = await navigator.serviceWorker.getRegistration();
      }
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [300, 150, 300],
          renotify: true,
          requireInteraction: true,
          ...options
        } as any);
        return true;
      }
    } catch (swErr) {
      console.warn('[Notification] SW showNotification error:', swErr);
    }
  }

  // 3. Desktop fallback (Only works on Desktop browsers)
  try {
    new Notification(title, {
      icon: '/icon-192.png',
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

      // Trigger platform notification whenever permission is granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const title = payload.notification?.title || payload.data?.title || '🛍️ Order Status Update';
        const bodyText = payload.notification?.body || payload.data?.body || '';
        if (title || bodyText) {
          showPlatformNotification(title, {
            body: bodyText,
            icon: '/icon-192.png',
            data: {
              url: payload.data?.url || '/my-orders',
              orderId: payload.data?.orderId
            }
          });
        }
      }
    });

    return unsubscribe;
  } catch (error) {
    console.warn('[FCM] Error setting up foreground message listener:', error);
    return null;
  }
};

/**
 * Triggers distinct sound chime and vibration for new order arrival
 */
export const triggerOrderAlertSoundAndVibration = () => {
  // 1. Android Native App Channel Vibration
  if (typeof window !== 'undefined') {
    const androidNotification = (window as unknown as {
      AndroidNotification?: {
        triggerVibration: (duration: number) => void;
      };
    }).AndroidNotification;

    if (androidNotification && typeof androidNotification.triggerVibration === 'function') {
      try {
        androidNotification.triggerVibration(600);
      } catch (_) {}
    }
  }

  // 2. Web Audio alert
  try {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 1.0;
    audio.play().catch(e => console.log('Audio playback prevented by browser:', e));
  } catch (_) {}

  // 3. Web Navigator Vibration API
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([300, 150, 300, 150, 300]);
    } catch (_) {}
  }
};

/**
 * Broadcasts instant real-time order alert across open browser tabs/windows
 */
export const broadcastNewOrderAlert = (data: {
  orderId: string;
  total: number;
  customerName: string;
}) => {
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('lumaro_admin_alerts');
      channel.postMessage({
        type: 'NEW_ORDER_ALERT',
        ...data,
        timestamp: Date.now()
      });
      channel.close();
    }
  } catch (err) {
    console.warn('BroadcastChannel error:', err);
  }
};

/**
 * Broadcasts instant real-time order status update to customer browser tabs/windows
 */
export const broadcastCustomerOrderStatusAlert = (data: {
  orderId: string;
  status: string;
  title: string;
  message: string;
  userId?: string;
}) => {
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('lumaro_order_status_alerts');
      channel.postMessage({
        type: 'ORDER_STATUS_UPDATE',
        ...data,
        timestamp: Date.now()
      });
      channel.close();
    }
  } catch (err) {
    console.warn('BroadcastChannel customer alert error:', err);
  }
};

/**
 * Registers the current device specifically as an Admin Notification Receiver
 */
export const registerCurrentDeviceAsAdminReceiver = async (userId: string): Promise<{ success: boolean; token?: string; error?: string }> => {
  try {
    const res = await requestFcmTokenDetailed();
    if (!res.token) {
      return { success: false, error: res.error || 'FCM Token prapt nahi ho saka' };
    }

    // 1. Save in user and fcm_tokens
    await saveFcmToken(userId, res.token, 'admin');

    // 2. Add to global admin tokens in settings/global for backend dispatch
    try {
      await updateDoc(doc(db, 'settings', 'global'), {
        adminFcmTokens: arrayUnion(res.token)
      });
    } catch (e) {
      console.warn('Could not update adminFcmTokens in settings/global:', e);
    }

    // 3. Trigger immediate confirmation alert
    await showPlatformNotification('Admin Alert Activated! 🔔', {
      body: 'Aapka yeh device naye orders ke notifications ke liye successfully connect ho gaya hai.',
      icon: '/favicon.ico',
      tag: 'admin-device-registered'
    });

    return { success: true, token: res.token };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
};

/**
 * Dispatches an instant FCM push notification to Admin for a new order
 */
export const sendAdminFcmOrderAlert = async (params: {
  orderId: string;
  total: number;
  customerName?: string;
  address?: string;
}) => {
  const shortId = params.orderId.slice(-6).toUpperCase();
  const alertTitle = `🛍️ Naya Order Recieve Hua! (₹${params.total})`;
  const alertBody = `${params.customerName || 'Customer'} ne ₹${params.total} ka naya order place kiya hai (#${shortId}). Tap karke Admin Dashboard me dekhein.`;

  // 1. Broadcast to all open tabs / windows immediately (0ms latency sound & popup)
  broadcastNewOrderAlert({
    orderId: params.orderId,
    total: params.total,
    customerName: params.customerName || 'Customer'
  });

  // 2. Play alert sound & vibration on current device if admin is listening
  triggerOrderAlertSoundAndVibration();

  // 3. Add record in notifications collection for admin history
  try {
    await addDoc(collection(db, 'notifications'), {
      title: alertTitle,
      message: `${alertBody} Address: ${params.address || 'Standard Delivery'}`,
      type: 'admin_order_alert',
      orderId: params.orderId,
      recipientRole: 'admin',
      total: params.total,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('[FCM] Error adding admin order notification doc:', err);
  }

  // 4. Send background FCM Push to ALL registered Admin devices (even when app/phone is completely closed!)
  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
    let serviceAccountJson = '';
    let serverKey = '';
    const tokensSet = new Set<string>();

    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      serviceAccountJson = data.fcmServiceAccountJson?.trim() || '';
      serverKey = data.fcmServerKey?.trim() || '';

      if (Array.isArray(data.adminFcmTokens)) {
        data.adminFcmTokens.forEach((t: string) => {
          if (t && typeof t === 'string' && t.trim().length > 10) {
            tokensSet.add(t.trim());
          }
        });
      }
    }

    // Include local token if available and registered
    if (typeof localStorage !== 'undefined') {
      const localToken = localStorage.getItem('lumaro_fcm_token');
      if (localToken && localToken.length > 10) {
        tokensSet.add(localToken.trim());
      }
    }

    // Query admin users from users collection
    try {
      const adminUsersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      adminUsersSnap.forEach((uDoc) => {
        const uData = uDoc.data();
        if (uData.fcmToken && typeof uData.fcmToken === 'string' && uData.fcmToken.length > 10) {
          tokensSet.add(uData.fcmToken.trim());
        }
        if (Array.isArray(uData.fcmTokens)) {
          uData.fcmTokens.forEach((t: string) => {
            if (t && typeof t === 'string' && t.trim().length > 10) tokensSet.add(t.trim());
          });
        }
      });
    } catch (err) {
      console.warn('[FCM] Error querying admin users tokens:', err);
    }

    // Also query admin by email shiva1520980@gmail.com
    try {
      const emailAdminSnap = await getDocs(query(collection(db, 'users'), where('email', '==', 'shiva1520980@gmail.com')));
      emailAdminSnap.forEach((uDoc) => {
        const uData = uDoc.data();
        if (uData.fcmToken && typeof uData.fcmToken === 'string' && uData.fcmToken.length > 10) {
          tokensSet.add(uData.fcmToken.trim());
        }
      });
    } catch (_) {}

    // Also query dedicated fcm_tokens collection
    try {
      const fcmTokensSnap = await getDocs(query(collection(db, 'fcm_tokens'), where('role', '==', 'admin')));
      fcmTokensSnap.forEach((tDoc) => {
        const tData = tDoc.data();
        if (tData.token && typeof tData.token === 'string' && tData.token.length > 10) {
          tokensSet.add(tData.token.trim());
        }
      });
    } catch (_) {}

    const allAdminTokens = Array.from(tokensSet);
    console.log(`[FCM] Dispatching new order background push to ${allAdminTokens.length} admin device(s)...`);

    if (allAdminTokens.length > 0) {
      if (serviceAccountJson && serviceAccountJson.startsWith('{')) {
        // Send via modern FCM HTTP v1 (Google recommended)
        await Promise.allSettled(
          allAdminTokens.map(token =>
            sendFcmV1Push({
              serviceAccount: serviceAccountJson,
              token,
              title: alertTitle,
              body: alertBody,
              url: '/admin',
              tag: `lumaro-admin-order-${params.orderId}`,
              data: {
                orderId: params.orderId,
                type: 'new_order',
                total: String(params.total),
                customerName: params.customerName || 'Customer',
                url: '/admin'
              }
            })
          )
        );
      } else if (serverKey) {
        // Send via FCM Legacy HTTP API
        await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${serverKey}`
          },
          body: JSON.stringify({
            registration_ids: allAdminTokens,
            notification: {
              title: alertTitle,
              body: alertBody,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              click_action: '/admin',
              sound: 'default'
            },
            data: {
              orderId: params.orderId,
              url: '/admin',
              type: 'new_order',
              tag: `lumaro-admin-order-${params.orderId}`,
              total: String(params.total),
              customerName: params.customerName || 'Customer'
            },
            priority: 'high',
            content_available: true
          }),
          keepalive: true
        });
      }
    }
  } catch (err) {
    console.warn('[FCM] Error dispatching admin order push:', err);
  }
};

/**
 * Automatically dispatches high-priority background FCM Push Notification
 * directly to the customer's phone/browser when Admin updates order status.
 * Delivers and rings even when the customer's browser or app is COMPLETELY CLOSED.
 */
export const sendCustomerFcmOrderStatusAlert = async (params: {
  orderId: string;
  newStatus: string;
  userId?: string;
  customerFcmToken?: string;
  orderTotal?: number;
  customerName?: string;
}): Promise<{ success: boolean; pushedCount: number; error?: string; tokensCount?: number }> => {
  const shortId = params.orderId.slice(-6).toUpperCase();
  const normalizedStatus = (params.newStatus || '').toLowerCase().trim();

  // 1. Determine title and message based on new status
  const statusDetails: Record<string, { title: string; body: string }> = {
    pending: {
      title: `Order Pending ⏳ (#${shortId})`,
      body: `Aapka order pending hai. Store jaldi hi isko review aur confirm karega.`
    },
    confirmed: {
      title: `Order Confirmed! ✅ (#${shortId})`,
      body: `Aapka ₹${params.orderTotal || ''} ka order accept kar liya gaya hai. Store is par kaam kar raha hai.`
    },
    confirm: {
      title: `Order Confirmed! ✅ (#${shortId})`,
      body: `Aapka ₹${params.orderTotal || ''} ka order accept kar liya gaya hai. Store is par kaam kar raha hai.`
    },
    packed: {
      title: `Order Packed! 📦 (#${shortId})`,
      body: `Aapka order pack ho chuka hai aur delivery ke liye bilkul ready hai.`
    },
    packing: {
      title: `Order Packed! 📦 (#${shortId})`,
      body: `Aapka order pack ho chuka hai aur delivery ke liye bilkul ready hai.`
    },
    out_for_delivery: {
      title: `Order Out for Delivery! 🚚 (#${shortId})`,
      body: `Aapka order delivery person ke sath nikal chuka hai. Jaldi hi aapke paas pahuchega!`
    },
    shipped: {
      title: `Order Out for Delivery! 🚚 (#${shortId})`,
      body: `Aapka order delivery person ke sath nikal chuka hai. Jaldi hi aapke paas pahuchega!`
    },
    delivered: {
      title: `Order Delivered! 🎉 (#${shortId})`,
      body: `Aapka order successfully deliver ho gaya hai. Lumaro Mart se shopping karne ke liye dhanyawad!`
    },
    canceled: {
      title: `Order Canceled ❌ (#${shortId})`,
      body: `Aapka order store dwara cancel kar diya gaya hai. Kisi bhi query ke liye support se sampark karein.`
    },
    cancelled: {
      title: `Order Canceled ❌ (#${shortId})`,
      body: `Aapka order store dwara cancel kar diya gaya hai. Kisi bhi query ke liye support se sampark karein.`
    }
  };

  const details = statusDetails[normalizedStatus] || {
    title: `Order Status: ${(params.newStatus || 'Updated').toUpperCase()} (#${shortId})`,
    body: `Aapke order ka status ab ${params.newStatus} ho gaya hai.`
  };

  // Instant local broadcast to all open tabs/windows on customer devices
  broadcastCustomerOrderStatusAlert({
    orderId: params.orderId,
    status: params.newStatus,
    title: details.title,
    message: details.body,
    userId: params.userId
  });

  // 2. Collect all target tokens for this customer
  const tokensSet = new Set<string>();

  if (params.customerFcmToken && params.customerFcmToken.trim().length > 10) {
    tokensSet.add(params.customerFcmToken.trim());
  }

  // Look up user profile in Firestore if userId provided
  if (params.userId) {
    try {
      const userSnap = await getDoc(doc(db, 'users', params.userId));
      if (userSnap.exists()) {
        const uData = userSnap.data();
        if (uData.fcmToken && typeof uData.fcmToken === 'string' && uData.fcmToken.length > 10) {
          tokensSet.add(uData.fcmToken.trim());
        }
      }
    } catch (e) {
      console.warn('[FCM] Error fetching user doc for token:', e);
    }
  }

  const tokens = Array.from(tokensSet);

  if (tokens.length === 0) {
    console.warn(`[FCM] No registered FCM token found for customer (userId: ${params.userId || 'N/A'}). Background push cannot reach device until customer allows notifications.`);
    return { 
      success: false, 
      pushedCount: 0, 
      tokensCount: 0, 
      error: 'Grahak ke device ka FCM Token registered nahi mila. Grahak ko app me "Allow Notifications" karna zaroori hai.' 
    };
  }

  // 3. Fetch FCM Credentials (Service Account JSON for v1 or Legacy Server Key)
  let serviceAccountJson = '';
  let serverKey = '';
  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      serviceAccountJson = data.fcmServiceAccountJson?.trim() || '';
      serverKey = data.fcmServerKey?.trim() || '';
    }
  } catch (err) {
    console.warn('[FCM] Error retrieving FCM credentials from settings:', err);
  }

  // 4A. Modern FCM HTTP v1 Dispatch (Google's official recommended standard)
  if (serviceAccountJson && serviceAccountJson.startsWith('{')) {
    let successCount = 0;
    for (const token of tokens) {
      try {
        const v1Res = await sendFcmV1Push({
          serviceAccount: serviceAccountJson,
          token,
          title: details.title,
          body: details.body,
          url: '/my-orders',
          tag: `lumaro-order-${params.orderId}`,
          data: {
            orderId: params.orderId,
            status: params.newStatus,
            type: 'order_update'
          }
        });
        if (v1Res.success) {
          successCount++;
        }
      } catch (v1Err) {
        console.warn('[FCM v1] Push failed for token:', v1Err);
      }
    }

    if (successCount > 0) {
      console.log(`[FCM v1] Successfully delivered background order push to ${successCount} device(s)`);
      return {
        success: true,
        pushedCount: successCount,
        tokensCount: tokens.length
      };
    }
  }

  // 4B. Fallback: Legacy FCM HTTP API (if Legacy Server Key is present)
  if (!serverKey) {
    console.warn('[FCM] Neither FCM Service Account JSON (v1) nor Legacy Server Key is configured in Admin Settings.');
    return {
      success: false,
      pushedCount: 0,
      tokensCount: tokens.length,
      error: 'Admin Settings me "Service Account JSON" ya "FCM Server Key" save nahi hai. Google FCM v1 Service Account JSON upload karein.'
    };
  }

  // Send via Legacy FCM HTTP API
  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${serverKey}`
      },
      body: JSON.stringify({
        registration_ids: tokens,
        notification: {
          title: details.title,
          body: details.body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          click_action: '/my-orders',
          sound: 'default'
        },
        data: {
          title: details.title,
          body: details.body,
          orderId: params.orderId,
          status: params.newStatus,
          url: '/my-orders',
          type: 'order_update',
          tag: `lumaro-order-${params.orderId}`
        },
        priority: 'high',
        content_available: true
      }),
      keepalive: true
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[FCM] HTTP error from FCM servers:', response.status, errText);
      return {
        success: false,
        pushedCount: 0,
        tokensCount: tokens.length,
        error: `FCM Server Error: ${response.status} - ${errText}`
      };
    }

    const resJson = await response.json();
    console.log('[FCM] Successfully sent background order status push to customer:', resJson);
    return {
      success: resJson.success > 0,
      pushedCount: resJson.success || 0,
      tokensCount: tokens.length
    };
  } catch (pushErr: any) {
    console.error('[FCM] Network error sending customer FCM push:', pushErr);
    return {
      success: false,
      pushedCount: 0,
      tokensCount: tokens.length,
      error: pushErr?.message || String(pushErr)
    };
  }
};

/**
 * Automatically ensures the currently logged-in user's FCM token is generated and synced
 * if browser notification permission is already granted.
 */
export const ensureUserFcmTokenSynced = async (user: { uid: string; role?: string; email?: string; fcmToken?: string } | null) => {
  if (!user?.uid || typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    // 1. Check local storage first
    let token = localStorage.getItem('lumaro_fcm_token');
    if (!token) {
      token = await requestFcmToken();
    }

    if (token) {
      localStorage.setItem('lumaro_fcm_token', token);
      const isAdmin = user.role === 'admin' || user.email === 'shiva1520980@gmail.com';
      const roleToSave = isAdmin ? 'admin' : ((user.role as any) || 'user');

      // Sync if user doesn't have it on profile yet
      if (user.fcmToken !== token) {
        await saveFcmToken(user.uid, token, roleToSave);
      }

      // If user is Admin, automatically ensure device is connected to settings/global.adminFcmTokens
      if (isAdmin) {
        try {
          await updateDoc(doc(db, 'settings', 'global'), {
            adminFcmTokens: arrayUnion(token)
          });
        } catch (e) {
          try {
            await setDoc(doc(db, 'settings', 'global'), {
              adminFcmTokens: arrayUnion(token)
            }, { merge: true });
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    console.warn('[FCM] Error in automatic token sync:', err);
  }
};

/**
 * Sends a real live background FCM push test to current device with optional delay
 * allowing the user to minimize app or lock screen and witness the ring & banner!
 */
export const sendBackgroundFcmPushTest = async (
  token: string,
  serverKeyOrServiceAccount: string,
  delaySeconds: number = 0
): Promise<{ success: boolean; error?: string }> => {
  if (!token) return { success: false, error: 'Device token nahi mila. Kripya pehle "Device Connect Karein" par tap karein.' };
  if (!serverKeyOrServiceAccount || !serverKeyOrServiceAccount.trim()) {
    return { success: false, error: 'Service Account JSON ya FCM Server Key enter karein aur Save karein.' };
  }

  if (delaySeconds > 0) {
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
  }

  const trimmed = serverKeyOrServiceAccount.trim();

  // If Service Account JSON is provided (Modern FCM v1)
  if (trimmed.startsWith('{')) {
    return await sendFcmV1Push({
      serviceAccount: trimmed,
      token,
      title: '🔔 FCM v1 Background Push Succeeded!',
      body: 'Google FCM v1 ने आपके बंद फोन पर लाइव अलर्ट और घंटी बजा दी! 🎉',
      url: '/admin',
      data: {
        type: 'test_push'
      }
    });
  }

  // Fallback: Legacy FCM HTTP API
  try {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${trimmed}`
      },
      body: JSON.stringify({
        to: token,
        priority: 'high',
        notification: {
          title: '🔔 Background Push Test Succeeded!',
          body: 'Google FCM server ne aapke phone par live background alert deliver kar diya! 🎉',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          sound: 'default'
        },
        data: {
          type: 'test_push',
          url: '/admin'
        }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `FCM Error ${res.status}: ${err}` };
    }
    const json = await res.json();
    if (json.success > 0) {
      return { success: true };
    }
    return { success: false, error: json.results?.[0]?.error || 'Unknown push failure' };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
};

// Cooldown map to avoid notification spamming for the same product
const recentStockAlertsMap: Record<string, number> = {};

/**
 * Broadcasts real-time stock alert across open admin browser tabs/windows
 */
export const broadcastStockAlert = (data: {
  title: string;
  body: string;
  productId?: string;
  productName?: string;
  stock?: number;
  isOutOfStock?: boolean;
}) => {
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('lumaro_admin_alerts');
      channel.postMessage({
        type: 'STOCK_ALERT',
        ...data,
        timestamp: Date.now()
      });
      channel.close();
    }
  } catch (err) {
    console.warn('BroadcastChannel stock alert error:', err);
  }
};

export interface StockAlertProductItem {
  id: string;
  name: string;
  stock: number;
  category?: string;
  image?: string;
  isOutOfStock?: boolean;
}

/**
 * Dispatches high-priority FCM Push Notification & Sound Alert to Admin
 * when products go Out of Stock (0 remaining) or hit Low Stock threshold.
 * Works even when Admin's phone / screen is locked or browser is closed.
 */
export const sendAdminFcmStockAlert = async (params: {
  products: StockAlertProductItem[];
  alertType?: 'out_of_stock' | 'low_stock';
  force?: boolean;
}): Promise<{ success: boolean; pushedCount: number; message: string }> => {
  if (!params.products || params.products.length === 0) {
    return { success: false, pushedCount: 0, message: 'Koi product nahi mila.' };
  }

  // De-duplication check: Avoid sending repetitive spam alerts within 15 minutes for the exact same item
  const now = Date.now();
  const eligibleProducts = params.force 
    ? params.products 
    : params.products.filter(p => {
        const lastAlert = recentStockAlertsMap[p.id];
        if (lastAlert && (now - lastAlert < 15 * 60 * 1000)) {
          return false; // Skip if already alerted within last 15 minutes
        }
        return true;
      });

  if (eligibleProducts.length === 0 && !params.force) {
    return { success: true, pushedCount: 0, message: 'Stock alert pehle hi bheja ja chuka hai (cooldown active).' };
  }

  eligibleProducts.forEach(p => {
    recentStockAlertsMap[p.id] = now;
  });

  const targetList = eligibleProducts.length > 0 ? eligibleProducts : params.products;
  const isSingle = targetList.length === 1;
  const primaryItem = targetList[0];
  const isOutOfStock = primaryItem.stock <= 0 || params.alertType === 'out_of_stock';

  let alertTitle = '';
  let alertBody = '';

  if (isSingle) {
    if (isOutOfStock) {
      alertTitle = `🚨 Stock Out Alert: ${primaryItem.name}`;
      alertBody = `"${primaryItem.name}" ka stock khatam (0 bacha) ho gaya hai! Jaldi purchase karke update karein.`;
    } else {
      alertTitle = `⚠️ Low Stock Alert: ${primaryItem.name}`;
      alertBody = `"${primaryItem.name}" me sirf ${primaryItem.stock} items bache hain! Jaldi restock karein.`;
    }
  } else {
    const names = targetList.map(p => `${p.name} (${p.stock} left)`).slice(0, 3).join(', ');
    const extraCount = targetList.length > 3 ? ` aur ${targetList.length - 3} anya` : '';
    if (isOutOfStock) {
      alertTitle = `🚨 ${targetList.length} Items Stock Out Ho Gaye!`;
      alertBody = `${names}${extraCount} ka stock khatam ho gaya hai! Jaldi purchase karke restock karein.`;
    } else {
      alertTitle = `⚠️ Low Stock Alert: ${targetList.length} Products`;
      alertBody = `${names}${extraCount} me stock kam ho gaya hai! Kripya reorder karein.`;
    }
  }

  // 1. Broadcast to all open tabs / windows immediately (0ms latency sound & popup)
  broadcastStockAlert({
    title: alertTitle,
    body: alertBody,
    productId: primaryItem.id,
    productName: primaryItem.name,
    stock: primaryItem.stock,
    isOutOfStock
  });

  // 2. Play alert sound & vibration on current device
  triggerOrderAlertSoundAndVibration();
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    showPlatformNotification(alertTitle, {
      body: alertBody,
      icon: primaryItem.image || '/favicon.ico',
      tag: `stock-alert-${primaryItem.id}-${Date.now()}`,
      data: { url: '/admin', type: 'stock_alert', productId: primaryItem.id }
    }).catch(() => {});
  }

  // 3. Add to Firestore notifications collection for Admin History / Notification Center
  try {
    await addDoc(collection(db, 'notifications'), {
      title: alertTitle,
      message: alertBody,
      type: 'stock_alert',
      recipientRole: 'admin',
      productId: primaryItem.id,
      productName: primaryItem.name,
      stock: primaryItem.stock,
      isOutOfStock,
      category: primaryItem.category || '',
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('[FCM] Error adding stock alert notification doc:', err);
  }

  // 4. Send background FCM Push to all registered Admin devices
  let pushedCount = 0;
  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      const serviceAccountJson = data.fcmServiceAccountJson?.trim();
      const serverKey = data.fcmServerKey?.trim();
      
      const tokensSet = new Set<string>();

      // Admin tokens stored in global settings
      if (Array.isArray(data.adminFcmTokens)) {
        data.adminFcmTokens.forEach((t: string) => {
          if (t && typeof t === 'string' && t.trim().length > 10) {
            tokensSet.add(t.trim());
          }
        });
      }

      // Also include current device token from localStorage if present
      if (typeof localStorage !== 'undefined') {
        const localToken = localStorage.getItem('lumaro_fcm_token');
        if (localToken && localToken.length > 10) {
          tokensSet.add(localToken.trim());
        }
      }

      // Also query admin users from Firestore
      try {
        const adminUsersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
        adminUsersSnap.forEach((uDoc) => {
          const uData = uDoc.data();
          if (uData.fcmToken && typeof uData.fcmToken === 'string' && uData.fcmToken.length > 10) {
            tokensSet.add(uData.fcmToken.trim());
          }
          if (Array.isArray(uData.fcmTokens)) {
            uData.fcmTokens.forEach((t: string) => {
              if (t && typeof t === 'string' && t.trim().length > 10) tokensSet.add(t.trim());
            });
          }
        });
      } catch (err) {
        console.warn('[FCM] Error querying admin users tokens:', err);
      }

      const allAdminTokens = Array.from(tokensSet);

      if (allAdminTokens.length > 0) {
        if (serviceAccountJson && serviceAccountJson.startsWith('{')) {
          // Google FCM HTTP v1 (Modern)
          const results = await Promise.allSettled(
            allAdminTokens.map(token =>
              sendFcmV1Push({
                serviceAccount: serviceAccountJson,
                token,
                title: alertTitle,
                body: alertBody,
                url: '/admin',
                data: {
                  type: 'stock_alert',
                  productId: primaryItem.id,
                  stock: String(primaryItem.stock),
                  isOutOfStock: String(isOutOfStock),
                  url: '/admin'
                }
              })
            )
          );
          pushedCount = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.success).length;
        } else if (serverKey) {
          // Legacy FCM HTTP API
          const res = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `key=${serverKey}`
            },
            body: JSON.stringify({
              registration_ids: allAdminTokens,
              notification: {
                title: alertTitle,
                body: alertBody,
                icon: '/favicon.ico',
                click_action: '/admin',
                sound: 'default'
              },
              data: {
                type: 'stock_alert',
                productId: primaryItem.id,
                stock: String(primaryItem.stock),
                isOutOfStock: String(isOutOfStock),
                url: '/admin'
              },
              priority: 'high'
            }),
            keepalive: true
          });
          if (res.ok) {
            const json = await res.json();
            pushedCount = json.success || 0;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[FCM] Error dispatching stock alert push:', err);
  }

  return { 
    success: true, 
    pushedCount, 
    message: `${alertTitle}: Push alert ${pushedCount} devices par send ho gaya.` 
  };
};

