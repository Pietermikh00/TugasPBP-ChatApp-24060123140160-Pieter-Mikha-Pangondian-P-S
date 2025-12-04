// Konfigurasi dan inisialisasi Firebase (SDK v9 modular)
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  type CollectionReference,
  type DocumentData,
} from 'firebase/firestore';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

// Ganti placeholder ini dengan konfigurasi asli dari Firebase Console
const firebaseConfig = {
  apiKey: 'AIzaSyCgqhTSw5uXg0R4vSAjAycSesjG9MC93SQ',
  authDomain: 'chatapp-cdd4e.firebaseapp.com',
  projectId: 'chatapp-cdd4e',
  storageBucket: 'chatapp-cdd4e.firebasestorage.app',
  messagingSenderId: '605249912968',
  appId: '1:605249912968:android:4775eb2def0501c4ac5f3d',
};

// Inisialisasi app, auth, dan firestore
const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
const db = getFirestore(app);
const storage = getStorage(app);

// Reference ke collection "messages" (type-safe)
const messagesCollection: CollectionReference<DocumentData> = collection(db, 'messages');

// Export objek utama dan fungsi yang dibutuhkan
export { auth, db, storage, messagesCollection, addDoc, serverTimestamp, query, orderBy, onSnapshot, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut, ref, uploadString, getDownloadURL };
