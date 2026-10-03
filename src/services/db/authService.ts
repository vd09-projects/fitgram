// src/services/authService.ts
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithCredential,
  linkWithCredential,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth, db } from '../firebase';
import { googleWebClientId } from '../../config/envConfig';
import { useAuthStore } from '../../stores/authStore';
import { getLinkedMethods } from '../../utils/authProviders';
import { isValidPassword } from '../../utils/validation';

const userInfoDoc = (uid: string) => doc(db, 'users', uid, 'info', 'data');

// Mirror the account's linked sign-in methods onto info/data.provider.
// Best effort: the credential change has already succeeded by the time this runs,
// so a failed mirror write must not be reported to the user as a failed link.
const syncLinkedMethods = async (user: User) => {
  try {
    await user.reload();
    const methods = getLinkedMethods(user);
    if (methods.length === 0) return;
    await setDoc(userInfoDoc(user.uid), { provider: methods }, { merge: true });
  } catch (error) {
    console.warn('Failed to sync linked sign-in methods:', error);
  }
};

// Function to handle user sign-up and Firestore storage
export const signUpUser = async (name: string, email: string, password: string) => {
  if (!name || !email || !password) {
    throw new Error('All fields are required.');
  }

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const userRef = doc(db, 'users', user.uid);

  await setDoc(userRef, {
    uid: user.uid,
    verified: true,
    createdAt: new Date(),
  });

  // Store user info
  await setDoc(doc(userRef, 'info', 'data'), {
    name: name,
    email: email,
    uid: user.uid,
    createdAt: new Date(),
    role: 'user',
    provider: ['email'],
  });

  return user;
};

// Function to handle user sign-in
export const signInUser = async (email: string, password: string) => {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  useAuthStore.getState().setUser(userCredential.user);
  return userCredential.user;
};

// Shared helper — runs the Google picker and turns its ID token into a Firebase credential
const getGoogleCredential = async () => {
  GoogleSignin.configure({ webClientId: googleWebClientId });
  await GoogleSignin.hasPlayServices();
  const signInResult = await GoogleSignin.signIn();
  const idToken = signInResult.data?.idToken;
  if (!idToken) throw new Error('Failed to get Google ID token.');
  return {
    credential: GoogleAuthProvider.credential(idToken),
    googleName: signInResult.data?.user?.name || '',
  };
};

// Shared helper — authenticates with Google and returns the Firebase user + Google profile
const authenticateWithGoogle = async () => {
  const { credential, googleName } = await getGoogleCredential();
  const userCredential = await signInWithCredential(auth, credential);
  return { user: userCredential.user, googleName };
};

// Sign IN with Google — fails if no Fitgram account exists yet
export const signInWithGoogle = async () => {
  const { user } = await authenticateWithGoogle();

  const userInfoSnap = await getDoc(userInfoDoc(user.uid));

  if (!userInfoSnap.exists()) {
    throw new Error('No account found. Please sign up first.');
  }

  useAuthStore.getState().setUser(user);
  return user;
};

// Sign UP with Google — creates Fitgram profile, fails if account already exists
export const signUpWithGoogle = async () => {
  const { user, googleName } = await authenticateWithGoogle();

  const userInfoRef = userInfoDoc(user.uid);
  const userInfoSnap = await getDoc(userInfoRef);

  if (userInfoSnap.exists()) {
    useAuthStore.getState().setUser(user);
    throw new Error('Account already exists. Please sign in instead.');
  }

  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, { uid: user.uid, verified: true, createdAt: new Date() });
  await setDoc(userInfoRef, {
    name: googleName || user.displayName || '',
    email: user.email || '',
    uid: user.uid,
    createdAt: new Date(),
    role: 'user',
    provider: ['google'],
  });

  useAuthStore.getState().setUser(user);
  return user;
};

// Send a Firebase password reset link. Completing that link sets a password on the
// account — including a Google-only account, which gains an email/password provider
// on the same uid. Resolves even for an unregistered email: Firebase's
// email-enumeration protection deliberately hides whether the account exists.
export const sendPasswordReset = async (email: string) => {
  const trimmed = email.trim();
  if (!trimmed) {
    throw new Error('Email is required.');
  }

  await sendPasswordResetEmail(auth, trimmed);
};

// Re-verify the signed-in user so Firebase will accept a credential change.
// Only a provider the account already has can re-verify it, and re-entering a
// password is not an option for an account that does not have one yet — so Google
// is the only path that can run without asking for a credential the user lacks.
const reauthenticateCurrentUser = async (user: User) => {
  if (!getLinkedMethods(user).includes('google')) {
    throw new Error('Please sign out and sign in again, then try this once more.');
  }

  const { credential } = await getGoogleCredential();
  await reauthenticateWithCredential(user, credential);
};

// Add an email/password credential to the signed-in account, keeping the same uid.
// This is the route back in for an account that can only sign in with Google.
export const setPasswordForCurrentUser = async (password: string) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No user is currently signed in.');
  }
  if (!currentUser.email) {
    throw new Error('This account has no email address to attach a password to.');
  }
  if (!isValidPassword(password)) {
    throw new Error('Password must be at least 6 characters.');
  }

  const credential = EmailAuthProvider.credential(currentUser.email, password);

  try {
    await linkWithCredential(currentUser, credential);
  } catch (error: any) {
    // Firebase rejects credential changes on a session it has not verified recently
    if (error?.code !== 'auth/requires-recent-login') throw error;
    await reauthenticateCurrentUser(currentUser);
    await linkWithCredential(currentUser, credential);
  }

  await syncLinkedMethods(currentUser);
};

// Function to link Google account to an existing email/password user
export const linkGoogleAccount = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No user is currently signed in.');
  }

  const { credential } = await getGoogleCredential();

  try {
    await linkWithCredential(currentUser, credential);
  } catch (error: any) {
    if (error?.code !== 'auth/requires-recent-login') throw error;
    await reauthenticateCurrentUser(currentUser);
    await linkWithCredential(currentUser, credential);
  }

  await syncLinkedMethods(currentUser);
};
