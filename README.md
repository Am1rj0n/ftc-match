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
- Auto & Teleop gaps are compared between your team and the candidate
- Bigger gaps where your team is weak = more complementary points
- Well rounded teams (strong in both auto and teleop) get a bonus
- Teams below minimum thresholds in OPR are penalized (too weak to be valuable)

**Event Win %**
- Runs 100 simulations of entire tournament in event with your candidate and alliance with every other possible alliance and comes up with how many % if those won the tournament. 7% = 7 instances.


**Advanced Simulation Features:**
- Dynamic Target Score per event (adapts to average scores in that event)
- All-Alliances Monte Carlo: Simulates your alliance against all possible pairings of remaining teams
- Defense & Failure Modeling: Optional tier 2 improvements include correlated failures and auto/teleop role-based interactions
- Event Win %: Simulates full playoff tournaments to estimate the likelihood of winning the event if the candidate team is picked

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

## ⚖️ Privacy & Ethics
- **Data Policy:** All data is publicly available through the FTC Scout API. No personal information is collected, stored, or transmitted by this toolkit.
- **Usage:** This tool is intended for educational and strategic use by FIRST Tech Challenge teams. It is not for commercial use or gambling.
- **Gracious Professionalism:** We encourage teams to use this data to improve their own strategies and support their partners, in the spirit of Gracious Professionalism® and Coopertition™.

---

## 🛠️ Troubleshooting

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

### Team History & Progression
Track a team's performance across multiple seasons and events.

**What it does:**
- Fetches multi-year OPR data and event statistics.
- Visualizes progression with interactive charts (OPR, Auto, Teleop, NP OPR).
- Provides direct links to FTCScout event details.
- Includes "No Penalty" (NP) point analysis for the most recent seasons.

**Best for:**
- Long-term scouting and trend analysis.
- Understanding if a team is improving or declining over a season.
- Recruiting and historical research.

**How to use:**
1. Enter a team number.
2. View the event-by-event progression chart.
3. Scroll through the detailed event list with per-event OPR breakdowns.

---

## 🔒 Security & Performance

### **Safety First**
- **XSS Protection:** Implemented a global HTML escaping layer to prevent cross-site scripting from untrusted API data.
- **CSRF Mitigation:** Secure request patterns for all external API interactions.

### **Search Optimization (SEO)**
- Fully optimized for search engines with dynamic page titles, OpenGraph metadata, and standard sitemaps.
- Discord and Social Media ready: High-quality link previews with embedded branding.
- Created by **Rolling Drones 10392**.

---

## 🛠️ Statistical Models & Technical Details

### **Available Models**
The Match Predictor allows you to choose from several advanced statistical models:

- **🎲 Monte Carlo (Gaussian):** Our flagship model. It runs 10,000 simulations using a Normal (Gaussian) distribution with a ±20% variance across all game phases. It provides the most realistic spread of possible match outcomes.
- **📊 Poisson Distribution:** Ideal for modeling the frequency of scoring events. It treats each point as an independent event, which can be more accurate for predicting high-variability individual tasks.
- **🔬 Bayesian Confidence:** This model incorporates "uncertainty." If a team has only played 1-2 matches, the model increases the prediction variance (uncertainty). As more data is gathered, the confidence interval narrows.
- **⚖️ Weighted Elo Integration:** In Monte Carlo mode, we blend raw OPR data with historical Elo ratings (30% weight) to account for a team's long-term competitive track record beyond just their current season statistics.

### **Data & Methodology**
- **Data Source:** All team statistics come from the [FTC Scout](https://ftcscout.org) GraphQL API.
- **Simulation Engine:** Written in pure JavaScript using the Box-Muller transform for high-performance Gaussian random number generation.
- **No Penalty (NP) Analytics:** We prioritize "No Penalty" scores for the 2024 and 2025 seasons to ensure our predictions aren't skewed by outlier matches with heavy foul points.

## Changelog

**Version 2.0 (Current)**
- **New Module:** Team History & Multi-Year Progression.
- **Security:** Global `escapeHTML` mitigation and security hardening.
- **SEO & Branding:** Full OpenGraph stack, dynamic titles, and custom brand assets.
- **UI Modernization:** Apple-inspired Glassmorphism design system across all tools.
- **Feature:** "No Penalty" (NP) point integration for progression tracking.

**Version 1.3**
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
