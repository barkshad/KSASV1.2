import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, Timestamp, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';

// Firebase config now comes from env vars (see .env.example) instead of
// being hardcoded here. This is mainly for hygiene / multi-environment
// support — Firebase web API keys identify the project rather than secure
// it, so Firestore security rules remain the actual access control layer.
function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. Copy .env.example to .env and fill in your Firebase project values.`
    );
  }
  return value;
}

const firebaseConfig = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, requireEnv('VITE_FIREBASE_FIRESTORE_DB_ID'));

// Re-export common Firestore functions to use elsewhere
export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  onSnapshot,
  runTransaction,
  serverTimestamp
};

export const CLOUDINARY_CONFIG = {
  cloudName: requireEnv('VITE_CLOUDINARY_CLOUD_NAME'),
  uploadPreset: requireEnv('VITE_CLOUDINARY_UPLOAD_PRESET'),
  folderPrefix: import.meta.env.VITE_CLOUDINARY_FOLDER_PREFIX || 'ksas/',
};
