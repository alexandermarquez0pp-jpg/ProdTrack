import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAp9Hs6_Q6J-qrJ4-GjMFca2knCHpHd-3Y",
    authDomain: "mibolsillo-574ad.firebaseapp.com",
    projectId: "mibolsillo-574ad",
    storageBucket: "mibolsillo-574ad.firebasestorage.app",
    messagingSenderId: "688091349294",
    appId: "1:688091349294:web:cbb2f6b83210894614babf",
    measurementId: "G-YNTDM26HQC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
