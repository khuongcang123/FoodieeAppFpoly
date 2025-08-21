import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
      apiKey: "AIzaSyBzAdWAVjD_NQP3uglLYOOFWUmDGsylsg0",
      authDomain: "foodiee-fcdc1.firebaseapp.com",
      databaseURL: "https://foodiee-fcdc1-default-rtdb.firebaseio.com",
      projectId: "foodiee-fcdc1",
      storageBucket: "foodiee-fcdc1.firebasestorage.app",
      messagingSenderId: "993331259398",
      appId: "1:993331259398:web:2b922ef5e0519d5e237b87",
      measurementId: "G-PDT1VE8JL5"
    };


const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
console.log('[Firebase] App initialized');

const auth = getAuth(app);
const db = getDatabase(app);
console.log('[Firebase] Auth và Database đã được khởi tạo');

export { auth, db };
