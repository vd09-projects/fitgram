// src/services/initAuth.ts
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';

const INACTIVE_EXPIRY_DAYS = 10; // sign out if no activity for 10 days

let isInitialized = false;
let userDocUnsubscribe: (() => void) | null = null;

// Write server-generated timestamp — client cannot fake this value
const writeLastActive = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { lastActiveAt: serverTimestamp() });
};

// Read lastActiveAt from Firestore and check if session has expired
const checkSessionExpiry = async (uid: string): Promise<boolean> => {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) return false;

  const data = snap.data();
  const lastActive: Timestamp | undefined = data?.lastActiveAt;

  if (!lastActive) {
    // First login — write the timestamp and allow access
    await writeLastActive(uid);
    return false;
  }

  const daysSinceActive = (Date.now() - lastActive.toMillis()) / (1000 * 60 * 60 * 24);
  return daysSinceActive >= INACTIVE_EXPIRY_DAYS;
};

export const initAuthIfNeeded = () => {
  const store = useAuthStore.getState();
  if (isInitialized || store.initialized) return;
  isInitialized = true;

  onAuthStateChanged(auth, async (firebaseUser) => {
    // Cleanup old Firestore listener if user changes
    if (userDocUnsubscribe) {
      userDocUnsubscribe();
      userDocUnsubscribe = null;
    }

    if (!firebaseUser) {
      store.setUser(null);
      store.setUserInfo(null);
      store.setInitialized(true); // no user — show auth screen
      return;
    }

    // Check expiry against Firestore — server timestamp, client can't tamper
    const expired = await checkSessionExpiry(firebaseUser.uid);
    if (expired) {
      await signOut(auth); // triggers onAuthStateChanged again with null
      return;
    }

    // Session valid — update lastActiveAt on server
    await writeLastActive(firebaseUser.uid);
    store.setUser(firebaseUser);
    store.setInitialized(true); // user confirmed — show main screen

    const userInfoRef = doc(db, 'users', firebaseUser.uid, 'info', 'data');

    userDocUnsubscribe = onSnapshot(userInfoRef, (snapshot) => {
      if (snapshot.exists()) {
        store.setUserInfo(snapshot.data() as any);
      } else {
        store.setUserInfo(null);
      }
    });
  });
};

// Called when user brings app to foreground — updates server timestamp
export const refreshLastActive = () => {
  const uid = auth.currentUser?.uid;
  if (uid) writeLastActive(uid);
};
