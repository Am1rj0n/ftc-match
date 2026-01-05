// Configuration
const FTC_EVENTS_API = 'https://ftc-api.firstinspires.org/v2.0';

// State
let currentEventCode = null;
let currentEventTeams = [];
let eventScoresChart = null;

// DOM Elements
const loadEventBtn = document.getElementById('loadEventBtn');
const loadBtnText = document.getElementById('loadBtnText');
const loadBtnLoader = document.getElementById('loadBtnLoader');
const simulateAllianceBtn = document.getElementById('simulateAllianceBtn');
const simBtnText = document.getElementById('simBtnText');
const simBtnLoader = document.getElementById('simBtnLoader');
const changeEventBtn = document.getElementById('changeEventBtn');

const errorPanel = document.getElementById('errorPanel');
const errorMessage = document.getElementById('errorMessage');
const dashboardSection = document.getElementById('dashboardSection');
const simResultsSection = document.getElementById('simResultsSection');

// Event Listeners
loadEventBtn.addEventListener('click', loadEvent);
simulateAllianceBtn.addEventListener('click', simulateAlliance);
changeEventBtn.addEventListener('click', () => {
    dashboardSection.classList.add('hidden');
    document.querySelector('.input-panel').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('eventCodeSearch').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadEvent();
});

// Gaussian random number generator
function gaussianRandom() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// CLIENT-SIDE MONTE CARLO SIMULATION
function runMonteCarloSimulation(stats1, stats2, iterations = 10000) {
    const scores = [];
    
    for (let i = 0; i < iterations; i++) {
        const rand1Auto = gaussianRandom() * 0.2;
        const rand1DC = gaussianRandom() * 0.2;
        const rand2Auto = gaussianRandom() * 0.2;
        const rand2DC = gaussianRandom() * 0.2;
        
        const score1 = Math.max(0, 
            stats1.opr.auto * (1 + rand1Auto) +
            stats1.opr.dc * (1 + rand1DC)
        );
        
        const score2 = Math.max(0,
            stats2.opr.auto * (1 + rand2Auto) +
            stats2.opr.dc * (1 + rand2DC)
        );
        
        scores.push(score1 + score2);
    }
    
    const mean = scores.reduce((a, b) => a + b, 0) / iterations;
    const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / iterations;
    const stdDev = Math.sqrt(variance);
    
    return {
        mean: mean,
        stdDev: stdDev,
        min: Math.min(...scores),
        max: Math.max(...scores),
        scores: scores
    };
}

async function fetchTeamStatsFromScout(teamNumber, season = 2025) {
    const query = `
        query GetTeamStats($teamNumber: Int!, $season: Int!) {
            teamByNumber(number: $teamNumber) {
                number
                name
                quickStats(season: $season) {
                    tot { value }
                    auto { value }
                    dc { value }
                }
            }
        }
    `;
    
    try {
        const response = await fetch('https://api.ftcscout.org/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                variables: { teamNumber: parseInt(teamNumber), season }
            })
        });
        
        const data = await response.json();
        if (data.errors || !data.data?.teamByNumber) return null;
        
        const team = data.data.teamByNumber;
        const stats = team.quickStats;
        
        if (!stats || !stats.tot?.value) return null;
        
        return {
            teamNumber: team.number,
            name: team.name,
            opr: {
                total: stats.tot.value,
                auto: stats.auto?.value || stats.tot.value * 0.25,
                dc: stats.dc?.value || stats.tot.value * 0.55
            },
            consistency: 15
        };
    } catch (err) {
        console.error(`Failed to fetch team ${teamNumber}:`, err);
        return null;
    }
}

