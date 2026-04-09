/**
 * FTC Team History - Live Split-Screen Dashboard
 * Isolated column architecture. Every column fetches, charts, and filtering is scoped locally.
 */

const FTCSCOUT_URL = 'https://api.ftcscout.org/graphql';

const dashboardsContainer = document.getElementById('dashboardsContainer');
const dashboardTemplate = document.getElementById('dashboardTemplate');

let columnCounter = 0;
// Maps columnId => { uqId, chartMulti, chartProg, teamData, element }
const activeColumns = {};

// Initialize one column on load
document.addEventListener('DOMContentLoaded', () => {
    addColumn();
});

/** ─── COLUMN LIFECYCLE ─── */
function addColumn() {
    columnCounter++;
    const colId = `col_${columnCounter}`;
    
    // Clone template
    const clone = dashboardTemplate.content.cloneNode(true);
    const colElement = clone.querySelector('.dashboard-column');
    colElement.id = colId;
    
    // Binding local UI nodes
    const input = colElement.querySelector('.tmpl-searchInput');
    const removeBtn = colElement.querySelector('.tmpl-removeBtn');
    const addBtn = colElement.querySelector('.tmpl-addBtn');
    const seasonSelect = colElement.querySelector('.tmpl-seasonFilter');
    
    // Give canvases IDs specific to this column slot (so charts don't overwrite if team changes)
    colElement.querySelector('.tmpl-multiYearChart').id = `multi_${colId}`;
    colElement.querySelector('.tmpl-progressionChart').id = `prog_${colId}`;

    // Hide remove button if it's the only column
    if (Object.keys(activeColumns).length === 0) {
        // We're adding the first column, keep remove hidden until others are added
        removeBtn.style.display = 'none';
    } else {
        // Ensure the first column's remove button is visible since there are multiple
        Object.values(activeColumns).forEach(c => {
            const btn = c.element.querySelector('.tmpl-removeBtn');
            if(btn) btn.style.display = 'flex';
        });
    }

    // Register active column metadata
    activeColumns[colId] = {
        id: colId,
        element: colElement,
        chartMulti: null,
        chartProg: null,
        teamData: null
    };

    // Attach Event Listeners
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const teamNum = input.value.trim();
            if (teamNum) analyzeColumn(colId, teamNum);
        }
    });

    removeBtn.addEventListener('click', () => {
        destroyColumn(colId);
    });

    seasonSelect.addEventListener('change', () => {
        const colState = activeColumns[colId];
        if (colState.teamData) {
            renderPastCompetitionsForColumn(colId, seasonSelect.value);
        }
    });

    addBtn.addEventListener('click', () => {
        if (Object.keys(activeColumns).length >= 4) {
            alert("You can only compare up to 4 teams at a time.");
            return;
        }
        addColumn();
    });

    dashboardsContainer.appendChild(colElement);
    
    // Auto-focus the new input
    setTimeout(() => input.focus(), 50);
}

function destroyColumn(colId) {
    const colState = activeColumns[colId];
    if (!colState) return;
    
    // Cleanup Chart Instances to prevent memory leaks
    if (colState.chartMulti) colState.chartMulti.destroy();
    if (colState.chartProg) colState.chartProg.destroy();
    
    // Remove DOM element
    colState.element.remove();
    delete activeColumns[colId];

    // If only 1 column is left, hide its remove button
    const remainingCols = Object.values(activeColumns);
    if (remainingCols.length === 1) {
        remainingCols[0].element.querySelector('.tmpl-removeBtn').style.display = 'none';
    }
}

