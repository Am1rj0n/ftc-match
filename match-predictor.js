// DOM Elements
const predictBtn = document.getElementById('predictBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const errorPanel = document.getElementById('errorPanel');
const errorMessage = document.getElementById('errorMessage');
const resultsSection = document.getElementById('resultsSection');

// Chart instance
let comparisonChart = null;

// Event Listeners
predictBtn.addEventListener('click', predictMatch);

document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            predictMatch();
        }
    });
});

// CLIENT-SIDE MONTE CARLO SIMULATION - FIXED
function runMonteCarloSimulation(stats1, stats2, iterations = 10000) {
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
        mean: mean,
        stdDev: stdDev,
        scores: scores,
        histogram: histogram.map((count, i) => ({
            range: `${Math.round(min + i * binSize)}-${Math.round(min + (i + 1) * binSize)}`,
            count: count
        }))
    };
}

// Gaussian random number generator (Box-Muller transform)
function gaussianRandom() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
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

async function predictMatch() {
    const yourTeam1 = document.getElementById('yourTeam1').value.trim();
    const yourTeam2 = document.getElementById('yourTeam2').value.trim();
    const oppTeam1 = document.getElementById('oppTeam1').value.trim();
    const oppTeam2 = document.getElementById('oppTeam2').value.trim();

    if (!yourTeam1 || !yourTeam2 || !oppTeam1 || !oppTeam2) {
        showError('Please enter all four team numbers');
        return;
    }

    hideError();
    hideResults();
    setLoading(true);

    try {
        const [yt1, yt2, ot1, ot2] = await Promise.all([
            fetchTeamData(yourTeam1),
            fetchTeamData(yourTeam2),
            fetchTeamData(oppTeam1),
            fetchTeamData(oppTeam2)
        ]);
        
        // Run CLIENT-SIDE Monte Carlo simulations for both alliances
        const yourSim = runMonteCarloSimulation(yt1, yt2);
        const oppSim = runMonteCarloSimulation(ot1, ot2);
        
        // Calculate win probability by comparing actual score distributions
        let yourWins = 0;
        for (let i = 0; i < 10000; i++) {
            if (yourSim.scores[i] > oppSim.scores[i]) yourWins++;
        }
        
        const yourWinProb = (yourWins / 10000) * 100;
        const oppWinProb = 100 - yourWinProb;
        
        displayResults({
            yourAlliance: {
                team1: yt1,
                team2: yt2,
                mean: yourSim.mean,
                stdDev: yourSim.stdDev,
                histogram: yourSim.histogram
            },
            oppAlliance: {
                team1: ot1,
                team2: ot2,
                mean: oppSim.mean,
                stdDev: oppSim.stdDev,
                histogram: oppSim.histogram
            },
            prediction: {
                yourWinProb: yourWinProb.toFixed(1),
                oppWinProb: oppWinProb.toFixed(1),
                expectedDifferential: (yourSim.mean - oppSim.mean).toFixed(1)
            }
        });
        
    } catch (error) {
        console.error('Prediction error:', error);
        showError(error.message || 'Failed to run prediction');
    } finally {
        setLoading(false);
    }
}

