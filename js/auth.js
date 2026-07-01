import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// DOM Elements
const loginView = document.getElementById('login-view');
const appContainer = document.querySelector('.app-container');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const nameInput = document.getElementById('auth-name');
const nameGroup = document.getElementById('name-group');
const roleSelect = document.getElementById('auth-role');
const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
const submitAuthBtn = document.getElementById('submit-auth-btn');
const authTitle = document.getElementById('auth-title');
const logoutBtn = document.createElement('button'); // Añadiremos un botón de logout al sidebar

let isLoginMode = true;
window.currentUserRole = null; // 'admin' or 'integrante'
window.currentUserName = null;
window.currentUser = null;

export function initAuth() {
    // Insert logout button into sidebar
    logoutBtn.className = 'btn btn-secondary';
    logoutBtn.textContent = 'Cerrar Sesión';
    logoutBtn.style.marginTop = 'auto';
    logoutBtn.style.marginBottom = '20px';
    logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });
    const sidebar = document.querySelector('.sidebar');
    if(sidebar) sidebar.appendChild(logoutBtn);

    // Toggle Mode
    if (toggleAuthModeBtn) {
        toggleAuthModeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            authTitle.textContent = isLoginMode ? 'Iniciar Sesión' : 'Registrarse';
            submitAuthBtn.textContent = isLoginMode ? 'Entrar' : 'Crear Cuenta';
            toggleAuthModeBtn.textContent = isLoginMode ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión';
            if(roleSelect) roleSelect.style.display = isLoginMode ? 'none' : 'block';
            if(nameGroup) nameGroup.style.display = isLoginMode ? 'none' : 'flex';
        });
    }

    // Form Submit
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value;
            const password = passwordInput.value;
            
            try {
                if (isLoginMode) {
                    await signInWithEmailAndPassword(auth, email, password);
                } else {
                    const role = roleSelect ? roleSelect.value : 'integrante';
                    const name = nameInput ? nameInput.value.trim() : email;
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    // Create user doc
                    await setDoc(doc(db, 'users', userCredential.user.uid), {
                        email: email,
                        name: name,
                        role: role
                    });
                }
                loginForm.reset();
            } catch (error) {
                console.error("Auth error:", error);
                alert("Error de autenticación: " + error.message);
            }
        });
    }

    // Auth State Observer
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            window.currentUser = user;
            // Fetch role & name
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    window.currentUserRole = userDoc.data().role;
                    window.currentUserName = userDoc.data().name || user.email;
                } else {
                    window.currentUserRole = 'integrante'; // default
                    window.currentUserName = user.email;
                }
            } catch (error) {
                console.error("Error fetching user role:", error);
                window.currentUserRole = 'integrante'; // default on error
                window.currentUserName = user.email;
            }

            // Show App, Hide Login
            if (loginView) loginView.style.display = 'none';
            if (appContainer) appContainer.style.display = 'flex';

            // Disparar evento para que app.js reaccione y configure la UI
            document.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user, role: window.currentUserRole } }));
        } else {
            window.currentUser = null;
            window.currentUserRole = null;
            window.currentUserName = null;
            document.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: null, role: null } }));
            
            // Show Login, Hide App
            if (loginView) loginView.style.display = 'flex';
            if (appContainer) appContainer.style.display = 'none';
        }
    });
}
