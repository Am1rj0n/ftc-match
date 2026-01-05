// Shared Navigation Component
function createNavigation(currentPage) {
    const nav = document.createElement('nav');
    nav.className = 'main-nav';
    
    const navItems = [
        { id: 'phase1', label: 'Alliance Simulator', page: 'index.html' },
        { id: 'phase2', label: 'Match Predictor', page: 'match-predictor.html' },
        { id: 'phase3', label: 'Pick List Builder', page: 'pick-list.html' },
        { id: 'phase4', label: 'Event Dashboard', page: 'event-dashboard.html' }
    ];
    
    nav.innerHTML = `
        <div class="nav-container">
            <div class="nav-brand">
                <span class="nav-title">FTC MATCH</span>
            </div>
            <div class="nav-links">
                ${navItems.map(item => `
                    <a href="${item.page}" 
                       class="nav-link ${currentPage === item.id ? 'active' : ''}"
                       data-page="${item.id}">
                        <span class="nav-label">${item.label}</span>
                    </a>
                `).join('')}
            </div>
        </div>
    `;
    
    return nav;
}

// Insert navigation at the top of the page
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = document.body.dataset.page;
    const navElement = createNavigation(currentPage);
    document.body.insertBefore(navElement, document.body.firstChild);
});