/** ─── DATA FETCHING ─── */
async function fetchHistoricalData(teamNumber) {
    const query = `
        query TeamHistory($number: Int!) {
            teamByNumber(number: $number) {
                number
                name
                s2019: quickStats(season: 2019) { tot { value rank } auto { value rank } dc { value rank } }
                s2020: quickStats(season: 2020) { tot { value rank } auto { value rank } dc { value rank } }
                s2021: quickStats(season: 2021) { tot { value rank } auto { value rank } dc { value rank } }
                s2022: quickStats(season: 2022) { tot { value rank } auto { value rank } dc { value rank } }
                s2023: quickStats(season: 2023) { tot { value rank } auto { value rank } dc { value rank } }
                s2024: quickStats(season: 2024) { tot { value rank } auto { value rank } dc { value rank } }
                s2025: quickStats(season: 2025) { tot { value rank } auto { value rank } dc { value rank } }
                
                events2024: events(season: 2024) { 
                    eventCode 
                    event { name start } 
                    stats { ... on TeamEventStats2024 { opr { totalPoints totalPointsNp autoPoints dcPoints } } }
                }
                events2025: events(season: 2025) { 
                    eventCode 
                    event { name start } 
                    stats { ... on TeamEventStats2025 { opr { totalPoints totalPointsNp autoPoints dcPoints } } }
                }
            }
        }
    `;

    const response = await fetch(FTCSCOUT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { number: parseInt(teamNumber) } })
    });
    const data = await response.json();
    if (data.errors) throw new Error(data.errors[0].message);
    
    const team = data.data?.teamByNumber;
    if (!team) throw new Error(`We couldn't locate Team ${teamNumber}.`);
    return team;
}

/** ─── LIVE ANALYSIS (Per-Column) ─── */
async function analyzeColumn(colId, teamNum) {
    const colState = activeColumns[colId];
    if (!colState) return;

    const el = colState.element;
    const loader = el.querySelector('.column-loading-state');
    const emptyState = el.querySelector('.empty-state');
    const content = el.querySelector('.column-content');
    const errorMsg = el.querySelector('.tmpl-errorMsg');

    emptyState.classList.add('hidden');
    loader.classList.remove('hidden');
    content.classList.add('hidden');
    errorMsg.classList.add('hidden');

    try {
        const data = await fetchHistoricalData(teamNum);
        colState.teamData = data;

        // Apply team header
        el.querySelector('.tmpl-teamNameDisplay').textContent = data.name || `Team ${data.number}`;
        el.querySelector('.tmpl-teamNumberDisplay').textContent = data.number;

        // Update document title for SEO
        document.title = `${data.name || 'Team ' + data.number} History | FTC Match`;

        // Render charts local to this column ID
        renderMultiYearChartForColumn(colId);
        
        const currentSeason = el.querySelector('.tmpl-seasonFilter').value;
        renderPastCompetitionsForColumn(colId, currentSeason);

        loader.classList.add('hidden');
        content.classList.remove('hidden');

    } catch (err) {
        console.error(err);
        loader.classList.add('hidden');
        content.style.display = 'flex'; // show container but hide sub-elements maybe?
        content.classList.remove('hidden');
        content.querySelector('.event-info-card').classList.add('hidden');
        content.querySelector('.chart-panel').classList.add('hidden');
        content.querySelector('.generator-card').classList.add('hidden');
        
        errorMsg.textContent = err.message;
        errorMsg.classList.remove('hidden');
    }
}

