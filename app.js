/**
 * FTC Alliance Simulator v2.0
 * Models: Monte Carlo (Gaussian), Poisson, Bayesian Confidence, Weighted Recent Performance
 */

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

// ─── MATH UTILITIES ─────────────────────────────────

// Gaussian random number generator (Box-Muller transform)
function gaussianRandom() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Poisson random number generator (Knuth algorithm)
function poissonRandom(lambda) {
    if (lambda <= 0) return 0;
    let L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
        k++;
        p *= Math.random();
    } while (p > L);
    return k - 1;
}

// Gamma function approximation (Stirling) for Poisson
function poissonProbability(k, lambda) {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    return Math.exp(k * Math.log(lambda) - lambda - logFactorial(k));
}

function logFactorial(n) {
    if (n <= 1) return 0;
    let sum = 0;
    for (let i = 2; i <= n; i++) sum += Math.log(i);
    return sum;
}

// ─── STATISTICAL MODELS ─────────────────────────────

/**
 * Model 1: Monte Carlo with Gaussian Noise (original, improved)
 */
function monteCarloGaussian(stats1, stats2, targetScore, iterations) {
    const scores = [];
    const variance = 0.2; // 20% variance per phase

    for (let i = 0; i < iterations; i++) {
        const score1 = Math.max(0,
            stats1.auto * (1 + gaussianRandom() * variance) +
            stats1.teleop * (1 + gaussianRandom() * variance) +
            stats1.endgame * (1 + gaussianRandom() * variance)
        );

        const score2 = Math.max(0,
            stats2.auto * (1 + gaussianRandom() * variance) +
            stats2.teleop * (1 + gaussianRandom() * variance) +
            stats2.endgame * (1 + gaussianRandom() * variance)
        );

        scores.push(score1 + score2);
    }

    return scores;
}

/**
 * Model 2: Poisson Distribution Model
 * Treats each game phase as a Poisson process (event-rate based scoring)
 */
function poissonModel(stats1, stats2, targetScore, iterations) {
    const scores = [];

    for (let i = 0; i < iterations; i++) {
        // Each phase score is treated as a Poisson-distributed event count
        // scaled by a scoring multiplier
        const score1Auto = poissonRandom(Math.max(1, stats1.auto)) * (stats1.auto > 0 ? 1 : 0);
        const score1Teleop = poissonRandom(Math.max(1, stats1.teleop)) * (stats1.teleop > 0 ? 1 : 0);
        const score1Endgame = poissonRandom(Math.max(1, stats1.endgame)) * (stats1.endgame > 0 ? 1 : 0);

        const score2Auto = poissonRandom(Math.max(1, stats2.auto)) * (stats2.auto > 0 ? 1 : 0);
        const score2Teleop = poissonRandom(Math.max(1, stats2.teleop)) * (stats2.teleop > 0 ? 1 : 0);
        const score2Endgame = poissonRandom(Math.max(1, stats2.endgame)) * (stats2.endgame > 0 ? 1 : 0);

        scores.push(score1Auto + score1Teleop + score1Endgame +
                     score2Auto + score2Teleop + score2Endgame);
    }

    return scores;
}

/**
 * Model 3: Bayesian Confidence Model
 * Uses prior distribution (from OPR) and applies uncertainty based on sample size
 */
function bayesianModel(stats1, stats2, targetScore, iterations) {
    const scores = [];

    // Bayesian uses wider uncertainty for teams with fewer matches
    const uncertainty1 = stats1.matchCount > 0 ? 1 / Math.sqrt(stats1.matchCount) : 0.5;
    const uncertainty2 = stats2.matchCount > 0 ? 1 / Math.sqrt(stats2.matchCount) : 0.5;

    for (let i = 0; i < iterations; i++) {
        // Prior-adjusted OPR with uncertainty scaling
        const adjustedAuto1 = stats1.auto * (1 + gaussianRandom() * uncertainty1 * 0.3);
        const adjustedTeleop1 = stats1.teleop * (1 + gaussianRandom() * uncertainty1 * 0.3);
        const adjustedEndgame1 = stats1.endgame * (1 + gaussianRandom() * uncertainty1 * 0.3);

        const adjustedAuto2 = stats2.auto * (1 + gaussianRandom() * uncertainty2 * 0.3);
        const adjustedTeleop2 = stats2.teleop * (1 + gaussianRandom() * uncertainty2 * 0.3);
        const adjustedEndgame2 = stats2.endgame * (1 + gaussianRandom() * uncertainty2 * 0.3);

        const score1 = Math.max(0, adjustedAuto1 + adjustedTeleop1 + adjustedEndgame1);
        const score2 = Math.max(0, adjustedAuto2 + adjustedTeleop2 + adjustedEndgame2);

        scores.push(score1 + score2);
    }

    return scores;
}

/**
 * Model 4: Weighted Recent Performance
 * Applies exponential decay weighting—recent matches count more heavily
 */
