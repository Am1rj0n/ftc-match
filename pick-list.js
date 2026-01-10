/**
 * FTC Picklist Builder - Phase 4 (Full Tournament Monte Carlo + Event Win % with All Alliances)
 */

// Configuration
const FTCSCOUT_URL = 'https://api.ftcscout.org/graphql';
const DEFAULT_MONTE_CARLO_ITER = 500;
const EVENT_SIM_ITER = 100; // Number of tournaments to simulate

// State
let currentPickList = [];
let currentEvent = null;

// DOM Elements
const loadEventBtn = document.getElementById('loadEventBtn');
const loadBtnText = document.getElementById('loadBtnText');
const loadBtnLoader = document.getElementById('loadBtnLoader');
const errorPanel = document.getElementById('errorPanel');
const errorMessage = document.getElementById('errorMessage');
const resultsSection = document.getElementById('resultsSection');
const exportBtn = document.getElementById('exportBtn');
const applyFiltersBtn = document.getElementById('applyFilters');

// Event Listeners
loadEventBtn.addEventListener('click', loadEvent);
if (exportBtn) exportBtn.addEventListener('click', exportPickList);
if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', applyFiltersAndSort);

/** ---------------- MATH UTILITIES ---------------- */
function gaussianRandom() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** ---------------- COMPLEMENTARY SCORING ---------------- */
function calculateComplementary(yourStats, theirStats) {
    let score = 0;
    if (!yourStats || !theirStats || theirStats.totalOPR === 0) return 0;
    if (theirStats.totalOPR < 30) return 0;

    const autoGap = theirStats.auto - yourStats.auto;
    const teleopGap = theirStats.teleop - yourStats.teleop;

    if (autoGap > 0 && theirStats.auto >= 20) {
        if (yourStats.auto < 20) {
            if (autoGap >= 30) score += 40;
            else if (autoGap >= 20) score += 30;
            else if (autoGap >= 10) score += 20;
            else score += 10;
        } else {
            if (autoGap >= 20) score += 15;
            else if (autoGap >= 10) score += 8;
        }
    }

    if (teleopGap > 0 && theirStats.teleop >= 35) {
        if (yourStats.teleop < 40) {
            if (teleopGap >= 40) score += 40;
            else if (teleopGap >= 25) score += 30;
            else if (teleopGap >= 15) score += 20;
            else score += 10;
        } else {
            if (teleopGap >= 30) score += 15;
            else if (teleopGap >= 15) score += 8;
        }
    }

    if (theirStats.auto >= 25 && theirStats.teleop >= 40) {
        const bothBetter = autoGap > 0 && teleopGap > 0;
        if (bothBetter) {
            if (autoGap >= 15 && teleopGap >= 20) score += 20;
            else if (autoGap >= 10 && teleopGap >= 15) score += 15;
            else if (autoGap >= 5 && teleopGap >= 10) score += 10;
        } else {
            score += 5;
        }
    }

    return Math.min(score, 100);
}

/** ---------------- SIMULATE ALLIANCE SCORES ---------------- */
function simulateAllianceScore(teams) {
    return teams.reduce((total, team) => {
        const autoRand = gaussianRandom() * 0.15;
        const teleopRand = gaussianRandom() * 0.15;
        const endgameRand = gaussianRandom() * 0.15;
        return total + Math.max(0,
            team.auto * (1 + autoRand) +
            team.teleop * (1 + teleopRand) +
            (team.endgame || 0) * (1 + endgameRand)
        );
    }, 0);
}

/** ---------------- WIN PROBABILITY ---------------- */
function calculateWinProbability(yourStats, candidateStats, allTeams, targetScore, iterations = DEFAULT_MONTE_CARLO_ITER) {
    let winCount = 0;
    const opponents = allTeams.filter(t => t.number !== yourStats.number && t.number !== candidateStats.number);
    const opponentCombos = [];

    for (let i = 0; i < opponents.length; i++) {
        for (let j = i + 1; j < opponents.length; j++) {
            opponentCombos.push([opponents[i], opponents[j]]);
        }
    }

    opponentCombos.forEach(pair => {
        for (let k = 0; k < iterations; k++) {
            const ourScore = simulateAllianceScore([yourStats, candidateStats]);
            const oppScore = simulateAllianceScore(pair);
            if (ourScore >= oppScore && ourScore >= targetScore) winCount++;
        }
    });

    const totalSims = opponentCombos.length * iterations;
    return (winCount / totalSims) * 100;
}

/** ---------------- ALL POSSIBLE ALLIANCES ---------------- */
function getAllAlliances(teams) {
    const alliances = [];
    for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
            alliances.push([teams[i], teams[j]]);
        }
    }
    return alliances;
}

