import * as Store from './store.js';

export function initReports() {
    const reportTypeSelect = document.getElementById('report-type');
    const reportTargetSelect = document.getElementById('report-target');
    const btnGenerate = document.getElementById('btn-generate-report');
    const btnDownloadPdf = document.getElementById('btn-download-pdf');
    const reportResults = document.getElementById('report-results');
    
    let productivityChart = null;

    // Listen to dataLoaded event dispatched by app.js when UI updates
    document.addEventListener('dataLoaded', () => {
        if(window.currentUserRole === 'admin') {
            updateReportTargets();
        }
    });

    function updateReportTargets() {
        const type = reportTypeSelect.value;
        reportTargetSelect.innerHTML = '<option value="" disabled selected>Selecciona un objetivo...</option>';

        if (type === 'individual') {
            const individuals = Store.data.individuals;
            individuals.forEach(ind => {
                const opt = document.createElement('option');
                opt.value = ind.id;
                opt.textContent = ind.name;
                reportTargetSelect.appendChild(opt);
            });
        } else if (type === 'group') {
            const groups = Store.data.groups;
            groups.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.name;
                reportTargetSelect.appendChild(opt);
            });
        }
    }

    function getBusinessDays(startDate, endDate) {
        let count = 0;
        let curDate = new Date(startDate);
        curDate.setHours(0,0,0,0);
        const end = new Date(endDate);
        end.setHours(0,0,0,0);

        if (curDate > end) return 0;

        while (curDate <= end) {
            const dayOfWeek = curDate.getDay();
            if(dayOfWeek !== 0 && dayOfWeek !== 6) count++;
            curDate.setDate(curDate.getDate() + 1);
        }
        return count;
    }

    reportTypeSelect.addEventListener('change', updateReportTargets);

    btnGenerate.addEventListener('click', () => {
        const type = reportTypeSelect.value;
        const targetId = reportTargetSelect.value;

        if (!targetId) {
            alert('Por favor selecciona un objetivo.');
            return;
        }

        const metrics = Store.data.metrics;
        let targetName = '';
        let validRecords = [];

        if (type === 'individual') {
            const ind = Store.data.individuals.find(i => i.id === targetId);
            if(ind) targetName = ind.name;
            validRecords = Store.data.records.filter(r => r.individualId === targetId);
        } else {
            const group = Store.data.groups.find(g => g.id === targetId);
            if(group) {
                targetName = group.name;
            }
            
            // Get all individuals in this group
            const groupInds = Store.data.individuals.filter(i => i.groupId === targetId).map(i => i.id);
            // Get records for all these individuals
            validRecords = Store.data.records.filter(r => groupInds.includes(r.individualId));
        }

        // Aggregate data
        const aggregated = {};
        metrics.forEach(m => aggregated[m.id] = 0);

        validRecords.forEach(r => {
            for (let mId in r.metrics) {
                if (aggregated[mId] !== undefined) {
                    aggregated[mId] += r.metrics[mId];
                }
            }
        });

        // Render
        renderReport(targetName, validRecords.length, aggregated, metrics, type, targetId, validRecords);
        btnDownloadPdf.style.display = 'block';
    });

    btnDownloadPdf.addEventListener('click', () => {
        const element = document.getElementById('report-results');
        const opt = {
            margin:       10,
            filename:     'Reporte_Productividad.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    });

    function renderReport(name, recordsCount, aggregatedData, metrics, type, targetId, validRecords) {
        let html = '';
        if (recordsCount === 0) {
            html += `<h3>Reporte: ${name}</h3><p class="empty-state mt-4">No hay registros de actividad para este periodo/objetivo.</p>`;
        } else {
            html += `
                <h3>Reporte de Productividad: ${name}</h3>
                <p style="margin-bottom: 1.5rem; color: var(--text-muted);">Total de registros analizados: <strong>${recordsCount}</strong></p>
                <div class="stats-grid">
            `;

            metrics.forEach(m => {
                const value = aggregatedData[m.id] || 0;
                const suffix = m.type === 'time' ? ' hrs' : '';
                html += `
                    <div class="stat-card">
                        <h3>${m.name}</h3>
                        <p>${value.toFixed(1)}${suffix}</p>
                    </div>
                `;
            });

            html += `</div>`;
            
            // Canvas container for Chart.js
            html += `
                <div style="margin-top: 2rem; background: var(--bg-surface); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);">
                    <h4 style="margin-bottom: 1rem;">Tendencia de Productividad Diaria</h4>
                    <canvas id="productivity-chart" style="width: 100%; max-height: 300px;"></canvas>
                </div>
            `;
        }
        
        // Projections Logic
        if (type === 'group') {
            const group = Store.getGroupById(targetId);
            if (group && group.targetAmount && group.targetMetricId && group.deadline) {
                const metricName = metrics.find(m => m.id === group.targetMetricId)?.name || 'Métrica';
                const currentProgress = aggregatedData[group.targetMetricId] || 0;
                const remainingAmount = group.targetAmount - currentProgress;
                
                const today = new Date();
                const businessDaysLeft = getBusinessDays(today, group.deadline);
                const totalPeople = Store.data.individuals.filter(i => i.groupId === targetId).length;

                if (remainingAmount <= 0) {
                    html += `<div style="padding: 1rem; margin-top: 2rem; border-radius: 8px; background: #e6f4ea; color: #137333; font-weight: bold; border-left: 4px solid #137333;">
                        ¡Felicidades! La meta de ${group.targetAmount} ${metricName} ha sido alcanzada.
                    </div>`;
                } else if (businessDaysLeft <= 0) {
                    html += `<div style="padding: 1rem; margin-top: 2rem; border-radius: 8px; background: #fce8e6; color: #c5221f; font-weight: bold; border-left: 4px solid #c5221f;">
                        La fecha límite ha pasado y faltaron ${remainingAmount.toFixed(1)} ${metricName}.
                    </div>`;
                } else if (totalPeople === 0) {
                    html += `<div style="padding: 1rem; margin-top: 2rem; border-radius: 8px; background: #fff8e1; color: #f29900; border-left: 4px solid #f29900;">
                        No hay individuos asignados a este grupo para calcular el ritmo de trabajo.
                    </div>`;
                } else {
                    const requiredDailyPerPerson = remainingAmount / businessDaysLeft / totalPeople;
                    html += `
                        <div style="background: var(--bg-surface); box-shadow: var(--shadow-sm); border: 1px solid var(--border-color); border-left: 4px solid var(--primary-color); padding: 1.5rem; border-radius: 8px; margin-top: 2rem;">
                            <h4 style="margin-bottom: 1rem; font-size: 1.2rem; color: var(--primary-color);">Dashboard Analítico y Proyección</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                                <div><small style="color: var(--text-muted);">Meta Total:</small><br><strong>${group.targetAmount}</strong> ${metricName}</div>
                                <div><small style="color: var(--text-muted);">Progreso Actual:</small><br><strong>${currentProgress.toFixed(1)}</strong> (Faltan ${remainingAmount.toFixed(1)})</div>
                                <div><small style="color: var(--text-muted);">Días Hábiles (L-V):</small><br><strong>${businessDaysLeft}</strong> días restantes</div>
                                <div><small style="color: var(--text-muted);">Individuos Activos:</small><br><strong>${totalPeople}</strong> personas</div>
                            </div>
                            <div style="padding: 1rem; background: rgba(230, 57, 70, 0.05); border-radius: 4px;">
                                <strong style="font-size: 1.1rem;">Ritmo Requerido:</strong><br>
                                Cada persona debe alcanzar un promedio de <span style="color: var(--primary-color); font-weight: 900; font-size: 1.4rem;">${requiredDailyPerPerson.toFixed(1)}</span> ${metricName} diarios para lograr la meta a tiempo.
                            </div>
                        </div>
                    `;
                }
            }
        }
        
        // Show notes
        const recordsWithNotes = validRecords.filter(r => r.notes && r.notes.trim() !== '');
        if (recordsWithNotes.length > 0) {
            html += `<div style="margin-top: 2rem;">
                        <h4>Detalles / Notas de Registros:</h4>
                        <ul class="item-list mt-4" style="text-align: left;">`;
            
            // Sort descending by date
            recordsWithNotes.sort((a,b) => new Date(b.date) - new Date(a.date));
            
            recordsWithNotes.forEach(r => {
                let indName = '';
                if (type === 'group') {
                   const ind = Store.data.individuals.find(i => i.id === r.individualId);
                   indName = ind ? `<strong style="color: var(--primary-color)">${ind.name}</strong> - ` : '';
                }
                html += `<li style="display: block; line-height: 1.4;">
                    <div style="padding: 0.5rem 0;">
                        <small style="color: var(--text-muted); font-weight: bold;">${r.date}</small><br>
                        ${indName}${r.notes.replace(/\n/g, '<br>')}
                    </div>
                </li>`;
            });
            html += `   </ul>
                     </div>`;
        }
        
        reportResults.innerHTML = html;

        // Draw Chart if there are records
        if (recordsCount > 0) {
            drawChart(validRecords, metrics);
        }
    }

    function drawChart(validRecords, metrics) {
        if (productivityChart) {
            productivityChart.destroy();
        }

        const ctx = document.getElementById('productivity-chart');
        if (!ctx) return;

        // Group by Date
        const groupedByDate = {};
        validRecords.forEach(r => {
            if (!groupedByDate[r.date]) {
                groupedByDate[r.date] = {};
                metrics.forEach(m => groupedByDate[r.date][m.id] = 0);
            }
            for (let mId in r.metrics) {
                if (groupedByDate[r.date][mId] !== undefined) {
                    groupedByDate[r.date][mId] += r.metrics[mId];
                }
            }
        });

        const sortedDates = Object.keys(groupedByDate).sort((a,b) => new Date(a) - new Date(b));
        
        // Prepare datasets (one per metric)
        const colors = ['#E63946', '#1D3557', '#2a9d8f', '#e9c46a', '#f4a261'];
        const datasets = metrics.map((m, i) => {
            return {
                label: m.name,
                data: sortedDates.map(date => groupedByDate[date][m.id]),
                backgroundColor: colors[i % colors.length],
                borderWidth: 0
            };
        });

        productivityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedDates,
                datasets: datasets
            },
            options: {
                responsive: true,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                }
            }
        });
    }
}
