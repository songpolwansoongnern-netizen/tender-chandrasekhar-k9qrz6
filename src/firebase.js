import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyATlauKs2YARsMj_kMbW4hwg5xf4LiJgIo",
  authDomain: "siriraj-fc-orders.firebaseapp.com",
  projectId: "siriraj-fc-orders",
  storageBucket: "siriraj-fc-orders.firebasestorage.app",
  messagingSenderId: "191060664987",
  appId: "1:191060664987:web:0e1956018958e43f72dc3e",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