/** ---------------- EVENT WIN % SIMULATION (ALL ALLIANCES + Monte Carlo Tournaments) ---------------- */
function simulateFullEventWin(yourStats, candidateStats, allTeams) {
    const teams = allTeams.filter(t => t.number !== yourStats.number && t.number !== candidateStats.number);
    const selectedAlliance = [yourStats, candidateStats];
    const allAlliances = getAllAlliances(teams);

    let wins = 0;

    for (let t = 0; t < EVENT_SIM_ITER; t++) {
        // Pick 7 unique random alliances for tournament + our alliance
        const aliveAlliances = [selectedAlliance];
        const usedIndices = new Set();

        while (aliveAlliances.length < 8 && usedIndices.size < allAlliances.length) {
            const idx = Math.floor(Math.random() * allAlliances.length);
            if (!usedIndices.has(idx)) {
                aliveAlliances.push(allAlliances[idx]);
                usedIndices.add(idx);
            }
        }

        // Play single-elimination tournament
        let round = aliveAlliances;
        while (round.length > 1) {
            const nextRound = [];
            for (let i = 0; i < round.length; i += 2) {
                const a1 = round[i];
                const a2 = round[i + 1];
                if (!a2) { nextRound.push(a1); continue; }
                const score1 = simulateAllianceScore(a1);
                const score2 = simulateAllianceScore(a2);
                nextRound.push(score1 >= score2 ? a1 : a2);
            }
            round = nextRound;
        }

        if (round[0].includes(candidateStats)) wins++;
    }

    return (wins / EVENT_SIM_ITER) * 100;
}

/** ---------------- LOAD EVENT ---------------- */
async function loadEvent() {
    const eventCode = document.getElementById('eventCode').value.trim().toUpperCase();
    const yourTeamNum = document.getElementById('yourTeamNumber').value.trim();
    const season = 2025;

    if (!eventCode) { showError('Please enter an event code'); return; }

    hideError();
    hideResults();
    setLoading(true);

    const QUERY = `
    query GetEventData($code: String!, $season: Int!) {
        eventByCode(code: $code, season: $season) {
            name code teams {
                teamNumber
                team {
                    name
                    quickStats(season: $season) { tot { value } auto { value } dc { value } }
                }
            }
        }
    }`;

    try {
        const response = await fetch(FTCSCOUT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: QUERY, variables: { code: eventCode, season } })
        });
        const result = await response.json();
        const event = result.data?.eventByCode;
        if (!event) throw new Error("Event not found");

        currentEvent = { name: event.name, code: event.code };

        const teamsData = event.teams.map(t => ({
            number: t.teamNumber,
            name: t.team?.name || "Unknown",
            totalOPR: t.team?.quickStats?.tot?.value || 0,
            auto: t.team?.quickStats?.auto?.value || 0,
            teleop: t.team?.quickStats?.dc?.value || 0,
            consistency: Math.max(5, 20 - (t.team?.quickStats?.tot?.value * 0.1) + (Math.random() * 5))
        }));

        const yourStats = teamsData.find(t => t.number === parseInt(yourTeamNum)) || { auto: 0, teleop: 0, totalOPR: 0, consistency: 15, number: parseInt(yourTeamNum) || 0 };

        const avgOPR = teamsData.reduce((a,b)=>a+b.totalOPR,0)/teamsData.length;
        const targetScore = avgOPR * 2;

        currentPickList = teamsData.filter(t => t.number !== parseInt(yourTeamNum))
            .map(team => {
                const winProb = calculateWinProbability(yourStats, team, teamsData, targetScore);
                const complementary = calculateComplementary(yourStats, team);
                const pickScore = (team.totalOPR * 0.3) + (winProb * 0.4) + (complementary * 0.2) + ((25 - team.consistency) * 0.5);
                const eventWinPercent = simulateFullEventWin(yourStats, team, teamsData);
                return { ...team, winProb, complementary, pickScore, eventWinPercent };
            })
            .sort((a,b)=>b.pickScore - a.pickScore)
            .map((t,i)=>({ ...t, pickOrder:i+1 }));

        displayResults();

    } catch(err) { showError(err.message); }
    finally { setLoading(false); }
}

/** ---------------- DISPLAY, FILTERS, EXPORT ---------------- */
// (same as your previous code, no changes needed)


/** ---------------- DISPLAY RESULTS ---------------- */
function displayResults() {
    resultsSection.classList.remove('hidden');
    document.getElementById('eventName').textContent = currentEvent.name;
    document.getElementById('eventCode2').textContent = `Code: ${currentEvent.code}`;
    document.getElementById('teamCount').textContent = `${currentPickList.length} teams found`;

    renderTable(currentPickList);

    if (typeof gtag !== 'undefined') {
        gtag('event', 'picklist_generated', {
            'event_category':'engagement',
            'event_label':'pick_list_builder',
            'event_code':currentEvent.code,
            'team_count':currentPickList.length
        });
    }
}