/** ─── CHART RENDERING LOGIC ─── */
function renderMultiYearChartForColumn(colId) {
    const colState = activeColumns[colId];
    const teamData = colState.teamData;
    const el = colState.element;

    const ctx = document.getElementById(`multi_${colId}`).getContext('2d');
    const noHistoryMsg = el.querySelector('.tmpl-noHistoryMsg');

    const seasons = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];
    const seasonLabels = ['SKYSTONE', 'ULTIMATE GOAL', 'FREIGHT FRENZY', 'POWERPLAY', 'CENTERSTAGE', 'INTO THE DEEP', 'DECODE'];
    const TEAM_COUNTS = { '2019': 6000, '2020': 4500, '2021': 5500, '2022': 6500, '2023': 7000, '2024': 7500, '2025': 8000 };
    
    const getPercentile = (statObject, seasonKey) => {
        if (!statObject || !statObject.rank) return null;
        let pct = ((TEAM_COUNTS[seasonKey] - statObject.rank) / TEAM_COUNTS[seasonKey]) * 100;
        return parseFloat(Math.max(0, Math.min(100, pct)).toFixed(1));
    };

    const totalPct = seasons.map(s => getPercentile(teamData[`s${s}`]?.tot, s));
    const autoPct = seasons.map(s => getPercentile(teamData[`s${s}`]?.auto, s));
    const teleopPct = seasons.map(s => getPercentile(teamData[`s${s}`]?.dc, s));

    const datasets = [
        {
            label: 'Total Pct',
            data: totalPct,
            borderColor: 'rgba(10, 132, 255, 1)', backgroundColor: 'rgba(10, 132, 255, 0.1)',
            borderWidth: 3, pointBackgroundColor: '#fff', fill: true, tension: 0.3, spanGaps: true
        },
        {
            label: 'Auto Pct',
            data: autoPct,
            borderColor: 'rgba(48, 209, 88, 1)', borderWidth: 2, borderDash: [5, 5], pointBackgroundColor: '#fff', spanGaps: true
        },
        {
            label: 'TeleOp Pct',
            data: teleopPct,
            borderColor: 'rgba(255, 69, 58, 1)', borderWidth: 2, borderDash: [5, 5], pointBackgroundColor: '#fff', spanGaps: true
        }
    ];

    const hasAnyData = datasets.some(d => d.data.some(val => val !== null && !isNaN(val)));
    
    if (!hasAnyData) {
        document.getElementById(`multi_${colId}`).style.display = 'none';
        noHistoryMsg.classList.remove('hidden');
        return;
    } else {
        document.getElementById(`multi_${colId}`).style.display = 'block';
        noHistoryMsg.classList.add('hidden');
    }

    if (colState.chartMulti) colState.chartMulti.destroy();

    colState.chartMulti = new Chart(ctx, {
        type: 'line',
        data: { labels: seasonLabels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#f5f5f7', usePointStyle: true, font: {size: 11} } },
                tooltip: { backgroundColor: 'rgba(18, 23, 34, 0.95)', titleColor: '#f5f5f7', bodyColor: '#f5f5f7' }
            },
            scales: {
                x: { ticks: { color: '#86868b', font: {size: 9} }, grid: { display: false } },
                y: { ticks: { color: '#86868b', font: {size: 10}, callback: (v) => v + '%' }, grid: { color: 'rgba(255,255,255,0.05)' }, min: 0, max: 100 }
            }
        }
    });
}

