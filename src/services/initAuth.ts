// src/services/initAuth.ts
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';

const INACTIVE_EXPIRY_DAYS = 10; // sign out if no activity for 10 days
const FRESH_SIGNIN_WINDOW_MS = 5 * 60 * 1000; // credential verified this recently is trusted

let isInitialized = false;
let userDocUnsubscribe: (() => void) | null = null;

// Write server-generated timestamp — client cannot fake this value.
// Merge rather than update: legacy accounts may be missing the users/{uid} root doc.
const writeLastActive = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { lastActiveAt: serverTimestamp() }, { merge: true });
};

// A credential the user just entered is trusted regardless of prior inactivity —
// the expiry gate exists for sessions restored from storage, not for fresh sign-ins.
const isFreshSignIn = (firebaseUser: User) => {
  const lastSignIn = firebaseUser.metadata.lastSignInTime;
  if (!lastSignIn) return false;
  return Date.now() - new Date(lastSignIn).getTime() < FRESH_SIGNIN_WINDOW_MS;
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

    try {
      // Expiry applies only to restored sessions — a just-verified credential skips it
      if (!isFreshSignIn(firebaseUser)) {
        const expired = await checkSessionExpiry(firebaseUser.uid);
        if (expired) {
          await signOut(auth); // triggers onAuthStateChanged again with null
          return;
        }
      }

      // Session valid — update lastActiveAt on server
      await writeLastActive(firebaseUser.uid);
    } catch (error) {
      // Firestore unreachable or rules denied — never strand the app on the splash screen
      console.warn('Auth session check failed, continuing with authenticated user:', error);
    }

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
  if (uid) writeLastActive(uid).catch((error) => {
    console.warn('Failed to refresh lastActiveAt:', error);
  });
};