/** ---------------- RENDER TABLE ---------------- */
function renderTable(list) {
    const tbody = document.getElementById('pickListBody');
    tbody.innerHTML = '';

    list.forEach((team, index) => {
        const row = document.createElement('tr');
        row.className = 'pick-list-row';

        // Pick Score color coding
        let scoreClass = 'tier-c';
        if (team.pickScore > 75) scoreClass = 'tier-s';
        else if (team.pickScore > 60) scoreClass = 'tier-a';
        else if (team.pickScore > 45) scoreClass = 'tier-b';

        // Complementary color coding
        let compClass = '';
        if (team.complementary >= 60) compClass = 'tier-s';
        else if (team.complementary >= 40) compClass = 'tier-a';
        else if (team.complementary >= 20) compClass = 'tier-b';
        else compClass = 'tier-c';

        row.innerHTML = `
            <td class="pick-order">#${index + 1}</td>
            <td><strong>${team.number}</strong><br><small>${team.name}</small></td>
            <td><strong>${team.eventWinPercent !== undefined ? team.eventWinPercent.toFixed(0) + '%' : '—'}</strong></td>
            <td class="pick-score ${scoreClass}"><strong>${team.pickScore.toFixed(1)}</strong></td>
            <td>${team.totalOPR.toFixed(1)}</td>
            <td>${team.auto.toFixed(1)}</td>
            <td>${team.teleop.toFixed(1)}</td>
            <td class="${compClass}"><strong>${team.complementary.toFixed(0)}</strong></td>
            <td>${team.consistency.toFixed(1)}</td>
            <td>
                <button class="btn-small" onclick="window.open('https://ftcscout.org/teams/${team.number}','_blank')">Stats</button>
            </td>
        `;

        tbody.appendChild(row);
    });
}


/** ---------------- FILTERS ---------------- */
function applyFiltersAndSort() {
    const sortBy = document.getElementById('sortBy').value;
    const minOPR = parseFloat(document.getElementById('minOPR').value) || 0;
    const strengthFilter = document.getElementById('strengthFilter').value;

    let filtered = currentPickList.filter(team => {
        if (team.totalOPR < minOPR) return false;
        if (strengthFilter==='auto') return (team.auto / team.totalOPR > 0.4) && team.auto >= 25;
        if (strengthFilter==='teleop') return (team.teleop / team.totalOPR > 0.6) && team.teleop >= 40;
        if (strengthFilter==='consistent') return team.consistency<15 && team.totalOPR>=30;
        return true;
    });

    filtered.sort((a,b)=>{
        switch(sortBy){
            case 'opr': return b.totalOPR - a.totalOPR;
            case 'autoOPR': return b.auto - a.auto;
            case 'dcOPR': return b.teleop - a.teleop;
            case 'consistency': return a.consistency - b.consistency;
            case 'winRate': return b.winProb - a.winProb;
            case 'complementary': return b.complementary - a.complementary;
            case 'rank': return a.pickOrder - b.pickOrder;
            default: return b.pickScore - a.pickScore;
        }
    });

    renderTable(filtered);
}

/** ---------------- UI HELPERS ---------------- */
function setLoading(isLoading) {
    loadEventBtn.disabled = isLoading;
    loadBtnText.textContent = isLoading ? 'Analyzing Event Data...' : 'Load Event & Generate Pick List';
    loadBtnLoader.classList.toggle('hidden', !isLoading);
}

function showError(msg) { errorMessage.textContent=msg; errorPanel.classList.remove('hidden'); }
function hideError() { errorPanel.classList.add('hidden'); }
function hideResults() { resultsSection.classList.add('hidden'); }

/** ---------------- EXPORT CSV ---------------- */
function exportPickList() {
    let csv = "Rank,Team,PickScore,OPR,Auto,Teleop,Complementary,Consistency,EventWin%\n";
    currentPickList.forEach((t,i)=>{
        csv+=`${i+1},${t.number},${t.pickScore.toFixed(1)},${t.totalOPR.toFixed(1)},${t.auto.toFixed(1)},${t.teleop.toFixed(1)},${t.complementary.toFixed(0)},${t.consistency.toFixed(1)},${t.eventWinPercent.toFixed(0)}\n`;
    });
    const blob = new Blob([csv],{type:'text/csv'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url;
    a.download=`FTC_Picklist_${currentEvent.code}.csv`;
    a.click();
}