async function loadEvent() {
    const eventCode = document.getElementById('eventCodeSearch').value.trim().toUpperCase();
    const season = parseInt(document.getElementById('seasonSelect').value);

    if (!eventCode) {
        showError('Please enter an event code');
        return;
    }

    hideError();
    setLoadLoading(true);

    try {
        // Step 1: Get event info
        const eventResponse = await fetch(
            `${FTC_EVENTS_API}/${season}/events?eventCode=${eventCode}`,
            {
                headers: {
                    'Authorization': `Basic ${btoa(FTC_EVENTS_AUTH)}`,
                    'Accept': 'application/json'
                }
            }
        );

        if (!eventResponse.ok) {
            throw new Error(`Event ${eventCode} not found for ${season} season`);
        }

        const eventData = await eventResponse.json();
        if (!eventData.events || eventData.events.length === 0) {
            throw new Error(`Event ${eventCode} not found`);
        }

        const event = eventData.events[0];

        // Step 2: Get teams at event
        const teamsResponse = await fetch(
            `${FTC_EVENTS_API}/${season}/teams?eventCode=${eventCode}`,
            {
                headers: {
                    'Authorization': `Basic ${btoa(FTC_EVENTS_AUTH)}`,
                    'Accept': 'application/json'
                }
            }
        );

        if (!teamsResponse.ok) {
            throw new Error('Failed to fetch teams at event');
        }

        const teamsData = await teamsResponse.json();
        if (!teamsData.teams || teamsData.teams.length === 0) {
            throw new Error('No teams found at this event');
        }

        // Step 3: Get rankings
        let rankings = [];
        try {
            const rankingsResponse = await fetch(
                `${FTC_EVENTS_API}/${season}/rankings/${eventCode}`,
                {
                    headers: {
                        'Authorization': `Basic ${btoa(FTC_EVENTS_AUTH)}`,
                        'Accept': 'application/json'
                    }
                }
            );
            
            if (rankingsResponse.ok) {
                const rankingsData = await rankingsResponse.json();
                rankings = rankingsData.rankings || [];
            }
        } catch (err) {
            console.log('Rankings not available yet');
        }

        // Step 4: Get OPR stats for each team
        const teamNumbers = teamsData.teams.map(t => t.teamNumber);
        const statsPromises = teamNumbers.map(num => fetchTeamStatsFromScout(num, season));
        const allStats = await Promise.all(statsPromises);

        // Merge data
        currentEventTeams = [];
        for (let i = 0; i < teamNumbers.length; i++) {
            const stats = allStats[i];
            if (stats) {
                const ranking = rankings.find(r => r.team?.teamNumber === stats.teamNumber);
                currentEventTeams.push({
                    ...stats,
                    rank: ranking?.rank || null,
                    wins: ranking?.wins || 0,
                    losses: ranking?.losses || 0,
                    ties: ranking?.ties || 0,
                    rp: ranking?.rankingPoints || 0
                });
            }
        }

        if (currentEventTeams.length === 0) {
            throw new Error('No team stats available for this event');
        }

        currentEventCode = eventCode;
        
        displayEventDashboard({
            event: {
                name: event.name,
                code: event.code,
                dateStart: event.dateStart,
                dateEnd: event.dateEnd
            },
            teams: currentEventTeams
        }, season);
        
    } catch (error) {
        console.error('Load error:', error);
        showError(error.message || 'Failed to load event');
    } finally {
        setLoadLoading(false);
    }
}

function displayEventDashboard(data, season) {
    document.getElementById('dashEventName').textContent = data.event.name;
    document.getElementById('dashEventDates').textContent = `Season ${season}`;
    document.getElementById('dashEventLocation').textContent = data.event.code;
    document.getElementById('dashEventStatus').innerHTML = '<span class="badge-upcoming">Loaded</span>';

    displayEventStats(data.teams);
    displayTopTeams(data.teams);

    dashboardSection.classList.remove('hidden');
    dashboardSection.scrollIntoView({ behavior: 'smooth' });
}

function displayEventStats(teams) {
    document.getElementById('totalTeams').textContent = teams.length;

    const validOPRs = teams.filter(t => t.opr.total > 0);
    if (validOPRs.length > 0) {
        const totalOPR = validOPRs.reduce((sum, t) => sum + t.opr.total, 0);
        const avgOPR = totalOPR / validOPRs.length;
        document.getElementById('avgOPR').textContent = avgOPR.toFixed(1);

        const maxOPR = Math.max(...validOPRs.map(t => t.opr.total));
        document.getElementById('topOPR').textContent = maxOPR.toFixed(1);
    } else {
        document.getElementById('avgOPR').textContent = 'N/A';
        document.getElementById('topOPR').textContent = 'N/A';
    }
}

