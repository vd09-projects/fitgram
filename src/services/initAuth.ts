// src/services/initAuth.ts
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';

let isInitialized = false;
let userDocUnsubscribe: (() => void) | null = null;

export const initAuthIfNeeded = () => {
  const store = useAuthStore.getState();
  if (isInitialized || store.initialized) return;
  isInitialized = true;
  store.setInitialized(true);

  onAuthStateChanged(auth, (firebaseUser) => {
    store.setUser(firebaseUser);

    // Cleanup old Firestore listener if user changes
    if (userDocUnsubscribe) {
      userDocUnsubscribe();
      userDocUnsubscribe = null;
    }

    if (!firebaseUser) {
      store.setUserInfo(null);
      return;
    }

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