#  FTC Match Analysis Toolkit

**Created by Rolling Drones #10392**

A  suite of tools designed to help FIRST Tech Challenge teams make data driven strategic decisions during competitions. Built for the 2025-2026 DECODE season.

---

## What This Does

This toolkit helps your team:
- **Predict alliance performance** before matches using Monte Carlo simulations
- **Compare matchups** between your alliance and opponents in real-time
- **Build strategic pick lists** for alliance selection with intelligent ranking
- **Make informed decisions** based on OPR data and statistical analysis

All analysis runs **live in your browser** - no server setup required!

---

## Features

### Alliance Simulator
Simulate how two teams will perform together using Monte Carlo analysis.

**What it does:**
- Fetches live OPR data from FTC Scout
- Runs 10,000 simulations with realistic variance
- Shows expected score, consistency, and win probability
- Displays score distribution histogram

**Best for:**
- Evaluating potential alliance partners
- Understanding performance variability
- Setting realistic scoring targets

**How to use:**
1. Enter two team numbers
2. Set a target score (default: 200)
3. Click "Run Monte Carlo Simulation"
4. Review the expected score, standard deviation, and win probability

---

###  Match Predictor
Compare your alliance vs opponents before a match.

**What it does:**
- Analyzes both alliances simultaneously
- Calculates win probability for each side
- Provides strategic insights based on strengths/weaknesses
- Highlights auto vs teleop advantages

**Best for:**
- Pre-match strategy planning
- Identifying opponent weaknesses
- Understanding close matchups

**How to use:**
1. Enter your two team numbers
2. Enter opponent team numbers
3. Click "Predict Match Outcome"
4. Read the insights and adjust your strategy

---

### Pick List Builder
Generate intelligent pick lists for alliance selection.

**What it does:**
- Loads all teams from a specific event
- Ranks teams using a composite "Pick Score" algorithm
- Calculates Complementary Fit based on gaps in your team’s auto/teleop
- Computes Win Probability by simulating matches against all possible alliances (default 500 simulations per combination)
- Computes Event Win % by simulating a full playoffs tournament to the end for each potential pick (not reflected in pick score)
- Filters by OPR, consistency, and specialties
- Exports to CSV for team discussions

**Pick Score Formula:**
- 30% Total OPR - Raw team strength
- 40% Win Probability - % of simulations where the alliance meets or exceeds the dynamic event target score
- 20% Complementary Fit - How well they fill gaps in your auto/teleop
- 10% Consistency - Lower variance = more reliable

**Complementary Scoring:**
-Auto & Teleop gaps are compared between your team and the candidate
-Bigger gaps where your team is weak = more complementary points
-Well rounded teams (strong in both auto and teleop) get a bonus
-Teams below minimum thresholds in OPR are penalized (too weak to be valuable)


**Advanced Simulation Features:**
-Dynamic Target Score per event (adapts to average scores in that event)
-All-Alliances Monte Carlo: Simulates your alliance against all possible pairings of remaining teams
-Defense & Failure Modeling: Optional tier 2 improvements include correlated failures and auto/teleop role-based interactions
-Event Win %: Simulates full playoff tournaments to estimate the likelihood of winning the event if the candidate team is picked

**Best for:**
- Alliance selection preparation
- Identifying complementary partners
- Finding consistent performers vs high-ceiling teams
- Strategic scouting and data-driven decision making

**How to use:**
1. Enter event code (e.g., `USNYNYBRQ2`)
2. Optionally enter your team number for proper complementary analysis
3. Click "Load Event & Generate Pick List"
4. Use filters to find auto specialists, consistent teams, etc.
5. Export the list for your team's review
6. Optionally check the Event Win % column to see which teams increase your chances of winning the event


---

## Understanding the Metrics

### **OPR (Offensive Power Rating)**
- **Total OPR**: Overall contribution to alliance score
- **Auto OPR**: Points contributed during autonomous
- **TeleOp OPR**: Points contributed during driver-controlled period
- **Endgame OPR**: Points from parking

### **Consistency (Standard Deviation)**
- Lower = more predictable performance
- Higher = more variable (high ceiling, low floor)
- Important for alliance selection - do you want reliability or potential?

### **Win Probability**
- Percentage chance of beating a target score
- Based on 10,000 simulated matches
- Accounts for realistic variance in robot performance

