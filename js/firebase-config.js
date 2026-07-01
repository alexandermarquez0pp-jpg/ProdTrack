import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCLOmFv7mjrTWbexyZXvVESSkXbaK26tNI",
    authDomain: "app-de-organizacion-71b31.firebaseapp.com",
    projectId: "app-de-organizacion-71b31",
    storageBucket: "app-de-organizacion-71b31.firebasestorage.app",
    messagingSenderId: "1009363887955",
    appId: "1:1009363887955:web:430bdf20b2f003d71223a6",
    measurementId: "G-LMQ877KXCC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
