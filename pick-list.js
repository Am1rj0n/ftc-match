// Configuration
const FTC_EVENTS_API = 'https://ftc-api.firstinspires.org/v2.0';

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
const applyFilters = document.getElementById('applyFilters');

// Event Listeners
loadEventBtn.addEventListener('click', loadEvent);
exportBtn.addEventListener('click', exportPickList);
applyFilters.addEventListener('click', applyFiltersAndSort);

document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadEvent();
    });
});

async function fetchTeamStatsFromScout(teamNumber, season = 2025) {
    const query = `
        query GetTeamStats($teamNumber: Int!, $season: Int!) {
            teamByNumber(number: $teamNumber) {
                number
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
            total: stats.tot.value,
            auto: stats.auto?.value || stats.tot.value * 0.25,
            dc: stats.dc?.value || stats.tot.value * 0.55
        };
    } catch (err) {
        console.error(`Failed to fetch team ${teamNumber}:`, err);
        return null;
    }
}

async function loadEvent() {
    const eventCode = document.getElementById('eventCode').value.trim().toUpperCase();
    const yourTeam = document.getElementById('yourTeamNumber').value.trim();
    const season = 2025;

    if (!eventCode) {
        showError('Please enter an event code');
        return;
    }

    hideError();
    hideResults();
    setLoading(true);

    try {
        // Step 1: Get event info from FTC Events API
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
        currentEvent = {
            name: event.name,
            code: event.code
        };

        // Step 2: Get teams at event from FTC Events API
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

        // Step 3: Get rankings from FTC Events API
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

        // Step 4: Get OPR stats from FTCScout for each team
        const teamNumbers = teamsData.teams.map(t => t.teamNumber);
        const statsPromises = teamNumbers.map(num => fetchTeamStatsFromScout(num, season));
        const allStats = await Promise.all(statsPromises);

        // Merge data
        const teamsWithData = [];
        for (let i = 0; i < teamNumbers.length; i++) {
            const teamNum = teamNumbers[i];
            const stats = allStats[i];
            const ranking = rankings.find(r => r.team?.teamNumber === teamNum);
            
            if (stats) {
                teamsWithData.push({
                    teamNumber: teamNum,
                    opr: stats,
                    rank: ranking?.rank || null,
                    wins: ranking?.wins || 0,
                    losses: ranking?.losses || 0,
                    ties: ranking?.ties || 0,
                    rp: ranking?.rankingPoints || 0,
                    consistency: 15
                });
            }
        }

        if (teamsWithData.length === 0) {
            throw new Error('No team stats available for this event');
        }

        // Calculate pick scores
        const yourTeamData = yourTeam ? teamsWithData.find(t => t.teamNumber === parseInt(yourTeam)) : null;
        
        currentPickList = teamsWithData
            .filter(team => !yourTeam || team.teamNumber !== parseInt(yourTeam))
            .map(team => {
                let complementaryBonus = 0;
                if (yourTeamData) {
                    if (yourTeamData.opr.auto < 20 && team.opr.auto > 20) complementaryBonus += 15;
                    if (yourTeamData.opr.dc < 40 && team.opr.dc > 40) complementaryBonus += 15;
                }

                const consistencyScore = Math.max(0, 100 - team.consistency);
                const totalMatches = team.wins + team.losses + team.ties;
                const winRate = totalMatches > 0 ? (team.wins / totalMatches * 100) : 0;

                const pickScore = (
                    team.opr.total * 0.5 +
                    complementaryBonus * 0.2 +
                    consistencyScore * 0.2 +
                    winRate * 0.1
                );

                return {
                    ...team,
                    pickScore: pickScore,
                    complementaryScore: complementaryBonus,
                    winRate: winRate
                };
            })
            .sort((a, b) => b.pickScore - a.pickScore)
            .map((team, i) => ({ ...team, pickOrder: i + 1 }));

        displayResults({ event: currentEvent, pickList: currentPickList });
        
    } catch (error) {
        console.error('Load error:', error);
        showError(error.message || 'Failed to load event data');
    } finally {
        setLoading(false);
    }
}

function displayResults(data) {
    resultsSection.classList.remove('hidden');

    document.getElementById('eventName').textContent = data.event.name;
    document.getElementById('eventCode2').textContent = `Code: ${data.event.code}`;
    document.getElementById('teamCount').textContent = `${data.pickList.length} teams competing`;

    renderPickList(data.pickList);
    
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderPickList(pickList) {
    const tbody = document.getElementById('pickListBody');
    tbody.innerHTML = '';

    pickList.forEach(team => {
        const row = document.createElement('tr');
        row.className = 'pick-list-row';
        
        let scoreClass = '';
        if (team.pickScore >= 80) scoreClass = 'tier-s';
        else if (team.pickScore >= 60) scoreClass = 'tier-a';
        else if (team.pickScore >= 40) scoreClass = 'tier-b';
        else scoreClass = 'tier-c';

        row.innerHTML = `
            <td class="pick-order ${scoreClass}">${team.pickOrder}</td>
            <td class="team-number"><strong>${team.teamNumber}</strong></td>
            <td>${team.rank || '-'}</td>
            <td class="pick-score ${scoreClass}"><strong>${team.pickScore.toFixed(1)}</strong></td>
            <td>${team.opr.total.toFixed(1)}</td>
            <td>${team.opr.auto.toFixed(1)}</td>
            <td>${team.opr.dc.toFixed(1)}</td>
            <td>${team.wins}-${team.losses}-${team.ties}</td>
            <td class="consistency">${team.consistency.toFixed(1)}</td>
            <td>
                <button class="btn-small" onclick="window.open('https://ftcscout.org/teams/${team.teamNumber}', '_blank')">
                    Details
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

function applyFiltersAndSort() {
    const sortBy = document.getElementById('sortBy').value;
    const minOPR = parseFloat(document.getElementById('minOPR').value) || 0;
    const strengthFilter = document.getElementById('strengthFilter').value;

    let filtered = currentPickList.filter(team => {
        if (team.opr.total < minOPR) return false;
        if (strengthFilter === 'auto' && team.opr.auto < 20) return false;
        if (strengthFilter === 'teleop' && team.opr.dc < 40) return false;
        if (strengthFilter === 'consistent' && team.consistency > 30) return false;
        return true;
    });

    filtered.sort((a, b) => {
        switch(sortBy) {
            case 'opr': return b.opr.total - a.opr.total;
            case 'consistency': return a.consistency - b.consistency;
            case 'autoOPR': return b.opr.auto - a.opr.auto;
            case 'dcOPR': return b.opr.dc - a.opr.dc;
            case 'winRate': return b.winRate - a.winRate;
            case 'rank': return (a.rank || 999) - (b.rank || 999);
            default: return b.pickScore - a.pickScore;
        }
    });

    filtered.forEach((team, i) => {
        team.pickOrder = i + 1;
    });

    renderPickList(filtered);
}

function exportPickList() {
    const eventName = currentEvent.name;
    const timestamp = new Date().toISOString().split('T')[0];
    
    let csv = 'Pick Order,Team Number,Rank,Pick Score,Total OPR,Auto OPR,TeleOp OPR,Wins,Losses,Consistency\n';
    
    const tbody = document.getElementById('pickListBody');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const pickOrder = cells[0].textContent;
        const teamNumber = cells[1].textContent;
        const rank = cells[2].textContent;
        const pickScore = cells[3].textContent;
        const totalOPR = cells[4].textContent;
        const autoOPR = cells[5].textContent;
        const teleopOPR = cells[6].textContent;
        const record = cells[7].textContent.split('-');
        const wins = record[0];
        const losses = record[1];
        const consistency = cells[8].textContent;
        
        csv += `${pickOrder},${teamNumber},${rank},${pickScore},${totalOPR},${autoOPR},${teleopOPR},${wins},${losses},${consistency}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pick_list_${currentEvent.code}_${timestamp}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

function setLoading(isLoading) {
    loadEventBtn.disabled = isLoading;
    if (isLoading) {
        loadBtnText.textContent = 'Loading Event Data...';
        loadBtnLoader.classList.remove('hidden');
    } else {
        loadBtnText.textContent = 'Load Event & Generate Pick List';
        loadBtnLoader.classList.add('hidden');
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