function renderPastCompetitionsForColumn(colId, seasonString) {
    const colState = activeColumns[colId];
    const teamData = colState.teamData;
    const el = colState.element;

    const listContainer = el.querySelector('.tmpl-pastCompsList');
    const noEventsMsg = el.querySelector('.tmpl-noEventsMsg');
    const chartContainer = el.querySelector('.tmpl-progressionChartContainer');
    
    listContainer.innerHTML = '';
    
    const events = [...(teamData[`events${seasonString}`] || [])]
        .sort((a,b) => new Date(a.event?.start) - new Date(b.event?.start));
        
    const validEvents = events.filter(evt => evt.stats?.opr?.totalPoints != null);

    // Progression Chart
    const ctx = document.getElementById(`prog_${colId}`)?.getContext('2d');
    if (colState.chartProg) colState.chartProg.destroy();

    if (validEvents.length > 0 && ctx) {
        chartContainer.style.display = 'block';
        colState.chartProg = new Chart(ctx, {
            type: 'line',
            data: {
                labels: validEvents.map((_, i) => `Evt ${i+1}`),
                datasets: [
                    {
                        label: 'Tot OPR', data: validEvents.map(e => e.stats.opr.totalPoints),
                        borderColor: 'rgba(10, 132, 255, 1)', backgroundColor: 'rgba(10, 132, 255, 0.1)',
                        borderWidth: 2, fill: true, tension: 0.2, pointBackgroundColor: '#fff'
                    },
                    {
                        label: 'NP OPR', data: validEvents.map(e => e.stats.opr.totalPointsNp || null),
                        borderColor: 'rgba(255, 159, 10, 1)', borderWidth: 1.5, borderDash: [4, 4], pointBackgroundColor: '#fff'
                    },
                    {
                        label: 'Auto OPR', data: validEvents.map(e => e.stats.opr.autoPoints || null),
                        borderColor: 'rgba(48, 209, 88, 1)', borderWidth: 1.5, borderDash: [4, 4], pointBackgroundColor: '#fff'
                    },
                    {
                        label: 'Tele OPR', data: validEvents.map(e => e.stats.opr.dcPoints || null),
                        borderColor: 'rgba(255, 69, 58, 1)', borderWidth: 1.5, borderDash: [4, 4], pointBackgroundColor: '#fff'
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#f5f5f7', usePointStyle: true, font:{size: 11} } } },
                scales: {
                    x: { ticks: { color: '#86868b' }, grid: { display: false } },
                    y: { ticks: { color: '#86868b' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
                }
            }
        });
    } else {
        chartContainer.style.display = 'none';
    }

    // Event List
    if (events.length === 0) {
        noEventsMsg.classList.remove('hidden');
    } else {
        noEventsMsg.classList.add('hidden');
        events.forEach((evt) => {
            const startDate = evt.event?.start ? new Date(evt.event.start).toLocaleDateString() : 'Unknown';
            let statsHtml = '';
            if (evt.stats?.opr) {
                statsHtml = `
                    <div style="margin-top: 10px; display: flex; gap: 8px; font-size: 11px; flex-wrap: wrap;">
                        <span style="color: var(--text-primary);"><strong style="color: var(--accent-blue);">Tot:</strong> ${evt.stats.opr.totalPoints?.toFixed(1) || '-'}</span>
                        <span style="color: var(--text-primary);"><strong style="color: rgb(255, 159, 10);">NP:</strong> ${evt.stats.opr.totalPointsNp?.toFixed(1) || '-'}</span>
                        <span style="color: var(--text-secondary);"><strong style="color: var(--accent-green);">Auto:</strong> ${evt.stats.opr.autoPoints?.toFixed(1) || '-'}</span>
                        <span style="color: var(--text-secondary);"><strong style="color: var(--accent-red);">Tele:</strong> ${evt.stats.opr.dcPoints?.toFixed(1) || '-'}</span>
                    </div>`;
            }

            listContainer.insertAdjacentHTML('beforeend', `
                <div class="stat-item" style="flex-direction: column; align-items: flex-start; padding: 12px 16px; border-left: 3px solid var(--accent-blue);">
                    <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 4px;">
                        <strong style="color: var(--text-primary); font-size: 14px; max-width: 70%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(evt.event?.name)}">${escapeHTML(evt.event?.name)}</strong>
                        <span class="btn-small" style="font-size: 10px; padding: 2px 6px;">${escapeHTML(startDate)}</span>
                    </div>
                    <div style="color: var(--text-secondary); font-size: 12px; display: flex; align-items: center; justify-content: space-between; width: 100%;">
                        <span>Code: <strong>${escapeHTML(evt.eventCode)}</strong></span>
                        <a href="https://ftcscout.org/events/${escapeHTML(seasonString)}/${escapeHTML(evt.eventCode)}" target="_blank" class="btn-primary" style="font-size: 10px; padding: 4px 8px; border-radius: 4px; text-decoration: none;">View Event Details</a>
                    </div>
                    ${statsHtml}
                </div>`);
        });
    }
}
