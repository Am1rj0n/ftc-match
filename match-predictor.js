/**
 * FTC Match Predictor v2.0
 * Models: Monte Carlo + Elo, Poisson, Bayesian
 * Features: Elo ratings, margin of victory distribution, W-L-T records
 */

// DOM Elements
const predictBtn = document.getElementById('predictBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const errorPanel = document.getElementById('errorPanel');
const errorMessage = document.getElementById('errorMessage');
const resultsSection = document.getElementById('resultsSection');

// Chart instances
let comparisonChart = null;
let marginChart = null;

// Event Listeners
predictBtn.addEventListener('click', predictMatch);

document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            predictMatch();
        }
    });
});

// ─── MATH UTILITIES ─────────────────────────────────

function gaussianRandom() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

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

// ─── ELO RATING SYSTEM ─────────────────────────────

/**
 * Calculate Elo rating from team's win/loss record and OPR
 * Base Elo = 1500, adjusted by performance
 */
function calculateElo(teamData) {
    const BASE_ELO = 1500;
    const totalGames = teamData.wins + teamData.losses + teamData.ties;

    if (totalGames === 0) {
        // No match history — estimate from OPR
        return BASE_ELO + (teamData.totalOPR - 60) * 3;
    }

    const winRate = (teamData.wins + teamData.ties * 0.5) / totalGames;
    
    // OPR contribution (scaled)
    const oprBonus = (teamData.totalOPR - 60) * 2.5;
    
    // Win rate contribution
    const winBonus = (winRate - 0.5) * 400;
    
    // Experience factor (more matches = more reliable)
    const experienceFactor = Math.min(1, totalGames / 10);
    
    return Math.round(BASE_ELO + (oprBonus * 0.6 + winBonus * 0.4) * experienceFactor + oprBonus * (1 - experienceFactor));
}

/**
 * Elo-based win probability
 * P(A wins) = 1 / (1 + 10^((Rb - Ra) / 400))
 */