### **Pick Score**
- Composite metric combining OPR, win probability, and consistency
- Used to rank teams in the Pick List Builder
- Higher is better for alliance selection

---

## Technical Details

### **Data Source**
All team statistics come from [FTC Scout](https://ftcscout.org) via their GraphQL API.

### **Simulation Method**
Uses Monte Carlo simulation with Gaussian (normal) distribution:
- Each game phase (auto/teleop/endgame) has ±20% variance
- 10,000 iterations per simulation for statistical accuracy
- Box-Muller transform for random number generation 

### **Privacy & Ethics**
- All data is publicly available through FTC Scout
- No personal information is collected or stored
- Educational use only - not for gambling or commercial purposes
- Complies with FIRST's Gracious Professionalism®

---

## Troubleshooting

**"Team not found" error:**
- Check team number is correct
- Verify team has competed in 2025 season
- Try a different team to test API connection

**No stats available:**
- Team may not have attended any 2025 events yet
- Some teams only have partial OPR data early in season

**Event code not working:**
- Use exact code from FTC Scout (e.g., `USNYNYBRQ2`)
- Code must be from 2025 season
- Check spelling carefully

**Slow performance:**
- Running 10,000 simulations takes 1-3 seconds (this is normal)
- Close other browser tabs
- Try a different browser (Chrome/Edge recommended)

---

##  Changelog

**Version 1.3 (Current)**
- Removed Event Dashboard (simplified toolkit)
- Updated navigation to 3 core tools
- Improved Pick List filtering
- Enhanced mobile responsiveness

**Version 1.2**
- Added specialist filters (auto/teleop/consistent)
- Improved Pick Score algorithm
- Better error handling

**Version 1.1**
- Added Match Predictor with insights
- Enhanced UI/UX
- Added export functionality

**Version 1.0**
- Initial release with Alliance Simulator
- Basic OPR integration
- Monte Carlo engine

---

##  Contributing & Feedback

This is a living project! Ideas for improvement:
- Additional statistical models
- Historical performance tracking
- Custom strategy recommendations

**Contact:** Through Rolling Drones #10392 Instagram

---

##  License & Credits

**Educational Use Only** • Non-Commercial

- **Data:** FTC Scout ([ftcscout.org](https://ftcscout.org))
- **Framework:** Vanilla JavaScript (no dependencies except Chart.js)
- **Math:** Monte Carlo simulation, Gaussian distributions
- **Design:** Custom CSS with dark theme

**FIRST® Tech Challenge** is a registered trademark of [FIRST](https://www.firstinspires.org)

Built with Gracious Professionalism® and Coopertition™

---

##  Learning Resources

Want to understand the math and code?

**Statistics Concepts:**
- [Monte Carlo Simulation](https://en.wikipedia.org/wiki/Monte_Carlo_method)
- [Normal Distribution](https://www.khanacademy.org/math/statistics-probability/modeling-distributions-of-data/normal-distributions-library)
- [Standard Deviation](https://www.khanacademy.org/math/statistics-probability/summarizing-quantitative-data)

**Programming Concepts:**
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [GraphQL Basics](https://graphql.org/learn/)
- [Box-Muller Transform](https://en.wikipedia.org/wiki/Box%E2%80%93Muller_transform)

**FTC Strategy:**
- [OPR Explained](https://blog.thebluealliance.com/2017/10/05/the-math-behind-opr-an-introduction/)
- [FTC Scout API](https://ftcscout.org)

---

##  Tips for Your Team

### **Before the Event:**
1. Research opponent OPRs from their previous competitions
2. Build a preliminary pick list based on registration
3. Identify 3-5 "must pick" alliance partners

### **During Qualification Matches:**
1. Use Match Predictor before each match
2. Adjust strategy based on win probability
3. Note which teams exceed/underperform their OPR

### **Alliance Selection:**
1. Refresh pick list with event-specific data
2. Consider consistency vs ceiling
3. Look for complementary strengths (your auto weakness = their auto strength)
4. Have backup picks ready

### **Elimination Matches:**
1. Simulate your alliance vs each opponent alliance
2. Identify their weakest phase (auto/teleop/endgame)
3. Plan defensive strategy accordingly

---

**Good luck at your competitions! 🏆**

*"In FIRST, you're competing against the problem, not each other."*

---

**Rolling Drones #10392** • FTC Team from Brooklyn, New York
