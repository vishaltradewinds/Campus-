/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Dev-only synthetic acceptance. Never enable emulator routing in a production build.
const emulatorTest = import.meta.env.DEV && import.meta.env.VITE_NEXUSTALENT_EMULATOR_TEST === '1';
if (emulatorTest && window.location.hostname !== '127.0.0.1') throw new Error('Acceptance mode requires loopback origin');
const config = emulatorTest ? { projectId: 'demo-nexustalent-acceptance', apiKey: 'demo-key', appId: '1:123456789:web:acceptance', authDomain: 'demo-nexustalent-acceptance.firebaseapp.com' } : firebaseConfig;
const app = initializeApp(config);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
if (emulatorTest) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