function eloWinProbability(eloA, eloB) {
    return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

// ─── SIMULATION MODELS ─────────────────────────────

function simulateAllianceScore(stats1, stats2, model) {
    switch (model) {
        case 'poisson': {
            const s1 = (poissonRandom(Math.max(1, stats1.auto)) +
                        poissonRandom(Math.max(1, stats1.teleop)) +
                        poissonRandom(Math.max(1, stats1.endgame)));
            const s2 = (poissonRandom(Math.max(1, stats2.auto)) +
                        poissonRandom(Math.max(1, stats2.teleop)) +
                        poissonRandom(Math.max(1, stats2.endgame)));
            return s1 + s2;
        }
        case 'bayesian': {
            const u1 = stats1.matchCount > 0 ? 1 / Math.sqrt(stats1.matchCount) : 0.5;
            const u2 = stats2.matchCount > 0 ? 1 / Math.sqrt(stats2.matchCount) : 0.5;
            const s1 = Math.max(0,
                stats1.auto * (1 + gaussianRandom() * u1 * 0.3) +
                stats1.teleop * (1 + gaussianRandom() * u1 * 0.3) +
                stats1.endgame * (1 + gaussianRandom() * u1 * 0.3));
            const s2 = Math.max(0,
                stats2.auto * (1 + gaussianRandom() * u2 * 0.3) +
                stats2.teleop * (1 + gaussianRandom() * u2 * 0.3) +
                stats2.endgame * (1 + gaussianRandom() * u2 * 0.3));
            return s1 + s2;
        }
        default: { // montecarlo
            const v = 0.2;
            const s1 = Math.max(0,
                stats1.auto * (1 + gaussianRandom() * v) +
                stats1.teleop * (1 + gaussianRandom() * v) +
                stats1.endgame * (1 + gaussianRandom() * v));
            const s2 = Math.max(0,
                stats2.auto * (1 + gaussianRandom() * v) +
                stats2.teleop * (1 + gaussianRandom() * v) +
                stats2.endgame * (1 + gaussianRandom() * v));
            return s1 + s2;
        }
    }
}

function runAllianceSimulation(stats1, stats2, model, iterations = 10000) {
    const scores = [];

    for (let i = 0; i < iterations; i++) {
        scores.push(simulateAllianceScore(stats1, stats2, model));
    }

    const mean = scores.reduce((a, b) => a + b, 0) / iterations;
    const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / iterations;
    const stdDev = Math.sqrt(variance);

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
        mean,
        stdDev,
        scores,
        histogram: histogram.map((count, i) => ({
            range: `${Math.round(min + i * binSize)}-${Math.round(min + (i + 1) * binSize)}`,
            count
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

async function fetchTeamData(teamNumber, season) {
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
            matchCount: 10,
            wins: 0,
            losses: 0,
            ties: 0
        };
    } catch (error) {
        throw new Error(`Failed to fetch team ${teamNumber}: ${error.message}`);
    }
}

// ─── MAIN PREDICTION FLOW ───────────────────────────

async function predictMatch() {
    const yourTeam1 = document.getElementById('yourTeam1').value.trim();
    const yourTeam2 = document.getElementById('yourTeam2').value.trim();
    const oppTeam1 = document.getElementById('oppTeam1').value.trim();
    const oppTeam2 = document.getElementById('oppTeam2').value.trim();
    const model = document.getElementById('mpModelSelect').value;
    const season = getAutoSeason('mpSeasonSelect');

    if (!yourTeam1 || !yourTeam2 || !oppTeam1 || !oppTeam2) {
        showError('Please enter all four team numbers');
        return;
    }

    hideError();
    hideResults();
    setLoading(true);

    try {
        const [yt1, yt2, ot1, ot2] = await Promise.all([
            fetchTeamData(yourTeam1, season),
            fetchTeamData(yourTeam2, season),
            fetchTeamData(oppTeam1, season),
            fetchTeamData(oppTeam2, season)
        ]);

        // Run simulations for both alliances
        const yourSim = runAllianceSimulation(yt1, yt2, model);
        const oppSim = runAllianceSimulation(ot1, ot2, model);

        // Monte Carlo win probability
        let yourWins = 0;
        const margins = [];
        for (let i = 0; i < 10000; i++) {
            const diff = yourSim.scores[i] - oppSim.scores[i];
            margins.push(diff);
            if (diff > 0) yourWins++;
        }

        const mcWinProb = (yourWins / 10000) * 100;

        // Elo ratings
        const yourElo1 = calculateElo(yt1);
        const yourElo2 = calculateElo(yt2);
        const oppElo1 = calculateElo(ot1);
        const oppElo2 = calculateElo(ot2);
        const yourAllianceElo = Math.round((yourElo1 + yourElo2) / 2);
        const oppAllianceElo = Math.round((oppElo1 + oppElo2) / 2);
        const eloProb = eloWinProbability(yourAllianceElo, oppAllianceElo) * 100;

        // Blend MC and Elo for final win probability
        const blendedYourWinProb = model === 'montecarlo'
            ? mcWinProb * 0.7 + eloProb * 0.3
            : mcWinProb;

        // Margin statistics
        const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
        const blowoutCount = margins.filter(m => m > 30).length;
        const nailbiterCount = margins.filter(m => Math.abs(m) <= 10).length;

        displayResults({
            yourAlliance: {
                team1: yt1,
                team2: yt2,
                mean: yourSim.mean,
                stdDev: yourSim.stdDev,
                histogram: yourSim.histogram,
                elo: yourAllianceElo
            },
            oppAlliance: {
                team1: ot1,
                team2: ot2,
                mean: oppSim.mean,
                stdDev: oppSim.stdDev,
                histogram: oppSim.histogram,
                elo: oppAllianceElo
            },
            prediction: {
                yourWinProb: blendedYourWinProb.toFixed(1),
                oppWinProb: (100 - blendedYourWinProb).toFixed(1),
                eloWinProb: eloProb.toFixed(1),
                expectedDifferential: (yourSim.mean - oppSim.mean).toFixed(1)
            },
            margin: {
                avg: avgMargin,
                blowoutPct: ((blowoutCount / 10000) * 100).toFixed(1),
                nailbiterPct: ((nailbiterCount / 10000) * 100).toFixed(1),
                data: margins
            },
            model
        });

    } catch (error) {
        console.error('Prediction error:', error);
        showError(error.message || 'Failed to run prediction');
    } finally {
        setLoading(false);
    }
}

// ─── DISPLAY ────────────────────────────────────────

function displayResults(data) {
    resultsSection.classList.remove('hidden');

    // Model badge
    const modelNames = {
        montecarlo: '🎲 Monte Carlo + Elo',
        poisson: '📊 Poisson Distribution',
        bayesian: '🔬 Bayesian Confidence'
    };
    document.getElementById('mpActiveModelBadge').textContent = modelNames[data.model] || 'Monte Carlo';

    // Elo ratings
    document.getElementById('yourElo').textContent = data.yourAlliance.elo;
    document.getElementById('oppElo').textContent = data.oppAlliance.elo;
    document.getElementById('eloWinProb').textContent = `${data.prediction.eloWinProb}%`;

    const yt1 = data.yourAlliance.team1, yt2 = data.yourAlliance.team2;
    const ot1 = data.oppAlliance.team1, ot2 = data.oppAlliance.team2;
    document.getElementById('yourRecord').textContent = `Est. via OPR`;
    document.getElementById('oppRecord').textContent = `Est. via OPR`;

    // Win probabilities
    document.getElementById('yourWinProb').textContent = `${data.prediction.yourWinProb}%`;
    document.getElementById('oppWinProb').textContent = `${data.prediction.oppWinProb}%`;

    // Expected scores
    document.getElementById('yourExpectedScore').textContent = Math.round(data.yourAlliance.mean);
    document.getElementById('yourScoreRange').textContent =
        `${Math.round(data.yourAlliance.mean - data.yourAlliance.stdDev)} – ${Math.round(data.yourAlliance.mean + data.yourAlliance.stdDev)}`;

    document.getElementById('oppExpectedScore').textContent = Math.round(data.oppAlliance.mean);
    document.getElementById('oppScoreRange').textContent =
        `${Math.round(data.oppAlliance.mean - data.oppAlliance.stdDev)} – ${Math.round(data.oppAlliance.mean + data.oppAlliance.stdDev)}`;

    // Team breakdowns
    document.getElementById('yourTeam1Name').textContent =
        `${yt1.name} (#${yt1.number})`;
    document.getElementById('yourTeam1OPR').textContent =
        `OPR: ${yt1.totalOPR.toFixed(1)}`;
    document.getElementById('yourTeam2Name').textContent =
        `${yt2.name} (#${yt2.number})`;
    document.getElementById('yourTeam2OPR').textContent =
        `OPR: ${yt2.totalOPR.toFixed(1)}`;

    document.getElementById('oppTeam1Name').textContent =
        `${ot1.name} (#${ot1.number})`;
    document.getElementById('oppTeam1OPR').textContent =
        `OPR: ${ot1.totalOPR.toFixed(1)}`;
    document.getElementById('oppTeam2Name').textContent =
        `${ot2.name} (#${ot2.number})`;
    document.getElementById('oppTeam2OPR').textContent =
        `OPR: ${ot2.totalOPR.toFixed(1)}`;

    // Margin of victory
    document.getElementById('avgMargin').textContent =
        `${data.margin.avg > 0 ? '+' : ''}${data.margin.avg.toFixed(1)}`;
    document.getElementById('blowoutChance').textContent = `${data.margin.blowoutPct}%`;
    document.getElementById('nailbiterChance').textContent = `${data.margin.nailbiterPct}%`;

    renderComparisonChart(data.yourAlliance.histogram, data.oppAlliance.histogram);
    renderMarginChart(data.margin.data);
    generateInsights(data);

    // Track analytics
    if (typeof gtag !== 'undefined') {
        gtag('event', 'match_prediction', {
            'event_category': 'engagement',
            'event_label': 'match_predictor',
            'win_probability': data.prediction.yourWinProb,
            'model': data.model
        });
    }

    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── CHARTS ─────────────────────────────────────────

function renderComparisonChart(yourHistogram, oppHistogram) {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    if (comparisonChart) comparisonChart.destroy();

    const labels = yourHistogram.map(d => d.range);

    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Your Alliance',
                    data: yourHistogram.map(d => d.count),
                    backgroundColor: 'rgba(34, 197, 94, 0.6)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Opponent Alliance',
                    data: oppHistogram.map(d => d.count),
                    backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 13 },
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'rectRounded'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#f1f5f9',
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                    borderWidth: 1,
                    padding: 14,
                    cornerRadius: 8,
                    titleFont: { family: 'Inter', size: 13, weight: '600' },
                    bodyFont: { family: 'Inter', size: 12 }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(99, 102, 241, 0.06)', drawBorder: false },
                    ticks: { color: '#64748b', font: { family: 'Inter', size: 10 }, maxRotation: 45, minRotation: 45 }
                },
                y: {
                    grid: { color: 'rgba(99, 102, 241, 0.06)', drawBorder: false },
                    ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
                    beginAtZero: true
                }
            }
        }
    });
}

