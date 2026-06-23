import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromCache,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
const wordsCollection = collection(db, "words");

function getMissingFirebaseKeys() {
  return Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

export async function adminLogin() {
  const missingKeys = getMissingFirebaseKeys();

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing Firebase env values: ${missingKeys.join(", ")}. Add them to .env.local.`,
    );
  }

  const provider = new GoogleAuthProvider();

  const result = await signInWithPopup(auth, provider);

  return result.user;
}

function normalizeWordSnapshot(wordDoc) {
  const data = wordDoc.data();

  return {
    ...data,
    word: data.word ?? wordDoc.id,
    id: wordDoc.id,
  };
}

export async function loadRemoteWords() {
  // ✨ Check network context before querying Firestore
  if (!navigator.onLine) {
    console.log(
      "Offline context detected: Sourcing data from local cache storage.",
    );
    const cacheSnapshot = await getDocsFromCache(wordsCollection);
    return cacheSnapshot.docs.map(normalizeWordSnapshot);
  }

  // Fallback to normal online behavior
  const snapshot = await getDocs(wordsCollection);
  return snapshot.docs.map(normalizeWordSnapshot);
}

export async function saveRemoteWord(word) {
  await setDoc(
    doc(db, "words", word.word),
    {
      ...word,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteRemoteWord(wordName) {
  await deleteDoc(doc(db, "words", wordName));
}

export async function loadRemoteLearnedWords(uid) {
  if (!uid) {
    return [];
  }

  const snapshot = await getDoc(doc(db, "users", uid));

  return Array.isArray(snapshot.data()?.learnedWords)
    ? snapshot.data().learnedWords
    : [];
}

export async function saveRemoteLearnedWords(uid, learnedWords) {
  if (!uid) {
    return;
  }

  await setDoc(
    doc(db, "users", uid),
    {
      learnedWords,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveRemoteApiKey(uid, apiKey) {
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, { geminiApiKey: apiKey }, { merge: true });
}

export async function loadRemoteApiKey(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data().geminiApiKey : "";
}

export { app, auth, db };
