/**
 * Lumaro Mart Android & Web Unified Permissions Utility
 * Bridges Android Native Runtime Permissions (via MainActivity.java JavascriptInterface)
 * and Standard Web / PWA Browser Permission APIs.
 */

export type AppPermissionKey = 
  | 'microphone' 
  | 'storage' 
  | 'camera' 
  | 'location' 
  | 'notification' 
  | 'bluetooth';

export interface PermissionItem {
  id: AppPermissionKey;
  title: string;
  hindiTitle: string;
  description: string;
  icon: string;
  requiredFor: string;
}

export const APP_PERMISSIONS: PermissionItem[] = [
  {
    id: 'notification',
    title: 'Notifications & Alerts',
    hindiTitle: 'ऑर्डर नोटिफिकेशन और रिंगटोन',
    description: 'Naya order aane par status bar popup aur urgent sound play karne ke liye.',
    icon: '🔔',
    requiredFor: 'Order Ringtone & Status Updates'
  },
  {
    id: 'microphone',
    title: 'Microphone & Audio',
    hindiTitle: 'माइक (आवाज़ से सर्च)',
    description: 'Voice search ke jariye bolkar grocery items dhundhne aur voice notes ke liye.',
    icon: '🎙️',
    requiredFor: 'Voice Search & Voice Input'
  },
  {
    id: 'storage',
    title: 'Storage & Media Photos',
    hindiTitle: 'स्टोरेज और फोटो गैलरी',
    description: 'Product photos, invoice bill download karne aur profile picture upload karne ke liye.',
    icon: '📁',
    requiredFor: 'Invoice Download & Image Upload'
  },
  {
    id: 'camera',
    title: 'Camera Access',
    hindiTitle: 'कैमरा (स्कैनर और फोटो)',
    description: 'Product barcode / QR code scan karne aur nayi photo capture karne ke liye.',
    icon: '📷',
    requiredFor: 'Barcode / QR Scanner & Camera'
  },
  {
    id: 'location',
    title: 'GPS Location',
    hindiTitle: 'लोकेशन (डिलीवरी पता)',
    description: 'Delivery address auto-detect karne aur delivery partner live distance calculate karne ke liye.',
    icon: '📍',
    requiredFor: 'Live Delivery Address'
  },
  {
    id: 'bluetooth',
    title: 'Bluetooth Thermal Printer',
    hindiTitle: 'ब्लूटूथ थर्मल प्रिंटर',
    description: 'Receipt printer (58mm / 80mm) se customer bill print nikalne ke liye.',
    icon: '🖨️',
    requiredFor: 'Thermal Receipt Printing'
  }
];

interface NativeAndroidPermissions {
  checkPermission: (permissionType: string) => boolean;
  requestPermission: (permissionType: string) => void;
  openAppSettings: () => void;
}

declare global {
  interface Window {
    AndroidPermissions?: NativeAndroidPermissions;
  }
}

/**
 * Checks whether the app is currently running inside the native Android APK/AAB wrapper.
 */
export const isAndroidNativeApp = (): boolean => {
  return typeof window !== 'undefined' && !!window.AndroidPermissions;
};

/**
 * Check permission status for a given key.
 * Works seamlessly in both Native Android APK and Web / Chrome / PWA.
 */
export const checkAppPermission = async (permissionKey: AppPermissionKey): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  // 1. Android Native Bridge
  if (window.AndroidPermissions) {
    try {
      return Boolean(window.AndroidPermissions.checkPermission(permissionKey));
    } catch (e) {
      console.warn('Native checkPermission error:', e);
    }
  }

  // 2. Web / Browser API Fallback
  try {
    if (permissionKey === 'notification') {
      return 'Notification' in window && Notification.permission === 'granted';
    }

    if (permissionKey === 'storage') {
      // Browser storage is always accessible
      return true;
    }

    if (permissionKey === 'location') {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        return status.state === 'granted';
      }
      return false;
    }

    if (permissionKey === 'microphone' || permissionKey === 'camera') {
      if (navigator.permissions && navigator.permissions.query) {
        const queryName = permissionKey === 'microphone' ? 'microphone' : 'camera';
        // Note: some browsers don't support camera/mic in permissions.query
        const status = await navigator.permissions.query({ name: queryName as PermissionName }).catch(() => null);
        if (status) return status.state === 'granted';
      }
      return false;
    }

    if (permissionKey === 'bluetooth') {
      return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
    }
  } catch (err) {
    console.debug('Web permission check exception:', err);
  }

  return false;
};

/**
 * Request runtime permission from user.
 * In Android Native: triggers the official Android OS System Permission Dialog.
 * In Web Browser: triggers browser permission prompt.
 */
export const requestAppPermission = async (permissionKey: AppPermissionKey | 'all'): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  // 1. Android Native Bridge (Triggers OS prompt)
  if (window.AndroidPermissions) {
    try {
      window.AndroidPermissions.requestPermission(permissionKey);
      return true;
    } catch (e) {
      console.warn('Native requestPermission error:', e);
    }
  }

  // 2. Web / Browser fallback
  try {
    if (permissionKey === 'notification' || permissionKey === 'all') {
      if ('Notification' in window) {
        const res = await Notification.requestPermission();
        if (res === 'granted' && permissionKey === 'notification') return true;
      }
    }

    if (permissionKey === 'location' || permissionKey === 'all') {
      if ('geolocation' in navigator) {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
        }).catch(() => {});
        if (permissionKey === 'location') return true;
      }
    }

    if (permissionKey === 'microphone' || permissionKey === 'all') {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          if (permissionKey === 'microphone') return true;
        } catch (e) {
          console.debug('Microphone permission request rejected:', e);
        }
      }
    }

    if (permissionKey === 'camera' || permissionKey === 'all') {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(t => t.stop());
          if (permissionKey === 'camera') return true;
        } catch (e) {
          console.debug('Camera permission request rejected:', e);
        }
      }
    }

    if (permissionKey === 'all') {
      return true;
    }
  } catch (err) {
    console.warn('Web permission request failed:', err);
  }

  return false;
};

/**
 * Open Device App Settings so user can enable permissions manually if blocked.
 */
export const openDeviceAppSettings = () => {
  if (typeof window !== 'undefined' && window.AndroidPermissions) {
    try {
      window.AndroidPermissions.openAppSettings();
      return;
    } catch (e) {
      console.warn('Native openAppSettings error:', e);
    }
  }
  // Browser fallback notice
  alert('Kripya apne browser ya phone ki Settings me jakar Lumaro Mart permissions allow karein.');
};
