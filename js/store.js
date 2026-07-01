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
    metrics: [],
    records: []
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

export function getGroupById(id) {
    return data.groups.find(g => g.id === id);
}