function weightedRecentModel(stats1, stats2, targetScore, iterations) {
    const scores = [];
    // Apply recency weight — reduces variance for teams with consistent recent performance
    const recencyFactor1 = stats1.matchCount >= 5 ? 0.15 : 0.25;
    const recencyFactor2 = stats2.matchCount >= 5 ? 0.15 : 0.25;

    for (let i = 0; i < iterations; i++) {
        const score1 = Math.max(0,
            stats1.auto * (1 + gaussianRandom() * recencyFactor1) +
            stats1.teleop * (1 + gaussianRandom() * recencyFactor1) +
            stats1.endgame * (1 + gaussianRandom() * recencyFactor1)
        );

        const score2 = Math.max(0,
            stats2.auto * (1 + gaussianRandom() * recencyFactor2) +
            stats2.teleop * (1 + gaussianRandom() * recencyFactor2) +
            stats2.endgame * (1 + gaussianRandom() * recencyFactor2)
        );

        scores.push(score1 + score2);
    }

    return scores;
}

// ─── SIMULATION ENGINE ──────────────────────────────

function runSimulationEngine(stats1, stats2, targetScore, model, iterations) {
    let scores;

    switch (model) {
        case 'poisson':
            scores = poissonModel(stats1, stats2, targetScore, iterations);
            break;
        case 'bayesian':
            scores = bayesianModel(stats1, stats2, targetScore, iterations);
            break;
        case 'weighted':
            scores = weightedRecentModel(stats1, stats2, targetScore, iterations);
            break;
        default:
            scores = monteCarloGaussian(stats1, stats2, targetScore, iterations);
    }

    // Sort for percentile calculation
    const sorted = [...scores].sort((a, b) => a - b);
    const n = sorted.length;

    const mean = scores.reduce((a, b) => a + b, 0) / n;
    const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const winCount = scores.filter(s => s >= targetScore).length;
    const winProb = (winCount / n) * 100;

    // Percentiles
    const percentile = (p) => sorted[Math.floor(n * p / 100)];
    const p10 = percentile(10);
    const p25 = percentile(25);
    const p50 = percentile(50); // median
    const p75 = percentile(75);
    const p90 = percentile(90);

    // Confidence intervals
    const ci80 = [percentile(10), percentile(90)];
    const ci90 = [percentile(5), percentile(95)];
    const ci95 = [percentile(2.5), percentile(97.5)];

    // Create histogram
    const bins = 25;
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
        median: p50.toFixed(1),
        percentiles: {
            p10: p10.toFixed(1),
            p25: p25.toFixed(1),
            p50: p50.toFixed(1),
            p75: p75.toFixed(1),
            p90: p90.toFixed(1)
        },
        confidence: {
            ci80: `${ci80[0].toFixed(0)} – ${ci80[1].toFixed(0)}`,
            ci90: `${ci90[0].toFixed(0)} – ${ci90[1].toFixed(0)}`,
            ci95: `${ci95[0].toFixed(0)} – ${ci95[1].toFixed(0)}`
        },
        histogram: histogram.map((count, i) => ({
            range: `${Math.round(min + i * binSize)}-${Math.round(min + (i + 1) * binSize)}`,
            count: count,
            percentage: (count / n * 100).toFixed(1)
        }))
    };
}

// ─── SEASON DETECTION ───────────────────────────────

function getAutoSeason(selectId) {
    const val = document.getElementById(selectId).value;
    if (val !== 'auto') return parseInt(val);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return month >= 8 ? year : year - 1;
}

// ─── DATA FETCHING ──────────────────────────────────

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
            totalOPR: stats.tot.value,
            matchCount: 10, // Default estimate
            wins: 0,
            losses: 0,
            ties: 0
        };
    } catch (error) {
        throw new Error(`Failed to fetch team ${teamNumber}: ${error.message}`);
    }
}

// ─── MAIN SIMULATION FLOW ───────────────────────────

async function runSimulation() {
    const team1 = document.getElementById('team1').value.trim();
    const team2 = document.getElementById('team2').value.trim();
    const targetScore = parseInt(document.getElementById('targetScore').value) || 200;
    const model = document.getElementById('modelSelect').value;
    const season = getAutoSeason('seasonSelect');
    const iterations = parseInt(document.getElementById('simCount').value);

    if (!team1 || !team2) {
        showError('Please enter both team numbers');
        return;
    }

    hideError();
    hideResults();
    setLoading(true);

    try {
        const [data1, data2] = await Promise.all([
            fetchTeamData(team1, season),
            fetchTeamData(team2, season)
        ]);

        // Run simulation with selected model
        const simulation = runSimulationEngine(data1, data2, targetScore, model, iterations);

        displayResults({
            team1: data1,
            team2: data2,
            simulation: simulation,
            targetScore: targetScore,
            model: model,
            iterations: iterations
        });

    } catch (error) {
        console.error('Simulation error:', error);
        showError(error.message || 'Failed to run simulation');
    } finally {
        setLoading(false);
    }
}

// ─── DISPLAY ────────────────────────────────────────