function renderMarginChart(margins) {
    const ctx = document.getElementById('marginChart').getContext('2d');
    if (marginChart) marginChart.destroy();

    // Create margin histogram
    const bins = 30;
    const min = Math.min(...margins);
    const max = Math.max(...margins);
    const binSize = (max - min) / bins;

    const histogram = Array(bins).fill(0);
    margins.forEach(m => {
        const idx = Math.min(bins - 1, Math.floor((m - min) / binSize));
        histogram[idx]++;
    });

    const labels = histogram.map((_, i) => {
        const val = Math.round(min + i * binSize);
        return val > 0 ? `+${val}` : `${val}`;
    });

    // Color each bar: green for positive (your win), red for negative (opponent win)
    const bgColors = histogram.map((_, i) => {
        const midpoint = min + (i + 0.5) * binSize;
        if (midpoint > 5) return 'rgba(34, 197, 94, 0.6)';
        if (midpoint < -5) return 'rgba(239, 68, 68, 0.6)';
        return 'rgba(99, 102, 241, 0.5)';
    });

    marginChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Score Margin',
                data: histogram,
                backgroundColor: bgColors,
                borderColor: bgColors.map(c => c.replace('0.6', '1').replace('0.5', '1')),
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#f1f5f9',
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                    borderWidth: 1,
                    padding: 14,
                    cornerRadius: 8,
                    callbacks: {
                        title: (items) => {
                            const val = parseFloat(items[0].label);
                            return val > 0 ? `You win by ${Math.abs(val)}+` : `Opponent wins by ${Math.abs(val)}+`;
                        },
                        label: (context) => `Simulations: ${context.parsed.y.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(99, 102, 241, 0.06)', drawBorder: false },
                    ticks: { color: '#64748b', font: { family: 'Inter', size: 10 }, maxRotation: 45, minRotation: 45 }
                },
                y: {
                    grid: { color: 'rgba(99, 102, 241, 0.06)', drawBorder: false },
                    ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
                    beginAtZero: true
                }
            }
        }
    });
}

// ─── INSIGHTS ───────────────────────────────────────

function generateInsights(data) {
    const insights = [];

    const scoreDiff = data.yourAlliance.mean - data.oppAlliance.mean;
    const yourConsistency = data.yourAlliance.stdDev;
    const oppConsistency = data.oppAlliance.stdDev;

    // Elo insight
    const eloDiff = data.yourAlliance.elo - data.oppAlliance.elo;
    if (Math.abs(eloDiff) > 50) {
        insights.push({
            title: eloDiff > 0 ? 'Elo Advantage' : 'Elo Disadvantage',
            description: `Your alliance Elo (${data.yourAlliance.elo}) vs opponent (${data.oppAlliance.elo}). ${
                eloDiff > 0
                    ? `You have a ${eloDiff} point Elo advantage — historically strong performance.`
                    : `Opponent has a ${Math.abs(eloDiff)} point Elo advantage. Focus on execution.`
            }`
        });
    }

    if (Math.abs(scoreDiff) < 10) {
        insights.push({
            title: 'Close Match',
            description: `This is expected to be a very close match with only a ${Math.abs(scoreDiff).toFixed(1)} point difference. Execution is critical.`
        });
    } else if (scoreDiff > 0) {
        insights.push({
            title: 'Score Advantage',
            description: `Your alliance has an expected ${scoreDiff.toFixed(1)} point advantage. Maintain consistency to secure the win.`
        });
    } else {
        insights.push({
            title: 'Score Deficit',
            description: `Opponent has an expected ${Math.abs(scoreDiff).toFixed(1)} point advantage. Focus on execution and minimizing penalties.`
        });
    }

    if (yourConsistency < oppConsistency) {
        insights.push({
            title: 'Consistency Advantage',
            description: `Your alliance is more consistent (±${yourConsistency.toFixed(1)} vs ±${oppConsistency.toFixed(1)}). This makes your scores more predictable.`
        });
    } else {
        insights.push({
            title: 'Consistency Challenge',
            description: `Opponent alliance is more consistent (±${oppConsistency.toFixed(1)} vs ±${yourConsistency.toFixed(1)}). Focus on reliable strategies to reduce variability.`
        });
    }

    const yourAuto = data.yourAlliance.team1.auto + data.yourAlliance.team2.auto;
    const oppAuto = data.oppAlliance.team1.auto + data.oppAlliance.team2.auto;

    if (yourAuto > oppAuto + 5) {
        insights.push({
            title: 'Auto Advantage',
            description: `Your alliance is stronger in autonomous (+${(yourAuto - oppAuto).toFixed(1)} OPR). Ensure reliable execution of pre-programmed routes.`
        });
    } else if (oppAuto > yourAuto + 5) {
        insights.push({
            title: 'TeleOp Critical',
            description: `Opponent has auto advantage (+${(oppAuto - yourAuto).toFixed(1)} OPR). Make up ground in TeleOp where you can be more aggressive.`
        });
    }

    if (parseFloat(data.prediction.yourWinProb) > 70) {
        insights.push({
            title: 'Favorable Odds',
            description: `Strong win probability at ${data.prediction.yourWinProb}%. Focus on clean execution and avoiding penalties.`
        });
    } else if (parseFloat(data.prediction.yourWinProb) < 30) {
        insights.push({
            title: 'Underdog Position',
            description: `Win probability is at ${data.prediction.yourWinProb}%. Play aggressively and look for strategic advantages.`
        });
    } else {
        insights.push({
            title: 'Toss-Up Match',
            description: `This match is highly contested (${data.prediction.yourWinProb}% vs ${data.prediction.oppWinProb}%). Strategic decisions will decide the outcome.`
        });
    }

    const insightsContent = document.getElementById('insightsContent');
    insightsContent.innerHTML = insights.map(insight => `
        <div class="insight-item" style="padding-left: 16px; border-left: 3px solid var(--accent-blue);">
            <div class="insight-content">
                <h4 style="margin-bottom: 4px; font-weight: 600; color: var(--text-primary);">${escapeHTML(insight.title)}</h4>
                <p style="color: var(--text-secondary); font-size: 13px;">${escapeHTML(insight.description)}</p>
            </div>
        </div>
    `).join('');
}

// ─── UI HELPERS ─────────────────────────────────────

function setLoading(isLoading) {
    predictBtn.disabled = isLoading;
    if (isLoading) {
        btnText.textContent = 'Analyzing Match...';
        btnLoader.classList.remove('hidden');
    } else {
        btnText.textContent = 'Predict Match Outcome';
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