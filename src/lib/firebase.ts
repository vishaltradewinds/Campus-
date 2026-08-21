import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration from firebase-applet-config.json
// Note: In Vite, we use import.meta.env, but these are provided as regular process.env for standard Node.js or loaded dynamically.
// For AI Studio, we need to import the config file directly if we have it, or use import.meta.env if provided.
// Since the user might not have env vars set immediately, we will read the config file.

import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
