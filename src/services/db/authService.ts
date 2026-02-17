// src/services/authService.ts
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithCredential, linkWithCredential } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth, db } from '../firebase';
import { googleWebClientId } from '../../config/envConfig';

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
    provider: 'email',
  });

  return user;
};

// Function to handle user sign-in
export const signInUser = async (email: string, password: string) => {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

// Function to handle Google sign-in (works for both sign-in and sign-up)
export const signInWithGoogle = async () => {
  GoogleSignin.configure({
    webClientId: googleWebClientId,
  });

  await GoogleSignin.hasPlayServices();
  const signInResult = await GoogleSignin.signIn();
  const idToken = signInResult.data?.idToken;

  if (!idToken) {
    throw new Error('Failed to get Google ID token.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  const user = userCredential.user;

  // Check if this is a new user — create Firestore profile if so
  const userInfoRef = doc(db, 'users', user.uid, 'info', 'data');
  const userInfoSnap = await getDoc(userInfoRef);

  if (!userInfoSnap.exists()) {
    const userRef = doc(db, 'users', user.uid);

    await setDoc(userRef, {
      uid: user.uid,
      verified: true,
      createdAt: new Date(),
    });

    await setDoc(userInfoRef, {
      name: user.displayName || '',
      email: user.email || '',
      uid: user.uid,
      createdAt: new Date(),
      role: 'user',
      provider: 'google',
    });
  }

  return user;
};

// Function to link Google account to an existing email/password user
export const linkGoogleAccount = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No user is currently signed in.');
  }

  GoogleSignin.configure({
    webClientId: googleWebClientId,
  });

  await GoogleSignin.hasPlayServices();
  const signInResult = await GoogleSignin.signIn();
  const idToken = signInResult.data?.idToken;

  if (!idToken) {
    throw new Error('Failed to get Google ID token.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  await linkWithCredential(currentUser, credential);
};