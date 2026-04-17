import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
console.log("Initializing Firebase with Project ID:", firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Test Connection
async function testConnection() {
  try {
    console.log("Testing Firestore connection...");
    const testDoc = await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test successful.");
  } catch (error: any) {
    console.error("Firestore connection test failed.");
    console.error("Error Code:", error?.code);
    console.error("Error Message:", error?.message);
    
    if (error?.code === 'permission-denied') {
      console.warn("CRITICAL: Permission Denied. This usually means the security rules are not deployed to the correct project or database.");
    }
  }
}
testConnection();

export const storage = getStorage(app, firebaseConfig.storageBucket);

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
