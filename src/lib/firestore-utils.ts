import { auth } from '../firebase';
import { cacheUtils } from './cache-utils';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export let isFirestoreQuotaExhausted = false;
type QuotaListener = (exhausted: boolean) => void;
const quotaListeners: Set<QuotaListener> = new Set();

export function onQuotaExhaustedChange(listener: QuotaListener) {
  quotaListeners.add(listener);
  listener(isFirestoreQuotaExhausted);
  return () => {
    quotaListeners.delete(listener);
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  let errorMessage = 'An unknown error occurred';
  let isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  let isQuota = false;
  
  if (error instanceof Error) {
    errorMessage = error.message;
    const lowerMessage = errorMessage.toLowerCase();
    if (lowerMessage.includes('offline') || lowerMessage.includes('unavailable') || lowerMessage.includes('network')) {
      isOffline = true;
    }
    if (lowerMessage.includes('resource-exhausted') || lowerMessage.includes('quota exceeded')) {
      isQuota = true;
    }
  } else if (typeof error === 'string') {
    errorMessage = error;
    const lowerMessage = errorMessage.toLowerCase();
    if (lowerMessage.includes('offline') || lowerMessage.includes('unavailable') || lowerMessage.includes('network')) {
      isOffline = true;
    }
    if (lowerMessage.includes('resource-exhausted') || lowerMessage.includes('quota exceeded')) {
      isQuota = true;
    }
  } else {
    errorMessage = cacheUtils.safeStringify(error);
  }

  if (isQuota) {
    if (!isFirestoreQuotaExhausted) {
      isFirestoreQuotaExhausted = true;
      quotaListeners.forEach(listener => {
        try {
          listener(true);
        } catch (e) {
          // ignore listener errors
        }
      });
      console.warn('[Firestore] Daily free quota exceeded. The application is running seamlessly on local persistent cache until quota resets.');
    }
    return; // Do not crash or spam unhandled exceptions
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };

  const errString = cacheUtils.safeStringify(errInfo);
  
  if (isOffline) {
    console.warn(`Firestore operation '${operationType}' on '${path}' is pending/offline: ${errorMessage}`);
    return; // graceful return, do not throw to crash the app
  }

  console.warn(`Firestore operation '${operationType}' on '${path}' failed:`, errorMessage);
  console.debug('Firestore Error Details:', errString);
}
