import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, Timestamp, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { env } from './env';

const firebaseConfig = {
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  storageBucket: env.firebase.storageBucket,
  messagingSenderId: env.firebase.messagingSenderId,
  appId: env.firebase.appId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, env.firebase.databaseId);

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
  cloudName: env.cloudinary.cloudName,
  uploadPreset: env.cloudinary.uploadPreset,
  folderPrefix: env.cloudinary.folderPrefix,
};