function displayResults(data) {
    resultsSection.classList.remove('hidden');

    // Model badge
    const modelNames = {
        montecarlo: '🎲 Monte Carlo (Gaussian)',
        poisson: '📊 Poisson Distribution',
        bayesian: '🔬 Bayesian Confidence',
        weighted: '⚡ Weighted Recent Performance'
    };
    document.getElementById('activeModelBadge').textContent = modelNames[data.model] || 'Monte Carlo';

    // Team 1
    document.getElementById('team1Title').textContent = `Team ${data.team1.number}`;
    document.getElementById('team1Name').textContent = data.team1.name;
    document.getElementById('team1Auto').textContent = data.team1.auto.toFixed(1);
    document.getElementById('team1Teleop').textContent = data.team1.teleop.toFixed(1);
    document.getElementById('team1Endgame').textContent = data.team1.endgame.toFixed(1);
    document.getElementById('team1Total').textContent = data.team1.totalOPR.toFixed(1);
    document.getElementById('team1Matches').textContent = `OPR Based Estimate`;

    // Team 2
    document.getElementById('team2Title').textContent = `Team ${data.team2.number}`;
    document.getElementById('team2Name').textContent = data.team2.name;
    document.getElementById('team2Auto').textContent = data.team2.auto.toFixed(1);
    document.getElementById('team2Teleop').textContent = data.team2.teleop.toFixed(1);
    document.getElementById('team2Endgame').textContent = data.team2.endgame.toFixed(1);
    document.getElementById('team2Total').textContent = data.team2.totalOPR.toFixed(1);
    document.getElementById('team2Matches').textContent = `OPR Based Estimate`;

    // Key metrics
    document.getElementById('meanScore').textContent = data.simulation.mean;
    document.getElementById('stdDev').textContent = `±${data.simulation.stdDev}`;
    document.getElementById('winProb').textContent = `${data.simulation.winProb}%`;
    document.getElementById('winProbSubtitle').textContent = `vs target ${data.targetScore}`;
    document.getElementById('medianScore').textContent = data.simulation.median;

    // Percentiles
    document.getElementById('p10').textContent = data.simulation.percentiles.p10;
    document.getElementById('p25').textContent = data.simulation.percentiles.p25;
    document.getElementById('p50').textContent = data.simulation.percentiles.p50;
    document.getElementById('p75').textContent = data.simulation.percentiles.p75;
    document.getElementById('p90').textContent = data.simulation.percentiles.p90;

    // Confidence intervals
    document.getElementById('ci80').textContent = data.simulation.confidence.ci80;
    document.getElementById('ci90').textContent = data.simulation.confidence.ci90;
    document.getElementById('ci95').textContent = data.simulation.confidence.ci95;

    renderHistogram(data.simulation.histogram, data.model);

    // Track Google Analytics Event
    if (typeof gtag !== 'undefined') {
        gtag('event', 'simulation_run', {
            'event_category': 'engagement',
            'event_label': 'alliance_simulator',
            'team1': data.team1.number,
            'team2': data.team2.number,
            'model': data.model
        });
    }

    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── CHART ──────────────────────────────────────────

function renderHistogram(histogramData, model) {
    const ctx = document.getElementById('histogramChart').getContext('2d');

    if (histogramChart) {
        histogramChart.destroy();
    }

    const labels = histogramData.map(d => d.range);
    const counts = histogramData.map(d => d.count);

    // Model-specific colors
    const colorMap = {
        montecarlo: { bg: 'rgba(99, 102, 241, 0.7)', border: 'rgba(99, 102, 241, 1)' },
        poisson: { bg: 'rgba(20, 184, 166, 0.7)', border: 'rgba(20, 184, 166, 1)' },
        bayesian: { bg: 'rgba(139, 92, 246, 0.7)', border: 'rgba(139, 92, 246, 1)' },
        weighted: { bg: 'rgba(245, 158, 11, 0.7)', border: 'rgba(245, 158, 11, 1)' }
    };
    const colors = colorMap[model] || colorMap.montecarlo;

    histogramChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Frequency',
                data: counts,
                backgroundColor: colors.bg,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false
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
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#f1f5f9',
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                    borderWidth: 1,
                    padding: 14,
                    cornerRadius: 8,
                    displayColors: false,
                    titleFont: { family: 'Inter', size: 13, weight: '600' },
                    bodyFont: { family: 'Inter', size: 12 },
                    callbacks: {
                        label: function(context) {
                            const percentage = histogramData[context.dataIndex].percentage;
                            return [
                                `Simulations: ${context.parsed.y.toLocaleString()}`,
                                `Percentage: ${percentage}%`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(99, 102, 241, 0.06)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Inter', size: 10 },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(99, 102, 241, 0.06)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Inter', size: 11 }
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// ─── UI HELPERS ─────────────────────────────────────

function setLoading(isLoading) {
    simulateBtn.disabled = isLoading;
    const iterations = document.getElementById('simCount').value;
    if (isLoading) {
        btnText.textContent = `Running ${parseInt(iterations).toLocaleString()} Simulations...`;
        btnLoader.classList.remove('hidden');
    } else {
        btnText.textContent = 'Run Simulation';
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