function displayTopTeams(teams) {
    const sorted = [...teams].sort((a, b) => (a.rank || 999) - (b.rank || 999));
    const top10 = sorted.slice(0, 10);

    const tbody = document.getElementById('rankingsBody');
    tbody.innerHTML = top10.map(team => `
        <tr>
            <td><strong>${team.rank || '-'}</strong></td>
            <td><strong>${team.teamNumber}</strong></td>
            <td>${team.opr.total.toFixed(1)}</td>
            <td>${team.wins}-${team.losses}-${team.ties}</td>
            <td>${team.rp.toFixed(1)}</td>
        </tr>
    `).join('');
}

async function simulateAlliance() {
    const team1 = document.getElementById('simTeam1').value.trim();
    const team2 = document.getElementById('simTeam2').value.trim();

    if (!team1 || !team2) {
        showError('Please enter both team numbers');
        return;
    }

    const t1Data = currentEventTeams.find(t => t.teamNumber === parseInt(team1));
    const t2Data = currentEventTeams.find(t => t.teamNumber === parseInt(team2));

    if (!t1Data) {
        showError(`Team ${team1} not found at this event`);
        return;
    }
    if (!t2Data) {
        showError(`Team ${team2} not found at this event`);
        return;
    }

    hideError();
    setSimLoading(true);

    try {
        // RUN CLIENT-SIDE MONTE CARLO
        const simulation = runMonteCarloSimulation(t1Data, t2Data, 10000);
        
        const allianceOPR = t1Data.opr.total + t2Data.opr.total;
        const avgConsistency = simulation.stdDev;

        const allOPRs = currentEventTeams.map(t => t.opr.total).sort((a, b) => b - a);
        const projectedRank = allOPRs.findIndex(opr => allianceOPR > opr) + 1;

        document.getElementById('allianceScore').textContent = simulation.mean.toFixed(1);
        document.getElementById('allianceConsistency').textContent = `±${avgConsistency.toFixed(1)}`;
        document.getElementById('rankProjection').textContent = 
            projectedRank > 0 ? `Top ${projectedRank}` : 'Top Tier';

        renderEventScoresChart(simulation.scores, currentEventTeams);

        simResultsSection.classList.remove('hidden');
        simResultsSection.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        showError('Simulation failed');
        console.error(error);
    } finally {
        setSimLoading(false);
    }
}

function renderEventScoresChart(allianceScores, teams) {
    const ctx = document.getElementById('eventScoresChart').getContext('2d');

    if (eventScoresChart) {
        eventScoresChart.destroy();
    }

    // Create histogram from Monte Carlo results
    const min = Math.min(...allianceScores);
    const max = Math.max(...allianceScores);
    const binCount = 20;
    const binWidth = (max - min) / binCount;

    const bins = Array(binCount).fill(0);
    allianceScores.forEach(score => {
        const binIndex = Math.min(Math.floor((score - min) / binWidth), binCount - 1);
        bins[binIndex]++;
    });

    const labels = bins.map((_, i) => 
        `${Math.round(min + i * binWidth)}-${Math.round(min + (i + 1) * binWidth)}`
    );

    eventScoresChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Simulation Results',
                data: bins,
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#e5e7eb',
                    bodyColor: '#e5e7eb'
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(75, 85, 99, 0.3)' },
                    ticks: { color: '#9ca3af', font: { size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(75, 85, 99, 0.3)' },
                    ticks: { color: '#9ca3af' },
                    beginAtZero: true
                }
            }
        }
    });
}

function setLoadLoading(isLoading) {
    loadEventBtn.disabled = isLoading;
    if (isLoading) {
        loadBtnText.textContent = 'Loading Event...';
        loadBtnLoader.classList.remove('hidden');
    } else {
        loadBtnText.textContent = 'Load Event';
        loadBtnLoader.classList.add('hidden');
    }
}

function setSimLoading(isLoading) {
    simulateAllianceBtn.disabled = isLoading;
    if (isLoading) {
        simBtnText.textContent = 'Running 10,000 Simulations...';
        simBtnLoader.classList.remove('hidden');
    } else {
        simBtnText.textContent = 'Simulate Alliance at This Event';
        simBtnLoader.classList.add('hidden');
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorPanel.classList.remove('hidden');
}

function hideError() {
    errorPanel.classList.add('hidden');
}