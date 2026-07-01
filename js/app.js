import { initAuth } from './auth.js';
import * as Store from './store.js';
import { initReports } from './reports.js';

// --- Toast System ---
window.showToast = (msg, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✓' : '⚠';
    
    toast.innerHTML = `
        <span style="font-weight: bold; font-size: 1.2rem;">${icon}</span>
        <span>${msg}</span>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

document.addEventListener('DOMContentLoaded', () => {
    
    // Initialize Authentication
    initAuth();
    initReports();

    // --- Navigation Logic ---
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update buttons
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update views
            const targetId = btn.getAttribute('data-target');
            views.forEach(v => v.classList.remove('active'));
            const targetView = document.getElementById(targetId);
            if(targetView) targetView.classList.add('active');
        });
    });

    // Make store functions available globally for inline onclick
    window.approveUser = (id) => Store.approveUser(id);
    window.rejectUser = (id) => Store.rejectUser(id);
    window.deleteGroup = (id) => Store.deleteGroup(id);
    window.deleteMetric = (id) => Store.deleteMetric(id);

    // --- UI Update Logic ---
    function updateUI() {
        if (!window.currentUser) return; // No hacer render si no hay usuario

        const groups = Store.data.groups;
        const individuals = Store.data.individuals;
        const metrics = Store.data.metrics;
        const records = Store.data.records;

        // Apply Role Restrictions
        const isAdmin = window.currentUserRole === 'admin';
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = isAdmin ? '' : 'none';
        });
        document.querySelectorAll('.member-only').forEach(el => {
            el.style.display = !isAdmin ? '' : 'none';
        });

        // Apply Dynamic Theme based on User Name
        document.body.className = ''; // reset themes
        if (window.currentUserName) {
            const lowerName = window.currentUserName.toLowerCase();
            if (lowerName.includes('patricia') || lowerName.includes('patty') || lowerName.includes('ortiz')) {
                document.body.classList.add('theme-patty');
            } else if (lowerName.includes('alex') || lowerName.includes('marquez')) {
                document.body.classList.add('theme-alexander');
            }
        }

        // Member State Enforcement
        if (!isAdmin) {
            const myUser = individuals.find(i => i.id === window.currentUser.uid);
            const myStatus = myUser ? myUser.status : 'none';
            
            const formJoin = document.getElementById('form-join-group');
            const joinMsg = document.getElementById('join-status-message');
            
            if (myStatus === 'pending') {
                if(formJoin) formJoin.style.display = 'none';
                if(joinMsg) joinMsg.innerHTML = '<span style="color: #f29900;">⌛ Tu solicitud está esperando la aprobación del administrador.</span>';
            } else if (myStatus === 'active') {
                if(formJoin) formJoin.style.display = 'none';
                const myGroup = groups.find(g => g.id === myUser.groupId);
                if(joinMsg) joinMsg.innerHTML = `<span style="color: #137333;">✅ Ya eres miembro activo del grupo: <strong>${myGroup ? myGroup.name : 'Desconocido'}</strong></span>`;
            } else {
                if(formJoin) formJoin.style.display = 'block';
                if(joinMsg) joinMsg.innerHTML = '';
            }

            // Force view depending on status
            const activeView = document.querySelector('.view.active');
            if (activeView && activeView.id !== 'register-view' && activeView.id !== 'reports-view' && activeView.id !== 'join-view') {
                navBtns.forEach(b => b.classList.remove('active'));
                views.forEach(v => v.classList.remove('active'));
                
                if (myStatus !== 'active') {
                    document.querySelector('[data-target="join-view"]').classList.add('active');
                    document.getElementById('join-view').classList.add('active');
                } else {
                    document.querySelector('[data-target="register-view"]').classList.add('active');
                    document.getElementById('register-view').classList.add('active');
                }
            }

            // Disable register form if not active
            const regBtn = document.querySelector('#form-record button[type="submit"]');
            if(regBtn) {
                regBtn.disabled = (myStatus !== 'active');
                if(myStatus !== 'active') {
                    regBtn.textContent = "Requiere ser miembro activo";
                } else {
                    regBtn.textContent = "Guardar Registro";
                }
            }
        }

        // 1. Dashboard (Solo si existe y somos admin)
        const dashGroups = document.getElementById('dash-groups');
        if (dashGroups && isAdmin) {
            dashGroups.textContent = groups.length;
            document.getElementById('dash-individuals').textContent = individuals.length;
            
            const today = new Date().toISOString().split('T')[0];
            const todayRecords = records.filter(r => r.date === today);
            document.getElementById('dash-records').textContent = todayRecords.length;

            const dashActiveTeams = document.getElementById('dash-active-teams');
            if (dashActiveTeams) {
                dashActiveTeams.innerHTML = '';
                let activeTeamsCount = 0;

                groups.forEach(g => {
                    if (g.targetAmount && g.targetMetricId && g.deadline) {
                        activeTeamsCount++;
                        const mName = metrics.find(m => m.id === g.targetMetricId)?.name || 'Métrica';
                        
                        const groupInds = individuals.filter(i => i.groupId === g.id && i.status === 'active').map(i => i.id);
                        const validRecords = records.filter(r => groupInds.includes(r.individualId));
                        let currentProgress = 0;
                        validRecords.forEach(r => {
                            if (r.metrics[g.targetMetricId]) {
                                currentProgress += r.metrics[g.targetMetricId];
                            }
                        });

                        const remainingAmount = g.targetAmount - currentProgress;
                        const percentage = Math.min(100, Math.max(0, (currentProgress / g.targetAmount) * 100));
                        let statusText = remainingAmount <= 0 ? '<span style="color: #137333;">¡Completado!</span>' : `Faltan ${remainingAmount.toFixed(1)}`;

                        dashActiveTeams.innerHTML += `
                            <div class="panel" style="display: flex; flex-direction: column; gap: 0.5rem; border-top: 4px solid var(--primary-color);">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <h3 style="margin: 0; font-size: 1.1rem;">${g.name}</h3>
                                    <small style="color: var(--text-muted); font-weight: bold;">🗓️ ${g.deadline}</small>
                                </div>
                                <p style="margin: 0; color: var(--text-muted); font-size: 0.9rem;">Meta: <strong>${g.targetAmount}</strong> ${mName}</p>
                                
                                <div style="width: 100%; background-color: var(--border-color); border-radius: 4px; height: 10px; margin-top: 0.5rem; overflow: hidden;">
                                    <div style="width: ${percentage}%; background-color: var(--primary-color); height: 100%; transition: width 0.3s ease;"></div>
                                </div>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; margin-top: 0.25rem;">
                                    <span>Progreso: ${currentProgress.toFixed(1)}</span>
                                    <strong>${statusText}</strong>
                                </div>
                            </div>
                        `;
                    }
                });

                if (activeTeamsCount === 0) {
                    dashActiveTeams.innerHTML = '<p class="empty-state">No hay equipos con metas activas. Ve a Gestión para asignar metas.</p>';
                }
            }
        }

        // 2. Groups List
        if (isAdmin) {
            const listGroups = document.getElementById('list-groups');
            listGroups.innerHTML = '';

            groups.forEach(g => {
                const li = document.createElement('li');
                let goalText = '';
                if (g.targetAmount && g.targetMetricId && g.deadline) {
                    const mName = metrics.find(m => m.id === g.targetMetricId)?.name || 'Métrica';
                    goalText = `<br><small style="color: var(--text-muted); font-size: 0.8rem;">Meta: ${g.targetAmount} ${mName} (Hasta: ${g.deadline})</small>`;
                }
                const inviteCodeHTML = g.inviteCode ? `<br><strong style="color: var(--primary-color); font-family: monospace; font-size: 1.1rem;">Código: ${g.inviteCode}</strong>` : '';
                
                li.innerHTML = `
                    <div>
                        <span style="font-size: 1.1rem; font-weight: bold;">${g.name}</span>
                        ${inviteCodeHTML}
                        ${goalText}
                    </div>
                    <button class="delete-btn" onclick="window.deleteGroup('${g.id}')">X</button>
                `;
                listGroups.appendChild(li);
            });
        }

        // 3. Individuals List (Pending vs Active)
        if (isAdmin) {
            const listPending = document.getElementById('list-pending');
            const listActive = document.getElementById('list-individuals');
            listPending.innerHTML = '';
            listActive.innerHTML = '';

            let pendingCount = 0;
            individuals.forEach(ind => {
                if (ind.role === 'admin') return; // Hide admins from these lists
                
                const groupName = Store.getGroupById(ind.groupId)?.name || 'Sin grupo';
                const li = document.createElement('li');
                
                if (ind.status === 'pending') {
                    pendingCount++;
                    li.innerHTML = `
                        <span>${ind.name} <span class="badge" style="background: #f29900;">${groupName}</span></span>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-primary" style="padding: 0.25rem 0.5rem;" onclick="window.approveUser('${ind.id}')">✔</button>
                            <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem;" onclick="window.rejectUser('${ind.id}')">✖</button>
                        </div>
                    `;
                    listPending.appendChild(li);
                } else if (ind.status === 'active') {
                    li.innerHTML = `
                        <span>${ind.name} <span class="badge">${groupName}</span></span>
                        <button class="delete-btn" onclick="window.rejectUser('${ind.id}')">X</button>
                    `;
                    listActive.appendChild(li);
                }
            });

            if (pendingCount === 0) {
                listPending.innerHTML = '<p class="empty-state" style="margin:0; padding: 0.5rem;">No hay solicitudes pendientes.</p>';
            }
        }

        // Select de Registro (Admin ve todos los activos, Integrante solo se ve a sí mismo)
        const selectRecordInd = document.getElementById('record-individual');
        if (selectRecordInd) {
            selectRecordInd.innerHTML = '';
            if (isAdmin) {
                selectRecordInd.innerHTML = '<option value="" disabled selected>Selecciona un Individuo</option>';
                individuals.filter(i => i.status === 'active').forEach(ind => {
                    const opt = document.createElement('option');
                    opt.value = ind.id;
                    opt.textContent = ind.name;
                    selectRecordInd.appendChild(opt);
                });
            } else {
                const opt = document.createElement('option');
                opt.value = window.currentUser.uid;
                opt.textContent = window.currentUser.email + " (Tú)";
                opt.selected = true;
                selectRecordInd.appendChild(opt);
                selectRecordInd.disabled = true; // No puede elegir otro
            }
        }

        // 4. Metrics List
        if (isAdmin) {
            const listMetrics = document.getElementById('list-metrics');
            if (listMetrics) {
                listMetrics.innerHTML = '';
                
                metrics.forEach(m => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span>${m.name} <span class="badge">${m.type === 'time' ? 'Horas' : 'Cant.'}</span></span>
                        <button class="delete-btn" onclick="window.deleteMetric('${m.id}')">X</button>
                    `;
                    listMetrics.appendChild(li);
                });
            }
            
            const groupTargetMetric = document.getElementById('group-target-metric');
            if (groupTargetMetric && groupTargetMetric.options.length <= 1) {
                metrics.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.name;
                    groupTargetMetric.appendChild(opt);
                });
            }
        }

        // 5. Dynamic Metrics in Record Form
        const dynamicContainer = document.getElementById('dynamic-metrics-container');
        if (dynamicContainer) {
            if (metrics.length === 0) {
                dynamicContainer.innerHTML = '<p class="empty-state">No hay métricas configuradas. El admin debe crearlas.</p>';
            } else {
                dynamicContainer.innerHTML = '';
                metrics.forEach(m => {
                    const div = document.createElement('div');
                    div.className = 'form-group';
                    div.innerHTML = `
                        <label>${m.name} (${m.type === 'time' ? 'Horas' : 'Cantidad'})</label>
                        <input type="number" step="0.1" class="metric-input" data-metric-id="${m.id}" required>
                    `;
                    dynamicContainer.appendChild(div);
                });
            }
        }
        
        // Report targets update is in reports.js, we will dispatch an event to let it know
        document.dispatchEvent(new Event('dataLoaded'));
    }

    // Reaction to auth
    document.addEventListener('authStateChanged', (e) => {
        if (e.detail.user) {
            // Iniciar listeners de Firestore cuando hay sesión
            Store.initStoreListeners(updateUI);
        }
    });

    // --- Form Submissions ---
    const formGroup = document.getElementById('form-group');
    if (formGroup) {
        formGroup.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('group-name');
            const amountInput = document.getElementById('group-target-amount');
            const metricInput = document.getElementById('group-target-metric');
            const dateInput = document.getElementById('group-target-date');
            
            if(nameInput.value.trim()) {
                await Store.addGroup(
                    nameInput.value.trim(), 
                    amountInput.value, 
                    metricInput.value, 
                    dateInput.value
                );
                window.showToast('Grupo creado correctamente');
                e.target.reset();
            }
        });
    }

    const formJoinGroup = document.getElementById('form-join-group');
    if (formJoinGroup) {
        formJoinGroup.addEventListener('submit', async (e) => {
            e.preventDefault();
            const codeInput = document.getElementById('invite-code-input').value.toUpperCase().trim();
            if (codeInput) {
                try {
                    await Store.requestJoinGroup(window.currentUser.uid, codeInput);
                    window.showToast("Solicitud enviada correctamente.");
                } catch (error) {
                    window.showToast(error.message, 'error');
                }
            }
        });
    }

    const formMetric = document.getElementById('form-metric');
    if (formMetric) {
        formMetric.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('metric-name');
            const typeInput = document.getElementById('metric-type');
            if(nameInput.value.trim() && typeInput.value) {
                await Store.addMetric(nameInput.value.trim(), typeInput.value);
                window.showToast('Métrica añadida correctamente');
                e.target.reset();
            }
        });
    }

    const formRecord = document.getElementById('form-record');
    if (formRecord) {
        formRecord.addEventListener('submit', async (e) => {
            e.preventDefault();
            const indId = document.getElementById('record-individual').value;
            const date = document.getElementById('record-date').value;
            const notes = document.getElementById('record-notes').value;
            
            const metricInputs = document.querySelectorAll('.metric-input');
            const metricsData = {};
            
            metricInputs.forEach(input => {
                const mId = input.getAttribute('data-metric-id');
                metricsData[mId] = parseFloat(input.value) || 0;
            });

            if(indId && date) {
                await Store.addRecord(indId, date, metricsData, notes);
                window.showToast('Registro guardado exitosamente.');
                e.target.reset(); // Reset form
                document.getElementById('record-date').valueAsDate = new Date();
            }
        });
        
        // Auto-fill today's date in record form
        const recordDate = document.getElementById('record-date');
        if(recordDate) recordDate.valueAsDate = new Date();
    }
});
