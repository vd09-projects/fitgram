// src/services/authService.ts
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

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
    role: 'user', // Default role
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