import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    deleteDoc, 
    doc, 
    getDocs, 
    updateDoc,
    query, 
    where,
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// Local cache
export let data = {
    groups: [],
    individuals: [],
    individuals: [],
    metrics: [],
    records: [],
    tasks: [], // Agenda activities
    it_tickets: [] // Módulo AIT
};

// Listeners
export function initStoreListeners(callback) {
    // Escuchar Grupos
    onSnapshot(collection(db, "groups"), (snapshot) => {
        data.groups = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback();
    });
    // Escuchar Individuos (Integrantes y Admins)
    onSnapshot(collection(db, "users"), (snapshot) => {
        data.individuals = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .map(u => ({ id: u.id, name: u.email, groupId: u.groupId, status: u.status, role: u.role })); 
        callback();
    });
    // Escuchar Métricas
    onSnapshot(collection(db, "metrics"), (snapshot) => {
        data.metrics = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback();
    });
    // Escuchar Registros
    onSnapshot(collection(db, "records"), (snapshot) => {
        data.records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback();
    });
    // Escuchar Tareas (Agenda)
    let isInitialTasksLoad = true;
    onSnapshot(collection(db, "tasks"), (snapshot) => {
        data.tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        if (!isInitialTasksLoad && window.currentUser && "Notification" in window && Notification.permission === "granted") {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const taskData = change.doc.data();
                    if (taskData.individualId === window.currentUser.uid) {
                        const createdDate = new Date(taskData.createdAt);
                        const now = new Date();
                        // Solo notificar si se creó en los últimos 2 minutos (evitar spam de cache)
                        if ((now - createdDate) < 2 * 60 * 1000) {
                            new Notification("¡Nueva Tarea Asignada! 📋", {
                                body: taskData.title,
                                icon: '/icon-192x192.png'
                            });
                        }
                    }
                }
            });
        }
        isInitialTasksLoad = false;
        callback();
    });
    // Escuchar Tickets AIT
    onSnapshot(collection(db, "it_tickets"), (snapshot) => {
        data.it_tickets = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback();
    });
}

function generateInviteCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// --- Groups ---
export async function addGroup(name, targetAmount, targetMetricId, deadline) {
    const group = { 
        name, 
        targetAmount: parseFloat(targetAmount) || null,
        targetMetricId: targetMetricId || null,
        deadline: deadline || null,
        inviteCode: generateInviteCode()
    };
    await addDoc(collection(db, "groups"), group);
}

export async function deleteGroup(id) {
    await deleteDoc(doc(db, "groups", id));
}

// --- Invitations (Members) ---
export async function requestJoinGroup(userId, inviteCode) {
    // Find group by inviteCode in local cache or query Firestore
    const group = data.groups.find(g => g.inviteCode === inviteCode);
    if (!group) {
        throw new Error("Código de invitación inválido o grupo no encontrado.");
    }
    
    // Update user document
    await updateDoc(doc(db, "users", userId), {
        groupId: group.id,
        status: 'pending'
    });
}

export async function approveUser(userId) {
    await updateDoc(doc(db, "users", userId), {
        status: 'active'
    });
}

export async function rejectUser(userId) {
    await updateDoc(doc(db, "users", userId), {
        groupId: null,
        status: 'none'
    });
}

// --- Metrics ---
export async function addMetric(name, type) {
    await addDoc(collection(db, "metrics"), { name, type });
}

export async function deleteMetric(id) {
    await deleteDoc(doc(db, "metrics", id));
}

// --- Records ---
export async function addRecord(individualId, date, metricsData, notes) {
    await addDoc(collection(db, "records"), { 
        individualId, 
        date, 
        metrics: metricsData, 
        notes: notes || '' 
    });
}

// --- Tasks (Agenda) ---
export async function addTask(individualId, title, date, priority = "2") {
    await addDoc(collection(db, "tasks"), {
        individualId,
        title,
        date,
        priority: priority,
        completed: false,
        createdAt: new Date().toISOString()
    });
}

export async function toggleTaskStatus(taskId, completed) {
    await updateDoc(doc(db, "tasks", taskId), {
        completed: completed
    });
}

export async function deleteTask(taskId) {
    await deleteDoc(doc(db, "tasks", taskId));
}

// --- Soporte AIT ---
export async function addTicket(ticketData) {
    await addDoc(collection(db, "it_tickets"), {
        ...ticketData,
        createdAt: new Date().toISOString()
    });
}

export async function updateTicket(ticketId, updateData) {
    await updateDoc(doc(db, "it_tickets", ticketId), updateData);
}

export async function deleteTicket(ticketId) {
    await deleteDoc(doc(db, "it_tickets", ticketId));
}

export function getGroupById(id) {
    return data.groups.find(g => g.id === id);
}
