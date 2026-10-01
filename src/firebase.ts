import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  enableNetwork,
  disableNetwork,
  doc,
  getDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
console.log("Initializing Firebase with Project ID:", firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with robust local persistent cache, databaseId, and long-polling configuration.
// experimentalForceLongPolling avoids WebChannel stream transport breaks caused by reverse proxies,
// cloud container timeouts, and restrictive network firewalls that terminate long-lived HTTP streams.
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: true,
    experimentalLongPollingOptions: {
      timeoutSeconds: 25
    },
    ignoreUndefinedProperties: true
  },
  firebaseConfig.firestoreDatabaseId || '(default)'
);

// Automatic network stability monitoring & reconnection management
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('[Firestore] Network online detected, restoring network connection...');
    try {
      await enableNetwork(db);
      console.log('[Firestore] Connection successfully synchronized');
    } catch (err) {
      console.warn('[Firestore] Error re-enabling network:', err);
    }
  });

  window.addEventListener('offline', async () => {
    console.log('[Firestore] Network offline detected, switching to offline cache mode...');
    try {
      await disableNetwork(db);
    } catch (err) {
      console.warn('[Firestore] Error pausing network:', err);
    }
  });
}

// Connection test on initial startup (safe against quota exhaustion)
export const verifyFirestoreConnection = async (): Promise<boolean> => {
  try {
    const testDoc = await getDoc(doc(db, 'test', 'connection'));
    return testDoc.exists();
  } catch (error) {
    return false;
  }
};

export const storage = getStorage(app, firebaseConfig.storageBucket);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

console.log("Firebase initialized with storage bucket:", firebaseConfig.storageBucket);

if (firebaseConfig.apiKey === 'DUMMY_KEY') {
  console.warn("Firebase is using a dummy configuration. Please resolve the project creation quota issue and run setup again.");
}

/**
 * Uploads a file to Firebase Storage and returns the download URL.
 * @param file The file to upload.
 * @param path The path in storage where the file should be saved.
 * @param onProgress Optional callback for upload progress.
 */
export const uploadFile = (
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  console.log(`[Storage] Starting upload to: ${path}`);
  console.log(`[Storage] File details: name=${file.name}, size=${file.size}, type=${file.type}`);
  
  return new Promise((resolve, reject) => {
    try {
      if (!storage) {
        console.error("[Storage] Storage instance is not initialized!");
        return reject(new Error("Storage not initialized"));
      }

      const storageRef = ref(storage, path);
      console.log("[Storage] Created ref, starting uploadTask...");
      const uploadTask = uploadBytesResumable(storageRef, file);

      const timeout = setTimeout(() => {
        uploadTask.cancel();
        console.error(`[Storage] Upload timed out for ${path}`);
        reject(new Error("Upload timed out after 120 seconds. Please check your internet connection."));
      }, 120000);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`[Storage] Progress for ${path}: ${Math.round(progress)}% (${snapshot.bytesTransferred}/${snapshot.totalBytes})`);
          if (onProgress) onProgress(progress);
        },
        (error) => {
          clearTimeout(timeout);
          console.error(`[Storage] Error for ${path}:`, error.code, error.message);
          reject(new Error(`Upload failed: ${error.message}`));
        },
        async () => {
          clearTimeout(timeout);
          console.log(`[Storage] Success for ${path}`);
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log(`[Storage] Download URL: ${downloadURL}`);
            resolve(downloadURL);
          } catch (err) {
            console.error("[Storage] Error getting download URL:", err);
            reject(err);
          }
        }
      );
    } catch (err) {
      console.error("[Storage] Catch error starting upload:", err);
      reject(err);
    }
  });
};
