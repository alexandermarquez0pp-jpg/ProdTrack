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
    
    // Solicitar permiso de Notificaciones
    if ("Notification" in window) {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }

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
    window.toggleTaskStatus = (id, el) => Store.toggleTaskStatus(id, el.checked);
    window.deleteTask = (id) => Store.deleteTask(id);

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
            const groupIndicator = document.getElementById('user-group-indicator');
            
            if (myStatus === 'pending') {
                if(formJoin) formJoin.style.display = 'none';
                if(joinMsg) joinMsg.innerHTML = '<span style="color: #f29900;">⌛ Tu solicitud está esperando la aprobación del administrador.</span>';
                if(groupIndicator) { groupIndicator.style.display = 'none'; }
            } else if (myStatus === 'active') {
                if(formJoin) formJoin.style.display = 'none';
                const myGroup = groups.find(g => g.id === myUser.groupId);
                if(joinMsg) joinMsg.innerHTML = `<span style="color: #137333;">✅ Ya eres miembro activo del grupo: <strong>${myGroup ? myGroup.name : 'Desconocido'}</strong></span>`;
                
                if(groupIndicator) {
                    groupIndicator.textContent = `Grupo: ${myGroup ? myGroup.name : 'Desconocido'}`;
                    groupIndicator.style.display = 'block';
                }
            } else {
                if(formJoin) formJoin.style.display = 'block';
                if(joinMsg) joinMsg.innerHTML = '';
                if(groupIndicator) { groupIndicator.style.display = 'none'; }
            }

            // Force view depending on status
            const activeView = document.querySelector('.view.active');
            if (activeView && activeView.id !== 'register-view' && activeView.id !== 'reports-view' && activeView.id !== 'join-view' && activeView.id !== 'agenda-view' && activeView.id !== 'ait-view') {
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

        const tasks = Store.data.tasks || [];
        const it_tickets = Store.data.it_tickets || [];

        // 6. Personal Agenda (Members)
        if (!isAdmin) {
            const listMyTasks = document.getElementById('list-my-tasks');
            if (listMyTasks) {
                listMyTasks.innerHTML = '';
                const myTasks = tasks.filter(t => t.individualId === window.currentUser.uid);
                
                myTasks.sort((a, b) => a.completed - b.completed || new Date(b.date) - new Date(a.date));

                if (myTasks.length === 0) {
                    listMyTasks.innerHTML = '<p class="empty-state">No tienes tareas programadas.</p>';
                } else {
                    myTasks.forEach(t => {
                        const li = document.createElement('li');
                        if(t.completed) li.classList.add('task-completed');
                        const priorityBadge = t.priority ? `<span class="badge" style="margin-left: 0.5rem; background-color: ${t.priority==='1'?'#dc3545':t.priority==='2'?'#ffc107':'#28a745'}; color: ${t.priority==='2'?'#000':'#fff'}">P${t.priority}</span>` : '';
                        li.innerHTML = `
                            <input type="checkbox" onchange="window.toggleTaskStatus('${t.id}', this)" ${t.completed ? 'checked' : ''}>
                            <span><strong>${t.title}</strong> ${priorityBadge} <small style="color:var(--text-muted);">(${t.date})</small></span>
                            <button class="delete-btn" onclick="window.deleteTask('${t.id}')">X</button>
                        `;
                        listMyTasks.appendChild(li);
                    });
                }
            }
        }

        // 7. Admin Supervision Agenda
        if (isAdmin) {
            const adminFilter = document.getElementById('admin-agenda-filter');
            const assignUsers = document.getElementById('assign-task-users');
            const aitAdminFilter = document.getElementById('ait-admin-user-filter');

            if (adminFilter && adminFilter.options.length <= 1) {
                adminFilter.innerHTML = '<option value="" disabled selected>Selecciona un Integrante</option>';
                assignUsers.innerHTML = ''; // Limpiar select múltiple
                if(aitAdminFilter) aitAdminFilter.innerHTML = '<option value="" disabled selected>Selecciona un Integrante</option>';

                individuals.filter(i => i.status === 'active' && i.role !== 'admin').forEach(ind => {
                    const opt = document.createElement('option');
                    opt.value = ind.id;
                    opt.textContent = ind.name;
                    adminFilter.appendChild(opt);

                    const optAssign = document.createElement('option');
                    optAssign.value = ind.id;
                    optAssign.textContent = ind.name;
                    assignUsers.appendChild(optAssign);

                    if(aitAdminFilter) {
                        const optAit = document.createElement('option');
                        optAit.value = ind.id;
                        optAit.textContent = ind.name;
                        aitAdminFilter.appendChild(optAit);
                    }
                });
            }
            
            // Render results based on current filter
            window.renderAdminAgenda();
        }

        // 8. AIT Support View updates
        if (!isAdmin) {
            const aitTodayCount = document.getElementById('ait-today-count');
            if (aitTodayCount) {
                const today = new Date().toLocaleDateString('es-ES');
                const myTicketsToday = it_tickets.filter(t => t.individualId === window.currentUser.uid && t.dateStr === today);
                aitTodayCount.textContent = `${myTicketsToday.length} Registros Hoy`;
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

    const formAddTask = document.getElementById('form-add-task');
    if (formAddTask) {
        // Auto-fill today
        document.getElementById('task-date').valueAsDate = new Date();
        formAddTask.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('task-title').value.trim();
            const date = document.getElementById('task-date').value;
            if (title && date) {
                await Store.addTask(window.currentUser.uid, title, date);
                window.showToast('Tarea agregada a la agenda');
                document.getElementById('task-title').value = '';
            }
        });
    }

    // Admin Agenda Filter Logic
    window.renderAdminAgenda = () => {
        const filterEl = document.getElementById('admin-agenda-filter');
        const dateEl = document.getElementById('admin-agenda-date');
        const resultsEl = document.getElementById('admin-agenda-results');
        if (!filterEl || !resultsEl) return;

        const selId = filterEl.value;
        const selDate = dateEl.value;
        if (!selId) {
            resultsEl.innerHTML = '<p class="empty-state">Selecciona un empleado para ver su agenda.</p>';
            return;
        }

        const allTasks = Store.data.tasks || [];
        let filtered = allTasks.filter(t => t.individualId === selId);
        if (selDate) {
            filtered = filtered.filter(t => t.date === selDate);
        }
        
        filtered.sort((a, b) => a.completed - b.completed || new Date(b.date) - new Date(a.date));

        if (filtered.length === 0) {
            resultsEl.innerHTML = '<p class="empty-state">No hay tareas para este filtro.</p>';
        } else {
            resultsEl.innerHTML = '<ul class="item-list task-list"></ul>';
            const ul = resultsEl.querySelector('ul');
            filtered.forEach(t => {
                const li = document.createElement('li');
                if(t.completed) li.classList.add('task-completed');
                const priorityBadge = t.priority ? `<span class="badge" style="margin-left: 0.5rem; background-color: ${t.priority==='1'?'#dc3545':t.priority==='2'?'#ffc107':'#28a745'}; color: ${t.priority==='2'?'#000':'#fff'}">P${t.priority}</span>` : '';
                li.innerHTML = `
                    <input type="checkbox" disabled ${t.completed ? 'checked' : ''}>
                    <span><strong>${t.title}</strong> ${priorityBadge} <small style="color:var(--text-muted);">(${t.date})</small></span>
                `;
                ul.appendChild(li);
            });
        }
    };

    // Admin Task Assignment
    const formAssignTask = document.getElementById('form-assign-task');
    if (formAssignTask) {
        document.getElementById('assign-task-date').valueAsDate = new Date();
        formAssignTask.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('assign-task-title').value.trim();
            const date = document.getElementById('assign-task-date').value;
            const priority = document.getElementById('assign-task-priority').value;
            
            const selectUsers = document.getElementById('assign-task-users');
            const selectedIds = Array.from(selectUsers.selectedOptions).map(opt => opt.value);

            if (selectedIds.length === 0) {
                window.showToast('Debes seleccionar al menos a un integrante', 'error');
                return;
            }

            if (title && date) {
                for (const uid of selectedIds) {
                    await Store.addTask(uid, title, date, priority);
                }
                window.showToast(`Tarea asignada a ${selectedIds.length} integrante(s)`);
                document.getElementById('assign-task-title').value = '';
            }
        });
    }

    const adminFilter = document.getElementById('admin-agenda-filter');
    const adminDate = document.getElementById('admin-agenda-date');
    if (adminFilter) adminFilter.addEventListener('change', window.renderAdminAgenda);
    if (adminDate) adminDate.addEventListener('change', window.renderAdminAgenda);

    // --- AIT Support Logic ---
    let currentAitPhotoBase64 = null;
    const aitPhotoInput = document.getElementById('ait-photo');
    const aitPhotoPreview = document.getElementById('ait-photo-preview');

    if (aitPhotoInput) {
        aitPhotoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    // Redimensionar para no exceder 800px de ancho/alto
                    const MAX_SIZE = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    currentAitPhotoBase64 = canvas.toDataURL('image/jpeg', 0.6); // 60% quality
                    if (aitPhotoPreview) {
                        aitPhotoPreview.src = currentAitPhotoBase64;
                        aitPhotoPreview.style.display = 'block';
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    const formAit = document.getElementById('form-ait');
    if (formAit) {
        formAit.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ticketData = {
                individualId: window.currentUser.uid,
                internName: window.currentUserName || 'Pasante',
                dateStr: new Date().toLocaleDateString('es-ES'),
                timeStr: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                location: document.getElementById('ait-location').value.trim(),
                client: document.getElementById('ait-client').value.trim(),
                activity: document.getElementById('ait-activity').value.trim(),
                tag: document.getElementById('ait-tag').value.trim(),
                brand: document.getElementById('ait-brand').value.trim(),
                model: document.getElementById('ait-model').value.trim(),
                type: document.getElementById('ait-type').value.trim(),
                pool: document.getElementById('ait-pool').value.trim(),
                indicator: document.getElementById('ait-indicator').value.trim(),
                email: document.getElementById('ait-email').value.trim(),
                management: document.getElementById('ait-management').value.trim(),
                business: document.getElementById('ait-business').value.trim(),
                support: document.getElementById('ait-support').value.trim(),
                photoBase64: currentAitPhotoBase64 // Guardamos la foto comprimida
            };

            await Store.addTicket(ticketData);
            window.showToast('Registro AIT guardado exitosamente');
            e.target.reset();
            currentAitPhotoBase64 = null;
            if (aitPhotoPreview) aitPhotoPreview.style.display = 'none';
        });
    }

    const btnGenerateAitPdf = document.getElementById('btn-generate-ait-pdf');
    if (btnGenerateAitPdf) {
        btnGenerateAitPdf.addEventListener('click', () => {
            const isAdmin = window.currentUserRole === 'admin';
            let targetUserId = window.currentUser.uid;
            let targetUserName = window.currentUserName || 'Pasante';

            if (isAdmin) {
                const adminUserFilter = document.getElementById('ait-admin-user-filter');
                if (!adminUserFilter.value) {
                    window.showToast('Por favor, selecciona un integrante primero.', 'error');
                    return;
                }
                targetUserId = adminUserFilter.value;
                targetUserName = adminUserFilter.options[adminUserFilter.selectedIndex].text;
            }

            const today = new Date().toLocaleDateString('es-ES');
            const allTickets = Store.data.it_tickets || [];
            const myTicketsToday = allTickets.filter(t => t.individualId === targetUserId && t.dateStr === today);

            if (myTicketsToday.length === 0) {
                window.showToast(`No hay registros de ${targetUserName} el día de hoy.`, 'error');
                return;
            }

            const container = document.getElementById('ait-pdf-container');
            container.innerHTML = `<h1 style="text-align: center; margin-bottom: 2rem;">Reporte Diario AIT - ${today}</h1>`;

            myTicketsToday.forEach((t, index) => {
                const ticketHtml = `
                    <div style="margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #ccc; font-size: 14px; line-height: 1.6;">
                        <div style="margin-bottom: 10px;">
                            📆 ${t.dateStr}<br>
                            🏢 ${t.location}<br>
                            ⏱️ ${t.timeStr}<br>
                            📝 ${t.client}
                        </div>
                        <div style="margin-bottom: 15px; font-weight: bold;">
                            ✅ ${t.activity}
                        </div>
                        <div>
                            Etiqueta: ${t.tag}<br>
                            Marca: ${t.brand}<br>
                            Modelo: ${t.model}<br>
                            Laptop/PC: ${t.type}<br>
                            Usuario/Pool: ${t.pool}<br>
                            Indicador: ${t.indicator}<br>
                            Correo: ${t.email}<br>
                            GERENCIA: ${t.management}<br>
                            Negocio: ${t.business}
                        </div>
                        <div style="margin-top: 15px;">
                            Pasante: ${t.internName}<br>
                            Asesoría y Apoyo: ${t.support}
                        </div>
                        ${t.photoBase64 ? `<div style="margin-top: 15px; text-align: center;"><img src="${t.photoBase64}" style="max-width: 100%; max-height: 300px; border: 1px solid #ccc; border-radius: 4px;"></div>` : ''}
                    </div>
                `;
                container.innerHTML += ticketHtml;
            });

            // Make container visible for rendering
            container.style.display = 'block';

            const opt = {
                margin:       10,
                filename:     `Reporte_AIT_${targetUserName}_${today.replace(/\\//g, '-')}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(opt).from(container).save().then(() => {
                container.style.display = 'none'; // hide it back
                window.showToast('PDF generado correctamente');
            });
        });
    }

    const btnGenerateAitWord = document.getElementById('btn-generate-ait-word');
    if (btnGenerateAitWord) {
        btnGenerateAitWord.addEventListener('click', () => {
            const isAdmin = window.currentUserRole === 'admin';
            let targetUserId = window.currentUser.uid;
            let targetUserName = window.currentUserName || 'Pasante';

            if (isAdmin) {
                const adminUserFilter = document.getElementById('ait-admin-user-filter');
                if (!adminUserFilter.value) {
                    window.showToast('Por favor, selecciona un integrante primero.', 'error');
                    return;
                }
                targetUserId = adminUserFilter.value;
                targetUserName = adminUserFilter.options[adminUserFilter.selectedIndex].text;
            }

            const todayObj = new Date();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(todayObj.getDate() - 7);

            const allTickets = Store.data.it_tickets || [];
            const myTicketsWeekly = allTickets.filter(t => {
                if (t.individualId !== targetUserId) return false;
                
                const parts = t.dateStr.split('/');
                if (parts.length !== 3) return false;
                
                const tDate = new Date(parts[2], parts[1] - 1, parts[0]);
                // Set to start of day for comparison
                tDate.setHours(0,0,0,0);
                const limitDate = new Date(sevenDaysAgo);
                limitDate.setHours(0,0,0,0);
                const maxDate = new Date(todayObj);
                maxDate.setHours(23,59,59,999);

                return tDate >= limitDate && tDate <= maxDate;
            });

            if (myTicketsWeekly.length === 0) {
                window.showToast(`No hay registros de ${targetUserName} en los últimos 7 días.`, 'error');
                return;
            }

            let wordHtml = `<h1 style="text-align: center; font-family: Arial;">Reporte Semanal AIT - ${targetUserName}</h1>`;
            wordHtml += `<p style="text-align: center; font-family: Arial;">Período: ${sevenDaysAgo.toLocaleDateString('es-ES')} al ${todayObj.toLocaleDateString('es-ES')}</p><hr>`;

            myTicketsWeekly.sort((a, b) => {
                const aParts = a.dateStr.split('/');
                const bParts = b.dateStr.split('/');
                const aDate = new Date(aParts[2], aParts[1]-1, aParts[0]);
                const bDate = new Date(bParts[2], bParts[1]-1, bParts[0]);
                return aDate - bDate;
            });

            myTicketsWeekly.forEach(t => {
                wordHtml += `
                    <div style="font-family: Arial; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 10px;">
                        <p><b>Fecha:</b> ${t.dateStr} | <b>Hora:</b> ${t.timeStr} | <b>Ubicación:</b> ${t.location}</p>
                        <p><b>Usuario/Cliente:</b> ${t.client} (<b>Indicador:</b> ${t.indicator})</p>
                        <p><b>Actividad:</b> ${t.activity}</p>
                        <p><b>Equipo:</b> ${t.type} ${t.brand} ${t.model} - <b>Etiqueta:</b> ${t.tag} - <b>Pool:</b> ${t.pool}</p>
                        <p><b>Gerencia/Negocio:</b> ${t.management} / ${t.business}</p>
                        <p><b>Asesoría:</b> ${t.support}</p>
                        ${t.photoBase64 ? `<p><img src="${t.photoBase64}" width="400"></p>` : ''}
                    </div>
                `;
            });

            // Empaquetar como archivo .doc
            const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Reporte Semanal</title></head><body>";
            const postHtml = "</body></html>";
            const fullHtml = preHtml + wordHtml + postHtml;

            const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
            const downloadLink = document.createElement("a");
            downloadLink.href = URL.createObjectURL(blob);
            downloadLink.download = `Reporte_Semanal_AIT_${targetUserName.replace(/ /g, '_')}.doc`;
            
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            window.showToast('Reporte Semanal (Word) descargado.');
        });
    }
});
