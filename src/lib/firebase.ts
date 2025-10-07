// Firebase initialization for client-side web
// Remember to create a .env file with the Vite-prefixed vars below.

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
// Firestore (Database)
export const db = getFirestore(app);

// Browser-only, optional Analytics initialization
let analytics: Analytics | undefined;
if (typeof window !== "undefined") {
  // isSupported() checks for environments where Analytics can run (no SSR)
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {
      // ignore analytics errors in unsupported environments
    });
}

export { app, analytics };
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
