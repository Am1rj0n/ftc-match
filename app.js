// DOM Elements
const simulateBtn = document.getElementById('simulateBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const errorPanel = document.getElementById('errorPanel');
const errorMessage = document.getElementById('errorMessage');
const resultsSection = document.getElementById('resultsSection');

// Chart instance
let histogramChart = null;

// Event Listeners
simulateBtn.addEventListener('click', runSimulation);

document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            runSimulation();
        }
    });
});

// Gaussian random number generator (Box-Muller transform)
function gaussianRandom() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// CLIENT-SIDE MONTE CARLO SIMULATION - FIXED
function runMonteCarloSimulation(stats1, stats2, targetScore, iterations = 10000) {
    const scores = [];
    
    for (let i = 0; i < iterations; i++) {
        // Generate random multipliers using normal distribution
        const rand1Auto = gaussianRandom() * 0.2;
        const rand1Teleop = gaussianRandom() * 0.2;
        const rand1Endgame = gaussianRandom() * 0.2;
        
        const rand2Auto = gaussianRandom() * 0.2;
        const rand2Teleop = gaussianRandom() * 0.2;
        const rand2Endgame = gaussianRandom() * 0.2;
        
        const score1 = Math.max(0, 
            stats1.auto * (1 + rand1Auto) +
            stats1.teleop * (1 + rand1Teleop) +
            stats1.endgame * (1 + rand1Endgame)
        );
        
        const score2 = Math.max(0,
            stats2.auto * (1 + rand2Auto) +
            stats2.teleop * (1 + rand2Teleop) +
            stats2.endgame * (1 + rand2Endgame)
        );
        
        scores.push(score1 + score2);
    }
    
    const mean = scores.reduce((a, b) => a + b, 0) / iterations;
    const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / iterations;
    const stdDev = Math.sqrt(variance);
    
    const winCount = scores.filter(s => s >= targetScore).length;
    const winProb = (winCount / iterations) * 100;
    
    // Create histogram
    const bins = 20;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const binSize = (max - min) / bins;
    
    const histogram = Array(bins).fill(0);
    scores.forEach(score => {
        const binIndex = Math.min(bins - 1, Math.floor((score - min) / binSize));
        histogram[binIndex]++;
    });
    
    return {
        mean: mean.toFixed(1),
        stdDev: stdDev.toFixed(1),
        winProb: winProb.toFixed(1),
        min: min.toFixed(1),
        max: max.toFixed(1),
        median: scores.sort((a, b) => a - b)[Math.floor(iterations / 2)].toFixed(1),
        histogram: histogram.map((count, i) => ({
            range: `${Math.round(min + i * binSize)}-${Math.round(min + (i + 1) * binSize)}`,
            count: count,
            percentage: (count / iterations * 100).toFixed(1)
        }))
    };
}

async function fetchTeamData(teamNumber, season = 2025) {
    const query = `
        query GetTeamStats($teamNumber: Int!, $season: Int!) {
            teamByNumber(number: $teamNumber) {
                number
                name
                quickStats(season: $season) {
                    tot { value }
                    auto { value }
                    dc { value }
                    eg { value }
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
        
        if (data.errors) {
            throw new Error(data.errors[0].message);
        }
        
        const team = data.data?.teamByNumber;
        if (!team) {
            throw new Error(`Team ${teamNumber} not found`);
        }
        
        const stats = team.quickStats;
        if (!stats || !stats.tot?.value) {
            throw new Error(`No stats for team ${teamNumber} in ${season} season`);
        }
        
        return {
            number: team.number,
            name: team.name,
            auto: stats.auto?.value || stats.tot.value * 0.25,
            teleop: stats.dc?.value || stats.tot.value * 0.55,
            endgame: stats.eg?.value || stats.tot.value * 0.20,
            totalOPR: stats.tot.value
        };
    } catch (error) {
        throw new Error(`Failed to fetch team ${teamNumber}: ${error.message}`);
    }
}

async function runSimulation() {
    const team1 = document.getElementById('team1').value.trim();
    const team2 = document.getElementById('team2').value.trim();
    const targetScore = parseInt(document.getElementById('targetScore').value) || 200;

    if (!team1 || !team2) {
        showError('Please enter both team numbers');
        return;
    }

    hideError();
    hideResults();
    setLoading(true);

    try {
        const [data1, data2] = await Promise.all([
            fetchTeamData(team1),
            fetchTeamData(team2)
        ]);
        
        // Run CLIENT-SIDE Monte Carlo simulation
        const simulation = runMonteCarloSimulation(data1, data2, targetScore);
        
        displayResults({
            team1: data1,
            team2: data2,
            simulation: simulation,
            targetScore: targetScore
        });
        
    } catch (error) {
        console.error('Simulation error:', error);
        showError(error.message || 'Failed to run simulation');
    } finally {
        setLoading(false);
    }
}

function displayResults(data) {
    resultsSection.classList.remove('hidden');

    document.getElementById('team1Title').textContent = `Team ${data.team1.number}`;
    document.getElementById('team1Name').textContent = data.team1.name;
    document.getElementById('team1Auto').textContent = data.team1.auto.toFixed(1);
    document.getElementById('team1Teleop').textContent = data.team1.teleop.toFixed(1);
    document.getElementById('team1Endgame').textContent = data.team1.endgame.toFixed(1);
    document.getElementById('team1Total').textContent = data.team1.totalOPR.toFixed(1);

    document.getElementById('team2Title').textContent = `Team ${data.team2.number}`;
    document.getElementById('team2Name').textContent = data.team2.name;
    document.getElementById('team2Auto').textContent = data.team2.auto.toFixed(1);
    document.getElementById('team2Teleop').textContent = data.team2.teleop.toFixed(1);
    document.getElementById('team2Endgame').textContent = data.team2.endgame.toFixed(1);
    document.getElementById('team2Total').textContent = data.team2.totalOPR.toFixed(1);

    document.getElementById('meanScore').textContent = data.simulation.mean;
    document.getElementById('stdDev').textContent = `±${data.simulation.stdDev}`;
    document.getElementById('winProb').textContent = `${data.simulation.winProb}%`;
    document.getElementById('winProbSubtitle').textContent = `vs target ${data.targetScore}`;

    renderHistogram(data.simulation.histogram);

    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderHistogram(histogramData) {
    const ctx = document.getElementById('histogramChart').getContext('2d');

    if (histogramChart) {
        histogramChart.destroy();
    }

    const labels = histogramData.map(d => d.range);
    const counts = histogramData.map(d => d.count);

    histogramChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Frequency',
                data: counts,
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#e5e7eb',
                    bodyColor: '#e5e7eb',
                    borderColor: '#374151',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            const percentage = histogramData[context.dataIndex].percentage;
                            return [
                                `Simulations: ${context.parsed.y}`,
                                `Percentage: ${percentage}%`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(75, 85, 99, 0.3)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            size: 11
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(75, 85, 99, 0.3)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#9ca3af'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

function setLoading(isLoading) {
    simulateBtn.disabled = isLoading;
    if (isLoading) {
        btnText.textContent = 'Running 10,000 Simulations...';
        btnLoader.classList.remove('hidden');
    } else {
        btnText.textContent = 'Run Monte Carlo Simulation';
        btnLoader.classList.add('hidden');
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorPanel.classList.remove('hidden');
}

function hideError() {
    errorPanel.classList.add('hidden');
}

function hideResults() {
    resultsSection.classList.add('hidden');
}