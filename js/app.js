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

    // --- Sidebar Logic (Mobile & Desktop) ---
    const sidebar = document.getElementById('sidebar');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');

    function toggleSidebar() {
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
            sidebar.classList.toggle('open');
        }
        if (sidebarOverlay) {
            sidebarOverlay.classList.toggle('open');
        }
    }

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleSidebar);

        // --- Share AIT Ticket (Copiar/Compartir OS nativo) ---
        window.copyAIT = async (ticketId) => {
            const ticket = Store.data.it_tickets.find(t => t.id === ticketId);
            if (!ticket) return;

            const text = `📆 ${ticket.dateStr || ''}
🏢 ${ticket.location || ''}
⏱️ ${ticket.timeStr || ''}
📝 ${ticket.client || ''}

✅ ${ticket.activity || ''}

ETIQUETA: ${ticket.tag || ''}
MARCA: ${ticket.brand || ''}
MODELO: ${ticket.model || ''}
Pc/Laptop: ${ticket.type || ''}
USUARIO/POOL: ${ticket.pool || ''}
GERENCIA: ${ticket.management || ''}
INDICADOR: ${ticket.indicator || ''}
CORREO${ticket.email ? ticket.email : ''}
NEGOCIO: ${ticket.business || ''}
Asesoria y apoyo: ${ticket.support || ''}`;

            try {
                if (navigator.share) {
                    await navigator.share({
                        title: 'Reporte AIT',
                        text: text
                    });
                } else {
                    await navigator.clipboard.writeText(text);
                    window.showToast('Reporte copiado al portapapeles');
                }
            } catch (error) {
                console.error('Error sharing:', error);
                try {
                    await navigator.clipboard.writeText(text);
                    window.showToast('Reporte copiado al portapapeles');
                } catch (err) {
                    window.showToast('No se pudo compartir ni copiar el texto.', 'error');
                }
            }
        };

        // --- Compartir AIT (Interno app) ---
        window.openShareAitModal = (ticketId) => {
            let isMulti = false;
            try {
                const ids = JSON.parse(ticketId);
                if (Array.isArray(ids)) isMulti = true;
            } catch (e) {}

            if (!isMulti) {
                const ticket = Store.data.it_tickets.find(t => t.id === ticketId);
                if (!ticket) return;
            }
            
            document.getElementById('share-ait-ticket-id').value = ticketId;
            
            const select = document.getElementById('share-ait-coworker');
            select.innerHTML = '<option value="" disabled selected>Selecciona un compañero</option>';
            
            // Buscar miembros del mismo grupo
            const myInd = Store.data.individuals.find(i => i.id === window.currentUser.uid);
            if (myInd && myInd.groupId) {
                const groupMates = Store.data.individuals.filter(i => i.groupId === myInd.groupId && i.id !== myInd.id);
                groupMates.forEach(g => {
                    const opt = document.createElement('option');
                    opt.value = g.id;
                    opt.textContent = g.name;
                    select.appendChild(opt);
                });
            }
            
            window.openModal('modal-share-ait');
        };

        window.sendAitToCoworker = async () => {
            const ticketIdStr = document.getElementById('share-ait-ticket-id').value;
            const coworkerId = document.getElementById('share-ait-coworker').value;
            
            if (!ticketIdStr || !coworkerId) {
                window.showToast('Selecciona un compañero', 'error');
                return;
            }
            
            let idsToProcess = [];
            try {
                idsToProcess = JSON.parse(ticketIdStr);
            } catch(e) {
                idsToProcess = [ticketIdStr];
            }
            
            const senderName = window.currentUserName || 'Un compañero';
            const coworkerName = document.getElementById('share-ait-coworker').options[document.getElementById('share-ait-coworker').selectedIndex].text;
            const sharedNote = document.getElementById('share-ait-note') ? document.getElementById('share-ait-note').value.trim() : '';

            let processedCount = 0;

            for (const tId of idsToProcess) {
                const ticket = Store.data.it_tickets.find(t => t.id === tId);
                if (ticket) {
                    const clonedTicket = { 
                        ...ticket, 
                        individualId: coworkerId, 
                        timestamp: Date.now(),
                        status: 'pending',
                        senderName: senderName,
                        originalTicketId: ticket.id,
                        sharedNote: sharedNote
                    };
                    delete clonedTicket.id;
                    
                    try {
                        if (Store && Store.addTicket) {
                            await Store.addTicket(clonedTicket);
                            
                            // Update the original ticket
                            if (Store.updateTicket) {
                                await Store.updateTicket(ticket.id, { 
                                    sharedTo: coworkerName, 
                                    sharedStatus: 'pending' 
                                });
                                ticket.sharedTo = coworkerName;
                                ticket.sharedStatus = 'pending';
                            }
                            processedCount++;
                        }
                    } catch (e) {
                        console.error('Error enviando reporte:', e);
                    }
                }
            }
            
            if (processedCount > 0) {
                window.showToast(`Se enviaron ${processedCount} reporte(s) a tu compañero`);
                window.closeModal('modal-share-ait');
                
                // Deseleccionar los checkboxes si fue envío múltiple
                document.querySelectorAll('.ait-multi-select-checkbox').forEach(cb => cb.checked = false);
                window.handleAitMultiSelect();
            } else {
                window.showToast('No se pudo enviar los reportes', 'error');
            }
        };

        window.acceptAitTicket = async () => {
            const ticketIdsStr = document.getElementById('accept-ait-ticket-ids').value;
            if (!ticketIdsStr) return;
            
            try {
                const ids = JSON.parse(ticketIdsStr);
                for (const tId of ids) {
                    if (Store && Store.updateTicket) {
                        await Store.updateTicket(tId, { status: 'accepted' });
                        
                        const t = Store.data.it_tickets.find(x => x.id === tId);
                        if (t) {
                            t.status = 'accepted';
                            // Actualizar ticket original si existe
                            if (t.originalTicketId) {
                                await Store.updateTicket(t.originalTicketId, { sharedStatus: 'accepted' });
                            }
                        }
                    }
                }
                window.showToast(`${ids.length} reporte(s) aceptado(s) y guardado(s) en tu historial.`);
                window.closeModal('modal-accept-ait');
            } catch (e) {
                console.error(e);
                window.showToast('Error aceptando reportes', 'error');
            }
        };

        window.rejectAitTicket = async () => {
            const ticketIdsStr = document.getElementById('accept-ait-ticket-ids').value;
            if (!ticketIdsStr) return;
            
            try {
                const ids = JSON.parse(ticketIdsStr);
                for (const tId of ids) {
                    if (Store && Store.deleteTicket) {
                        const t = Store.data.it_tickets.find(x => x.id === tId);
                        if (t && t.originalTicketId && Store.updateTicket) {
                            // Notificar al emisor que fue rechazado
                            await Store.updateTicket(t.originalTicketId, { sharedStatus: 'rejected' });
                        }
                        await Store.deleteTicket(tId);
                    }
                }
                window.showToast(`${ids.length} reporte(s) rechazado(s) y eliminado(s).`);
                window.closeModal('modal-accept-ait');
            } catch (e) {
                console.error(e);
                window.showToast('Error rechazando reportes', 'error');
            }
        };

    // --- Modal Logic ---
    window.openNewAitModal = function() {
        const formAit = document.getElementById('form-ait');
        if (formAit) {
            formAit.reset();
            document.getElementById('ait-edit-id').value = '';
            if (document.getElementById('ait-date')) document.getElementById('ait-date').value = '';
            if (document.getElementById('ait-time')) document.getElementById('ait-time').value = '';
            if (document.getElementById('ait-quick-templates')) document.getElementById('ait-quick-templates').value = '';
            if (document.getElementById('smart-paste-text')) document.getElementById('smart-paste-text').value = '';
            const preview = document.getElementById('ait-photo-preview');
            if (preview) preview.style.display = 'none';
        }
        window.openModal('modal-ait');
    };

    window.openModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if(modal) {
            modal.classList.add('open');
            // Prevent body scroll on mobile when modal is open
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if(modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    };

    window.closeModalOnOutsideClick = function(event, modalId) {
        // If they click exactly on the backdrop (not inside modal-content)
        if (event.target.id === modalId) {
            window.closeModal(modalId);
        }
    };

    // Initialize Authentication
    initAuth();
    initReports();

    // --- Navigation Logic ---
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Ignorar enlaces externos
            if(btn.tagName === 'A' && btn.hasAttribute('href')) return;
            
            // Update buttons
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update views
            const targetId = btn.getAttribute('data-target');
            views.forEach(v => v.classList.remove('active'));
            const targetView = document.getElementById(targetId);
            if(targetView) targetView.classList.add('active');
            
            // Close sidebar on mobile
            if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open')) {
                toggleSidebar();
            }
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
            const logoImg = document.querySelector('.logo img');
            
            if (lowerName.includes('patricia') || lowerName.includes('patty') || lowerName.includes('ortiz')) {
                document.body.classList.add('theme-patty');
                if(logoImg) logoImg.src = 'logo.png';
            } else if (lowerName.includes('alex') || lowerName.includes('marquez')) {
                document.body.classList.add('theme-alexander');
                if(logoImg) logoImg.src = 'logo_dark.png';
            } else {
                if(logoImg) logoImg.src = 'logo.png';
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

        const normalizeDateStr = (dateStr) => {
            if (!dateStr) return '';
            // Reemplazar guiones por barras por si el OS usa formato con guiones
            const normalized = dateStr.replace(/-/g, '/');
            const parts = normalized.split('/');
            if (parts.length === 3) {
                let year = parts[2];
                if (year.length === 2) year = '20' + year; // Convertir 26 a 2026
                return `${parseInt(parts[0], 10)}/${parseInt(parts[1], 10)}/${year}`;
            }
            return normalized;
        };

        // --- Actualizar Dashboard Personal ---
        if (!isAdmin && window.currentUser) {
            const todayStr = normalizeDateStr(new Date().toLocaleDateString('es-ES'));
            const todayCount = it_tickets.filter(t => t.individualId === window.currentUser.uid && t.status !== 'pending' && normalizeDateStr(t.dateStr) === todayStr).length;
            
            // Calc current week count
            const curr = new Date();
            const first = curr.getDate() - curr.getDay() + 1; // Lunes
            const last = first + 6; // Domingo
            const firstDay = new Date(curr.setDate(first)).setHours(0,0,0,0);
            const lastDay = new Date(curr.setDate(last)).setHours(23,59,59,999);
            
            const weekCount = it_tickets.filter(t => {
                if (t.individualId !== window.currentUser.uid || t.status === 'pending') return false;
                // Usar normalizeDateStr para limpiar guiones y arreglar el año
                const normDate = normalizeDateStr(t.dateStr); 
                const parts = normDate.split('/');
                if (parts.length !== 3) return false;
                const tDate = new Date(parts[2], parts[1]-1, parts[0]).getTime();
                return tDate >= firstDay && tDate <= lastDay;
            }).length;

            const dashToday = document.getElementById('dashboard-today-count');
            const dashWeek = document.getElementById('dashboard-week-count');
            const dashBar = document.getElementById('dashboard-progress-bar');
            
            if (dashToday) dashToday.textContent = todayCount;
            if (dashWeek) dashWeek.textContent = weekCount;
            if (dashBar) {
                const goal = 15;
                let percent = (weekCount / goal) * 100;
                if (percent > 100) percent = 100;
                dashBar.style.width = `${percent}%`;
                if (percent >= 100) dashBar.style.backgroundColor = '#28a745'; // verde
                else dashBar.style.backgroundColor = 'var(--primary-color)'; // rojo/original
            }
        }

        // --- Check for pending AIT tickets (Inbox) ---
        if (!isAdmin && window.currentUser && window.currentUser.uid) {
            const pendingTickets = it_tickets.filter(t => t.individualId === window.currentUser.uid && t.status === 'pending');
            if (pendingTickets.length > 0) {
                // Collect all ticket IDs
                const ids = pendingTickets.map(t => t.id);
                document.getElementById('accept-ait-ticket-ids').value = JSON.stringify(ids);
                
                // Build dynamic message
                let uniqueSenders = [...new Set(pendingTickets.map(t => t.senderName || 'Un compañero'))];
                let sendersText = uniqueSenders.join(', ');
                
                const msgEl = document.getElementById('accept-ait-message');
                if (pendingTickets.length === 1) {
                    const t = pendingTickets[0];
                    msgEl.innerHTML = `<strong>${t.senderName || 'Un compañero'}</strong> te ha transferido un reporte AIT de <em>"${t.activity || 'actividad sin título'}"</em>.<br><br>¿Deseas agregarlo a tu historial?`;
                } else {
                    msgEl.innerHTML = `Tienes <strong>${pendingTickets.length} reportes nuevos</strong> de ${sendersText}.<br><br>¿Deseas agregarlos a tu historial?`;
                }
                
                const noteContainer = document.getElementById('accept-ait-note-container');
                const ticketsWithNotes = pendingTickets.filter(t => t.sharedNote);
                if (ticketsWithNotes.length > 0) {
                    let notesHtml = '';
                    ticketsWithNotes.forEach(t => {
                        notesHtml += `<div style="margin-bottom: 5px;"><strong>De ${t.senderName || 'Un compañero'}:</strong> "${t.sharedNote}"</div>`;
                    });
                    noteContainer.innerHTML = notesHtml;
                    noteContainer.style.display = 'block';
                } else {
                    noteContainer.style.display = 'none';
                }
                
                window.openModal('modal-accept-ait');
            }
        }

        // 8. AIT Support View updates
        const aitTodayCount = document.getElementById('ait-today-count');
        const listAitToday = document.getElementById('list-ait-today');
        const dateFilterInput = document.getElementById('ait-history-date-filter');
        
        let filterDateStr = '';
        if (dateFilterInput) {
            if (!dateFilterInput.value) {
                // Initialize with today's date if empty (YYYY-MM-DD)
                const todayObj = new Date();
                const year = todayObj.getFullYear();
                const month = String(todayObj.getMonth() + 1).padStart(2, '0');
                const day = String(todayObj.getDate()).padStart(2, '0');
                dateFilterInput.value = `${year}-${month}-${day}`;
            }
            // Convert YYYY-MM-DD to DD/MM/YYYY
            const parts = dateFilterInput.value.split('-');
            if (parts.length === 3) {
                filterDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }

        const searchInput = document.getElementById('ait-history-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        const targetDateStr = filterDateStr || new Date().toLocaleDateString('es-ES');
        const normTarget = normalizeDateStr(targetDateStr);
        let myTicketsToday = [];
        
        let baseTickets = [];
        if (!isAdmin) {
            baseTickets = it_tickets.filter(t => t.individualId === window.currentUser.uid && t.status !== 'pending');
        } else {
            baseTickets = it_tickets.filter(t => t.status !== 'pending');
        }

        if (searchTerm) {
            // Buscador Global activo: Ignorar fecha
            myTicketsToday = baseTickets.filter(t => 
                (t.client || '').toLowerCase().includes(searchTerm) ||
                (t.location || '').toLowerCase().includes(searchTerm) ||
                (t.tag || '').toLowerCase().includes(searchTerm) ||
                (t.activity || '').toLowerCase().includes(searchTerm)
            );
        } else {
            // Filtrar por fecha
            myTicketsToday = baseTickets.filter(t => normalizeDateStr(t.dateStr) === normTarget);
        }

        if (aitTodayCount) aitTodayCount.textContent = `${myTicketsToday.length} Registros Mostrados`;

        if (listAitToday) {
            listAitToday.innerHTML = '';
            if (myTicketsToday.length === 0) {
                listAitToday.innerHTML = '<p class="empty-state">No tienes registros AIT hoy.</p>';
            } else {
                myTicketsToday.forEach((t, index) => {
                    const li = document.createElement('li');
                    li.classList.add('fade-in'); // <--- ANIMATION ADDED HERE
                    li.style.animationDelay = `${index * 0.05}s`;
                    li.style.display = 'flex';
                    li.style.flexDirection = 'column';
                    li.style.gap = '0.5rem';
                    li.style.padding = '1rem';
                    li.style.backgroundColor = 'var(--bg-main)';
                    li.style.borderRadius = 'var(--radius-md)';
                    li.style.marginBottom = '0.5rem';
                    li.style.border = '1px solid var(--border-color)';
                    
                    let shareBadge = '';
                    if (t.sharedTo && t.sharedStatus) {
                        let badgeColor = '#ffc107'; // pending (amarillo)
                        let badgeText = `⏳ Enviado a ${t.sharedTo} (En espera)`;
                        if (t.sharedStatus === 'accepted') {
                            badgeColor = '#28a745'; // verde
                            badgeText = `✅ Aceptado por ${t.sharedTo}`;
                        } else if (t.sharedStatus === 'rejected') {
                            badgeColor = '#dc3545'; // rojo
                            badgeText = `❌ Rechazado por ${t.sharedTo}`;
                        }
                        shareBadge = `<div style="font-size: 0.8rem; margin-top: 0.5rem; padding: 0.25rem 0.5rem; background-color: ${badgeColor}; color: ${badgeColor === '#ffc107' ? '#000' : '#fff'}; border-radius: 4px; display: inline-block;">${badgeText}</div>`;
                    }

                    // Helper for highlighting text
                    const highlight = (text, term) => {
                        if (!term) return text;
                        const regex = new RegExp(`(${term})`, 'gi');
                        return String(text).replace(regex, '<span class="highlighted-text">$1</span>');
                    };

                    li.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
                                <input type="checkbox" class="ait-multi-select-checkbox" value="${t.id}" onchange="window.handleAitMultiSelect()" style="margin-top: 0.3rem; transform: scale(1.2);">
                                <div>
                                    <strong style="color: var(--primary-color);">🏢 ${highlight(t.location, searchTerm)}</strong>
                                    <div style="font-size: 0.9rem;">📝 ${highlight(t.client, searchTerm)}</div>
                                    <div style="font-size: 0.9rem; margin-top: 0.25rem;">✅ ${highlight(t.activity, searchTerm)}</div>
                                    ${shareBadge}
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                            <button class="btn btn-secondary" onclick="window.copyAIT('${t.id}')" style="padding: 0.25rem; font-size: 0.8rem; flex: 1;">📋 Copiar</button>
                            <button class="btn btn-primary" onclick="window.openShareAitModal('${t.id}')" style="padding: 0.25rem; font-size: 0.8rem; flex: 1;">📲 Enviar</button>
                            <button class="btn btn-secondary" onclick="window.editAitTicket('${t.id}')" style="padding: 0.25rem; font-size: 0.8rem; flex: 1; background-color: #ffc107; color: #000;">✏️ Editar</button>
                            <button class="btn btn-secondary" onclick="window.deleteAitTicket('${t.id}')" style="padding: 0.25rem; font-size: 0.8rem; flex: 1; background-color: #dc3545; color: #fff;">🗑️ Borrar</button>
                        </div>
                    `;
                    listAitToday.appendChild(li);
                });
            }
        }
        
        // Report targets update is in reports.js, we will dispatch an event to let it know
        document.dispatchEvent(new Event('dataLoaded'));
        
        // Reset multi-share button
        window.handleAitMultiSelect();
    }
    
    // Multi-Select Logic
    window.handleAitMultiSelect = () => {
        const checkboxes = document.querySelectorAll('.ait-multi-select-checkbox:checked');
        const container = document.getElementById('ait-multi-share-container');
        const countSpan = document.getElementById('ait-multi-share-count');
        if (!container || !countSpan) return;
        
        if (checkboxes.length > 0) {
            container.style.display = 'flex';
            countSpan.textContent = `${checkboxes.length} Seleccionado${checkboxes.length !== 1 ? 's' : ''}`;
        } else {
            container.style.display = 'none';
        }
    };
    
    window.openShareAitModalMultiple = () => {
        const checkboxes = document.querySelectorAll('.ait-multi-select-checkbox:checked');
        const ids = Array.from(checkboxes).map(cb => cb.value);
        if (ids.length === 0) return;
        
        window.openShareAitModal(JSON.stringify(ids));
    };
    
    // Exponer al scope global para los onchange/oninput del HTML
    window.updateUI = updateUI;

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
                window.closeModal('modal-add-task');
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
                window.closeModal('modal-assign-task');
            }
        });
    }

    const adminFilter = document.getElementById('admin-agenda-filter');
    const adminDate = document.getElementById('admin-agenda-date');
    if (adminFilter) adminFilter.addEventListener('change', window.renderAdminAgenda);
    if (adminDate) adminDate.addEventListener('change', window.renderAdminAgenda);

    // --- AIT Support Logic ---
    const btnSmartPaste = document.getElementById('btn-smart-paste');
    if (btnSmartPaste) {
        btnSmartPaste.addEventListener('click', async () => {
            const text = document.getElementById('smart-paste-text').value;
            if (!text) return;

            // Función heurística para separar múltiples reportes
            function splitIntoReports(fullText) {
                // 1. Intentar dividir por emoji de calendario o "Fecha" al inicio de línea
                let blocks = fullText.split(/(?=📆|^Fecha:)/im).map(s => s.trim()).filter(s => s.length > 30);
                // Validar que cada bloque parezca un reporte (tenga ubicación o cliente)
                if (blocks.length > 1 && blocks.every(b => /(?:🏢|Localidad|Edificio|Sede|📝|Usuario|Cliente)/i.test(b))) {
                    return blocks;
                }
                
                // 2. Intentar dividir por emoji de edificio o "Localidad/Sede" al inicio de línea
                blocks = fullText.split(/(?=🏢|^Localidad|^Edificio|^Sede)/im).map(s => s.trim()).filter(s => s.length > 30);
                if (blocks.length > 1 && blocks.every(b => /(?:📝|Usuario|Cliente|✅|Actividad)/i.test(b))) {
                    return blocks;
                }
                
                // 3. Fallback: Separador explícito como "---" o múltiples saltos de línea largos
                blocks = fullText.split(/(?:---|___|\n\s*\n\s*\n)/).map(s => s.trim()).filter(s => s.length > 50);
                if (blocks.length > 1) return blocks;
                
                return [fullText.trim()];
            }

            const reportBlocks = splitIntoReports(text);

            const patterns = [
                { id: 'ait-location', regex: /(?:🏢|Localidad|Edificio|Sede)[:\s]*([^\n]+)/i },
                { id: 'ait-client', regex: /(?:📝|Usuario|Cliente|Nombre)[:\s]*([^\n]+)/i },
                { id: 'ait-activity', regex: /(?:✅|Actividad|Falla|Realizado)[:\s]*([^\n]+)/i },
                { id: 'ait-tag', regex: /ETIQUETA[:\s]*([^\n]+)/i },
                { id: 'ait-brand', regex: /MARCA[:\s]*([^\n]+)/i },
                { id: 'ait-model', regex: /MODELO[:\s]*([^\n]+)/i },
                { id: 'ait-type', regex: /P[cC]\/Laptop[:\s]*([^\n]+)/i },
                { id: 'ait-pool', regex: /USUARIO\/POOL[:\s]*([^\n]*)/i },
                { id: 'ait-indicator', regex: /INDICADOR[:\s]*([^\n]+)/i },
                { id: 'ait-email', regex: /CORREO[:\s]*([^\n]+)/i },
                { id: 'ait-management', regex: /GERENCIA[:\s]*([^\n]+)/i },
                { id: 'ait-business', regex: /NEGOCIO[:\s]*([^\n]+)/i },
                { id: 'ait-support', regex: /Asesoria y apoyo[:\s]*([^\n]+)/i }
            ];

            if (reportBlocks.length === 1) {
                // Flujo Normal: 1 solo reporte
                let foundCount = 0;
                patterns.forEach(p => {
                    const match = reportBlocks[0].match(p.regex);
                    if (match && match[1]) {
                        const val = match[1].trim();
                        const input = document.getElementById(p.id);
                        if (input) {
                            input.value = val;
                            foundCount++;
                        }
                    }
                });

                if (foundCount > 0) {
                    // Buscar si hay fecha en este único bloque
                    const singleDateMatch = reportBlocks[0].match(/(?:📆|^Fecha|Fecha:)[:\s]*([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/im);
                    if (singleDateMatch && singleDateMatch[1] && document.getElementById('ait-date')) {
                        document.getElementById('ait-date').value = singleDateMatch[1].replace(/-/g, '/');
                    }
                    // Buscar si hay hora (Cualquier formato HH:MM am/pm)
                    const singleTimeMatch = reportBlocks[0].match(/([0-9]{1,2}:[0-9]{2}(?:\s*(?:AM|PM|am|pm))?)/i);
                    if (singleTimeMatch && singleTimeMatch[1] && document.getElementById('ait-time')) {
                        document.getElementById('ait-time').value = singleTimeMatch[1].trim();
                    }

                    window.showToast(`Se han autocompletado ${foundCount} campos.`);
                    document.getElementById('smart-paste-container').style.display = 'none';
                    document.getElementById('smart-paste-text').value = '';
                } else {
                    window.showToast('No se encontró información reconocible.', 'error');
                }
            } else {
                // Flujo Batch: Múltiples reportes
                if (!confirm(`Se han detectado ${reportBlocks.length} reportes en el texto. ¿Deseas guardarlos todos automáticamente en tu historial?`)) {
                    return;
                }

                let savedCount = 0;
                for (const block of reportBlocks) {
                    const ticketData = {
                        individualId: window.currentUser.uid,
                        internName: window.currentUserName || 'Pasante',
                        dateStr: new Date().toLocaleDateString('es-ES'),
                        timeStr: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                        location: '', client: '', activity: '', tag: '', brand: '', model: '',
                        type: '', pool: '', indicator: '', email: '', management: '', business: '', support: '',
                        photoBase64: null
                    };

                    patterns.forEach(p => {
                        const match = block.match(p.regex);
                        if (match && match[1]) {
                            const key = p.id.replace('ait-', '');
                            if (ticketData.hasOwnProperty(key)) {
                                ticketData[key] = match[1].trim();
                            }
                        }
                    });
                    
                    // Extraer fecha si existe en el bloque
                    const dateMatch = block.match(/(?:📆|^Fecha|Fecha:)[:\s]*([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/im);
                    if (dateMatch && dateMatch[1]) {
                        ticketData.dateStr = dateMatch[1].replace(/-/g, '/');
                    }
                    
                    // Extraer hora si existe en el bloque
                    const timeMatch = block.match(/([0-9]{1,2}:[0-9]{2}(?:\s*(?:AM|PM|am|pm))?)/i);
                    if (timeMatch && timeMatch[1]) {
                        ticketData.timeStr = timeMatch[1].trim();
                    }
                    
                    // Si al menos extrajo el cliente o la localidad, lo consideramos válido
                    if (ticketData.client || ticketData.location || ticketData.activity) {
                        if (Store && Store.addTicket) {
                            await Store.addTicket(ticketData);
                            savedCount++;
                        }
                    }
                }

                window.showToast(`🪄 Pegado Inteligente: Se han guardado ${savedCount} reportes automáticamente.`);
                document.getElementById('smart-paste-container').style.display = 'none';
                document.getElementById('smart-paste-text').value = '';
                window.closeModal('modal-ait');
            }
        });
    }
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

    const quickTemplates = document.getElementById('ait-quick-templates');
    if (quickTemplates) {
        quickTemplates.addEventListener('change', (e) => {
            const val = e.target.value;
            if (!val) return;
            
            const templates = {
                'mantenimiento': {
                    activity: 'Mantenimiento Preventivo (Limpieza física y lógica, optimización de sistema)',
                    type: 'PC/Laptop',
                    support: 'Revisión general de hardware y limpieza de temporales',
                    tag: 'N/A'
                },
                'formateo': {
                    activity: 'Respado de data, Formateo e Instalación de Sistema Operativo',
                    type: 'PC/Laptop',
                    support: 'Instalación de SO, Office, Antivirus y utilitarios básicos',
                    tag: 'N/A'
                },
                'red': {
                    activity: 'Revisión y configuración de punto de red / Conectividad',
                    type: 'Redes',
                    support: 'Verificación de cableado UTP, conectores RJ45 y switch',
                    tag: 'N/A'
                },
                'impresora': {
                    activity: 'Instalación y configuración de impresora',
                    type: 'Impresora',
                    support: 'Configuración de drivers y prueba de impresión',
                    tag: 'N/A'
                },
                'respaldo': {
                    activity: 'Respaldo de información de usuario (Backup)',
                    type: 'PC/Laptop',
                    support: 'Copia de seguridad de PST, Documentos, Escritorio',
                    tag: 'N/A'
                }
            };
            
            const tpl = templates[val];
            if (tpl) {
                if (document.getElementById('ait-activity')) document.getElementById('ait-activity').value = tpl.activity;
                if (document.getElementById('ait-type')) document.getElementById('ait-type').value = tpl.type;
                if (document.getElementById('ait-support')) document.getElementById('ait-support').value = tpl.support;
                if (document.getElementById('ait-tag') && !document.getElementById('ait-tag').value) document.getElementById('ait-tag').value = tpl.tag;
                window.showToast('Plantilla aplicada. Completa los datos restantes.');
            }
        });
    }

    const formAit = document.getElementById('form-ait');
    if (formAit) {
        formAit.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!confirm('¿Estás seguro de registrar este reporte con los datos ingresados? Verifica que todo esté correcto.')) {
                return;
            }

            const editId = document.getElementById('ait-edit-id').value;

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
                support: document.getElementById('ait-support').value.trim()
            };
            
            // Only update photo if a new one was provided
            if (currentAitPhotoBase64) {
                ticketData.photoBase64 = currentAitPhotoBase64;
            }

            if (editId) {
                if (Store && Store.updateTicket) {
                    await Store.updateTicket(editId, ticketData);
                    window.showToast('Registro AIT actualizado exitosamente');
                }
            } else {
                if (Store && Store.addTicket) {
                    // Usar la fecha extraída si existe, si no, usar la actual
                    const extractedDate = document.getElementById('ait-date') ? document.getElementById('ait-date').value : '';
                    const extractedTime = document.getElementById('ait-time') ? document.getElementById('ait-time').value : '';
                    
                    ticketData.dateStr = extractedDate || new Date().toLocaleDateString('es-ES');
                    ticketData.timeStr = extractedTime || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    
                    await Store.addTicket(ticketData);
                    window.showToast('Registro AIT guardado exitosamente');
                }
            }
            
            e.target.reset();
            document.getElementById('ait-edit-id').value = '';
            if (document.getElementById('ait-date')) document.getElementById('ait-date').value = '';
            if (document.getElementById('ait-time')) document.getElementById('ait-time').value = '';
            if (document.getElementById('ait-quick-templates')) document.getElementById('ait-quick-templates').value = '';
            if (document.getElementById('smart-paste-text')) document.getElementById('smart-paste-text').value = '';
            currentAitPhotoBase64 = null;
            if (aitPhotoPreview) aitPhotoPreview.style.display = 'none';
            window.closeModal('modal-ait');
        });
    }

    // CRUD Funciones
    window.editAitTicket = (id) => {
        const ticket = Store.data.it_tickets.find(t => t.id === id);
        if (!ticket) return;

        document.getElementById('ait-edit-id').value = ticket.id;
        document.getElementById('ait-location').value = ticket.location || '';
        document.getElementById('ait-client').value = ticket.client || '';
        document.getElementById('ait-activity').value = ticket.activity || '';
        document.getElementById('ait-tag').value = ticket.tag || '';
        document.getElementById('ait-brand').value = ticket.brand || '';
        document.getElementById('ait-model').value = ticket.model || '';
        document.getElementById('ait-type').value = ticket.type || '';
        document.getElementById('ait-pool').value = ticket.pool || '';
        document.getElementById('ait-indicator').value = ticket.indicator || '';
        document.getElementById('ait-email').value = ticket.email || '';
        document.getElementById('ait-management').value = ticket.management || '';
        document.getElementById('ait-business').value = ticket.business || '';
        document.getElementById('ait-support').value = ticket.support || '';
        
        currentAitPhotoBase64 = ticket.photoBase64 || null;
        if (aitPhotoPreview) {
            if (ticket.photoBase64) {
                aitPhotoPreview.src = ticket.photoBase64;
                aitPhotoPreview.style.display = 'block';
            } else {
                aitPhotoPreview.style.display = 'none';
            }
        }

        window.closeModal('modal-ait-history');
        window.openModal('modal-ait');
    };

    window.deleteAitTicket = async (id) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este reporte de forma permanente?')) {
            return;
        }
        try {
            if (Store && Store.deleteTicket) {
                await Store.deleteTicket(id);
                window.showToast('Reporte eliminado exitosamente');
            }
        } catch (e) {
            console.error('Error eliminando reporte:', e);
            window.showToast('Error al eliminar el reporte', 'error');
        }
    };

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

            let pdfHtml = `<div style="padding: 20px 40px; background: white; color: #333; font-family: 'Helvetica', Arial, sans-serif; width: 800px; max-width: 100%;">`;
            pdfHtml += `
                <div style="border-bottom: 3px solid #dc3545; padding-bottom: 15px; margin-bottom: 30px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="vertical-align: bottom;">
                                <h1 style="margin: 0; color: #dc3545; font-size: 24px; font-weight: 800; text-transform: uppercase;">Reporte Técnico Diario</h1>
                                <h3 style="margin: 5px 0 0 0; color: #555; font-size: 16px; font-weight: 400;">Soporte de Infraestructura AIT</h3>
                            </td>
                            <td style="text-align: right; vertical-align: bottom; font-size: 14px; color: #666; line-height: 1.5;">
                                <strong>Analista:</strong> ${targetUserName}<br>
                                <strong>Fecha:</strong> ${today}
                            </td>
                        </tr>
                    </table>
                </div>
            `;

            myTicketsToday.forEach((t, index) => {
                pdfHtml += `
                    <div style="margin-bottom: 25px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; page-break-inside: avoid; word-break: break-word;">
                        <div style="background-color: #f8f9fa; padding: 10px 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #333;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="text-align: left; font-size: 15px;">📋 Ticket #${String(index + 1).padStart(2, '0')}</td>
                                    <td style="text-align: right; font-size: 13px; color: #666;">⏱️ ${t.timeStr}</td>
                                </tr>
                            </table>
                        </div>
                        <div style="padding: 15px;">
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px;">
                                <tr>
                                    <td style="padding: 6px; width: 20%; color: #777;"><strong>🏢 Ubicación:</strong></td>
                                    <td style="padding: 6px; width: 30%; border-right: 1px solid #eee;">${t.location}</td>
                                    <td style="padding: 6px; width: 20%; color: #777; padding-left: 15px;"><strong>📝 Cliente:</strong></td>
                                    <td style="padding: 6px; width: 30%;">${t.client}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px; color: #777;"><strong>💻 Equipo:</strong></td>
                                    <td style="padding: 6px; border-right: 1px solid #eee;">${t.type} ${t.brand} ${t.model}</td>
                                    <td style="padding: 6px; color: #777; padding-left: 15px;"><strong>🔖 Etiqueta:</strong></td>
                                    <td style="padding: 6px;">${t.tag} (Pool: ${t.pool})</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px; color: #777;"><strong>📊 Gerencia:</strong></td>
                                    <td style="padding: 6px; border-right: 1px solid #eee;">${t.management} / ${t.business}</td>
                                    <td style="padding: 6px; color: #777; padding-left: 15px;"><strong>✉️ Contacto:</strong></td>
                                    <td style="padding: 6px;">${t.email} (Ind: ${t.indicator})</td>
                                </tr>
                            </table>
                            
                            <div style="margin-bottom: 15px;">
                                <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">✅ Actividad Realizada</div>
                                <div style="background-color: #f1f8ff; padding: 12px; border-left: 4px solid #0056b3; font-size: 14px; border-radius: 0 4px 4px 0; color: #222; word-break: break-word;">
                                    ${t.activity}
                                </div>
                            </div>
                            
                            <div>
                                <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">💡 Asesoría y Apoyo</div>
                                <div style="background-color: #fff9e6; padding: 12px; border-left: 4px solid #ffc107; font-size: 14px; border-radius: 0 4px 4px 0; color: #222; word-break: break-word;">
                                    ${t.support || 'N/A'}
                                </div>
                            </div>
                            
                            ${t.photoBase64 ? `<div style="margin-top: 15px; text-align: center;"><img src="${t.photoBase64}" style="max-width: 100%; max-height: 250px; border-radius: 6px; border: 1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>` : ''}
                        </div>
                    </div>
                `;
            });
            pdfHtml += `</div>`;

            const opt = {
                margin:       10,
                filename:     `Reporte_AIT_${targetUserName}_${today.replace(/\//g, '-')}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(opt).from(pdfHtml).save().then(() => {
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

            let wordHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
                    <h1 style="text-align: center; color: #2b579a; font-size: 24px; text-transform: uppercase; margin-bottom: 5px;">Reporte Semanal AIT</h1>
                    <h3 style="text-align: center; color: #444; font-size: 16px; margin-top: 0;">Analista: ${targetUserName}</h3>
                    <p style="text-align: center; color: #666; font-size: 14px; margin-bottom: 20px;">
                        <strong>Período:</strong> ${sevenDaysAgo.toLocaleDateString('es-ES')} al ${todayObj.toLocaleDateString('es-ES')}
                    </p>
                    <hr style="border: 0; border-top: 2px solid #2b579a; margin-bottom: 30px;">
            `;

            myTicketsWeekly.sort((a, b) => {
                const aParts = a.dateStr.split('/');
                const bParts = b.dateStr.split('/');
                const aDate = new Date(aParts[2], aParts[1]-1, aParts[0]);
                const bDate = new Date(bParts[2], bParts[1]-1, bParts[0]);
                return aDate - bDate;
            });

            myTicketsWeekly.forEach((t, index) => {
                wordHtml += `
                    <div style="margin-bottom: 25px; border: 1px solid #ccc; padding: 15px; border-radius: 5px; background-color: #fafafa; word-break: break-word; page-break-inside: avoid;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px;">
                            <tr>
                                <td style="width: 25%; color: #555;"><b>📅 Fecha:</b> ${t.dateStr}</td>
                                <td style="width: 25%; color: #555;"><b>⏱️ Hora:</b> ${t.timeStr}</td>
                                <td style="width: 50%; color: #555; word-break: break-word;"><b>🏢 Ubicación:</b> ${t.location}</td>
                            </tr>
                        </table>
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px; background-color: #fff; border: 1px solid #eee;">
                            <tr>
                                <td style="width: 50%; padding: 5px; border-right: 1px solid #eee; word-break: break-word;"><b>📝 Cliente:</b> ${t.client}</td>
                                <td style="width: 50%; padding: 5px; word-break: break-word;"><b>💻 Equipo:</b> ${t.type} ${t.brand} ${t.model} (Tag: ${t.tag})</td>
                            </tr>
                            <tr>
                                <td style="width: 50%; padding: 5px; border-right: 1px solid #eee; word-break: break-word;"><b>📊 Gerencia:</b> ${t.management} / ${t.business}</td>
                                <td style="width: 50%; padding: 5px; word-break: break-word;"><b>👥 Pool:</b> ${t.pool} | <b>Ind:</b> ${t.indicator}</td>
                            </tr>
                        </table>
                        
                        <div style="background-color: #e9f2ff; padding: 10px; margin-bottom: 10px; border-left: 3px solid #2b579a; word-break: break-word;">
                            <p style="margin: 0; font-size: 13px;"><b>✅ Actividad:</b> ${t.activity}</p>
                        </div>
                        <div style="background-color: #fffde7; padding: 10px; border-left: 3px solid #fbc02d; word-break: break-word;">
                            <p style="margin: 0; font-size: 13px;"><b>💡 Asesoría:</b> ${t.support || 'N/A'}</p>
                        </div>
                        ${t.photoBase64 ? `<p style="color: #888; font-size: 11px; text-align: center; margin-top: 10px;"><i>[📸 Contiene evidencia fotográfica en el sistema]</i></p>` : ''}
                    </div>
                `;
            });
            wordHtml += `</div>`;

            // Empaquetar como archivo .doc
            const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Reporte Semanal</title></head><body>";
            const postHtml = "</body></html>";
            const fullHtml = preHtml + wordHtml + postHtml;

            // Cambiamos el mime-type para mejor compatibilidad con Word y quitamos las imagenes base64 que lo corrompen
            const blob = new Blob(['\ufeff', fullHtml], { type: 'application/vnd.ms-word;charset=utf-8' });
            const downloadLink = document.createElement("a");
            downloadLink.href = URL.createObjectURL(blob);
            downloadLink.download = `Reporte_Semanal_AIT_${targetUserName.replace(/ /g, '_')}.doc`;
            
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            window.showToast('Reporte Semanal (Word) descargado.');
        });
    }

    const btnExportCsv = document.getElementById('btn-export-csv');
    if (btnExportCsv) {
        btnExportCsv.addEventListener('click', () => {
            const listEl = document.getElementById('list-ait-today');
            if (!listEl) return;
            
            // Re-evaluar los tickets mostrados actualmente (se basan en la búsqueda/fecha de updateUI)
            const searchInput = document.getElementById('ait-history-search');
            const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
            
            const dateFilterInput = document.getElementById('ait-history-date-filter');
            let filterDateStr = '';
            if (dateFilterInput && dateFilterInput.value) {
                const parts = dateFilterInput.value.split('-');
                if (parts.length === 3) filterDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }

            const normalizeDateStr = (dateStr) => {
                if (!dateStr) return '';
                const parts = dateStr.split('/');
                if (parts.length === 3) return `${parseInt(parts[0], 10)}/${parseInt(parts[1], 10)}/${parts[2]}`;
                return dateStr;
            };

            const normTarget = normalizeDateStr(filterDateStr || new Date().toLocaleDateString('es-ES'));
            
            let exportTickets = [];
            const allT = Store.data.it_tickets || [];
            
            if (searchTerm) {
                exportTickets = allT.filter(t => t.individualId === window.currentUser.uid && t.status !== 'pending' && (
                    (t.client || '').toLowerCase().includes(searchTerm) ||
                    (t.location || '').toLowerCase().includes(searchTerm) ||
                    (t.tag || '').toLowerCase().includes(searchTerm) ||
                    (t.activity || '').toLowerCase().includes(searchTerm)
                ));
            } else {
                exportTickets = allT.filter(t => t.individualId === window.currentUser.uid && t.status !== 'pending' && normalizeDateStr(t.dateStr) === normTarget);
            }

            if (exportTickets.length === 0) {
                window.showToast('No hay datos para exportar.', 'error');
                return;
            }

            // Crear CSV
            const headers = ['Fecha', 'Hora', 'Localidad', 'Cliente', 'Actividad', 'Etiqueta', 'Marca', 'Modelo', 'Tipo', 'Pool', 'Indicador', 'Correo', 'Gerencia', 'Negocio', 'Apoyo'];
            let csvContent = headers.join(',') + '\n';

            exportTickets.forEach(t => {
                const row = [
                    t.dateStr, t.timeStr, t.location, t.client, t.activity, t.tag, t.brand, t.model, t.type, t.pool, t.indicator, t.email, t.management, t.business, t.support
                ].map(val => {
                    let str = String(val || '').replace(/"/g, '""'); // Escape comillas
                    return `"${str}"`; // Envolver en comillas por si hay comas
                });
                csvContent += row.join(',') + '\n';
            });

            const blob = new Blob(['\ufeff', csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Exportacion_AIT_${new Date().getTime()}.csv`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.showToast('Archivo CSV exportado exitosamente.');
        });
    }
});