function displayResults(data) {
    resultsSection.classList.remove('hidden');

    document.getElementById('yourWinProb').textContent = `${data.prediction.yourWinProb}%`;
    document.getElementById('oppWinProb').textContent = `${data.prediction.oppWinProb}%`;

    document.getElementById('yourExpectedScore').textContent = Math.round(data.yourAlliance.mean);
    document.getElementById('yourScoreRange').textContent = 
        `${Math.round(data.yourAlliance.mean - data.yourAlliance.stdDev)} - ${Math.round(data.yourAlliance.mean + data.yourAlliance.stdDev)}`;
    
    document.getElementById('oppExpectedScore').textContent = Math.round(data.oppAlliance.mean);
    document.getElementById('oppScoreRange').textContent = 
        `${Math.round(data.oppAlliance.mean - data.oppAlliance.stdDev)} - ${Math.round(data.oppAlliance.mean + data.oppAlliance.stdDev)}`;

    document.getElementById('yourTeam1Name').textContent = 
        `${data.yourAlliance.team1.name} (#${data.yourAlliance.team1.number})`;
    document.getElementById('yourTeam1OPR').textContent = 
        `OPR: ${data.yourAlliance.team1.totalOPR.toFixed(1)}`;
    
    document.getElementById('yourTeam2Name').textContent = 
        `${data.yourAlliance.team2.name} (#${data.yourAlliance.team2.number})`;
    document.getElementById('yourTeam2OPR').textContent = 
        `OPR: ${data.yourAlliance.team2.totalOPR.toFixed(1)}`;

    document.getElementById('oppTeam1Name').textContent = 
        `${data.oppAlliance.team1.name} (#${data.oppAlliance.team1.number})`;
    document.getElementById('oppTeam1OPR').textContent = 
        `OPR: ${data.oppAlliance.team1.totalOPR.toFixed(1)}`;
    
    document.getElementById('oppTeam2Name').textContent = 
        `${data.oppAlliance.team2.name} (#${data.oppAlliance.team2.number})`;
    document.getElementById('oppTeam2OPR').textContent = 
        `OPR: ${data.oppAlliance.team2.totalOPR.toFixed(1)}`;

    renderComparisonChart(data.yourAlliance.histogram, data.oppAlliance.histogram);
    generateInsights(data);

    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderComparisonChart(yourHistogram, oppHistogram) {
    const ctx = document.getElementById('comparisonChart').getContext('2d');

    if (comparisonChart) {
        comparisonChart.destroy();
    }

    const labels = yourHistogram.map(d => d.range);

    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Your Alliance',
                    data: yourHistogram.map(d => d.count),
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Opponent Alliance',
                    data: oppHistogram.map(d => d.count),
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1
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
                        color: '#e5e7eb',
                        font: { size: 14 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#e5e7eb',
                    bodyColor: '#e5e7eb',
                    borderColor: '#374151',
                    borderWidth: 1,
                    padding: 12
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
                        font: { size: 11 },
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

function generateInsights(data) {
    const insights = [];
    
    const scoreDiff = data.yourAlliance.mean - data.oppAlliance.mean;
    const yourConsistency = data.yourAlliance.stdDev;
    const oppConsistency = data.oppAlliance.stdDev;
    
    if (Math.abs(scoreDiff) < 10) {
        insights.push({
            icon: '⚖️',
            title: 'Close Match',
            description: `This is expected to be a very close match with only a ${Math.abs(scoreDiff).toFixed(1)} point difference. Every point matters!`
        });
    } else if (scoreDiff > 0) {
        insights.push({
            icon: '📈',
            title: 'Score Advantage',
            description: `Your alliance has an expected ${scoreDiff.toFixed(1)} point advantage. Maintain consistency to secure the win.`
        });
    } else {
        insights.push({
            icon: '📉',
            title: 'Score Deficit',
            description: `Opponent has an expected ${Math.abs(scoreDiff).toFixed(1)} point advantage. Focus on execution and minimizing penalties.`
        });
    }
    
    if (yourConsistency < oppConsistency) {
        insights.push({
            icon: '🎯',
            title: 'Consistency Advantage',
            description: `Your alliance is more consistent (±${yourConsistency.toFixed(1)} vs ±${oppConsistency.toFixed(1)}). This makes your scores more predictable.`
        });
    } else {
        insights.push({
            icon: '⚠️',
            title: 'Consistency Challenge',
            description: `Opponent alliance is more consistent. Focus on reliable strategies to reduce variability.`
        });
    }
    
    const yourAuto = data.yourAlliance.team1.auto + data.yourAlliance.team2.auto;
    const oppAuto = data.oppAlliance.team1.auto + data.oppAlliance.team2.auto;
    
    if (yourAuto > oppAuto + 5) {
        insights.push({
            icon: '🚀',
            title: 'Auto Advantage',
            description: `Your alliance is stronger in autonomous (+${(yourAuto - oppAuto).toFixed(1)} OPR). Execute your auto routine perfectly.`
        });
    } else if (oppAuto > yourAuto + 5) {
        insights.push({
            icon: '🎮',
            title: 'TeleOp Critical',
            description: `Opponent has auto advantage. Make up ground in TeleOp where you can be more aggressive.`
        });
    }
    
    if (data.prediction.yourWinProb > 70) {
        insights.push({
            icon: '✅',
            title: 'Favorable Odds',
            description: `Strong win probability. Focus on clean execution and avoiding penalties to secure the win.`
        });
    } else if (data.prediction.yourWinProb < 30) {
        insights.push({
            icon: '💪',
            title: 'Underdog Position',
            description: `You're the underdog. Play aggressively, capitalize on opponent mistakes, and execute flawlessly.`
        });
    } else {
        insights.push({
            icon: '🎲',
            title: 'Toss-Up Match',
            description: `This match could go either way. Small mistakes or great plays will decide the outcome.`
        });
    }
    
    const insightsContent = document.getElementById('insightsContent');
    insightsContent.innerHTML = insights.map(insight => `
        <div class="insight-item">
            <div class="insight-icon">${insight.icon}</div>
            <div class="insight-content">
                <h4>${insight.title}</h4>
                <p>${insight.description}</p>
            </div>
        </div>
    `).join('');
}

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