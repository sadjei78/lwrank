export class UIManager {
    constructor() {
        this.activeTab = null;
    }

    toggleAdminFeatures(isAdmin) {
        console.log('Toggling admin features:', isAdmin);
        const adminControls = document.getElementById('adminControls');
        if (adminControls) {
            adminControls.style.display = isAdmin ? 'flex' : 'none';
            console.log('Admin controls display set to:', adminControls.style.display);
        } else {
            console.error('Admin controls element not found');
        }
    }

    createRankingTable(rankings, displayName, top10Occurrences = {}, cumulativeScores = {}) {
        if (!rankings || rankings.length === 0) {
            return `<div class="no-data">No ranking data available for Daily Rankings - ${displayName}</div>`;
        }

        const sortedRankings = [...rankings].sort((a, b) => a.ranking - b.ranking);
        const top10 = sortedRankings.slice(0, 10);
        const bottom20 = sortedRankings.slice(-20);
        const hasGap = sortedRankings.length > 30;
        
        const gapStart = top10[top10.length - 1]?.ranking + 1;
        const gapEnd = bottom20[0]?.ranking - 1;

        let html = `
            <h2>Daily Rankings - ${this.escapeHTML(displayName)}</h2>
            <div style="margin-bottom: 15px; color: #666; font-style: italic;">
                Showing top 10 and bottom 20 ranks (${sortedRankings.length} total entries)
            </div>
            <table class="ranking-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Commander</th>
                        <th>Points</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Add top 10
        top10.forEach(rank => {
            const commander = rank.commander;
            const isTop10Multiple = top10Occurrences[commander];
            const isTop5Cumulative = cumulativeScores[commander];
            const cumulativeScore = isTop5Cumulative ? cumulativeScores[commander] : null;
            
            let rowClass = '';
            
            if (isTop5Cumulative) {
                rowClass = 'cumulative-top5';
            }
            
            const top10Indicator = isTop10Multiple ? ` <span class="top10-indicator" title="Appears in top 10 ${isTop10Multiple} times this week">*${isTop10Multiple}</span>` : '';
            const cumulativeIndicator = isTop5Cumulative ? ` <span class="cumulative-indicator" title="Weekly cumulative score">★${cumulativeScore}</span>` : '';
            
            html += `
                <tr class="${rowClass}">
                    <td class="rank-number">#${this.escapeHTML(rank.ranking.toString())}</td>
                    <td>${this.escapeHTML(commander)}${top10Indicator}${cumulativeIndicator}</td>
                    <td class="points">${this.escapeHTML(rank.points)}</td>
                </tr>
            `;
        });

        // Add gap indicator if needed
        if (hasGap && gapStart <= gapEnd) {
            html += `
                <tr style="background: #f0f0f0; font-style: italic; text-align: center;">
                    <td colspan="3" style="padding: 20px; color: #666; border-top: 2px dashed #ccc; border-bottom: 2px dashed #ccc;">
                        ... ${gapEnd - gapStart + 1} ranks omitted (${this.escapeHTML(gapStart.toString())} - ${this.escapeHTML(gapEnd.toString())}) ...
                    </td>
                </tr>
            `;
        }

        // Add bottom 20
        bottom20.forEach(rank => {
            const commander = rank.commander;
            const isTop10Multiple = top10Occurrences[commander];
            const isTop5Cumulative = cumulativeScores[commander];
            const cumulativeScore = isTop5Cumulative ? cumulativeScores[commander] : null;
            
            let rowClass = '';
            
            if (isTop5Cumulative) {
                rowClass = 'cumulative-top5';
            }
            
            const top10Indicator = isTop10Multiple ? ` <span class="top10-indicator" title="Appears in top 10 ${isTop10Multiple} times this week">*${isTop10Multiple}</span>` : '';
            const cumulativeIndicator = isTop5Cumulative ? ` <span class="cumulative-indicator" title="Weekly cumulative score">★${cumulativeScore}</span>` : '';
            
            html += `
                <tr class="${rowClass}">
                    <td class="rank-number">#${this.escapeHTML(rank.ranking.toString())}</td>
                    <td>${this.escapeHTML(commander)}${top10Indicator}${cumulativeIndicator}</td>
                    <td class="points">${this.escapeHTML(rank.points)}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        
        // Add legend if there are any indicators
        const hasTop10Indicators = Object.keys(top10Occurrences).length > 0;
        const hasCumulativeTop5 = Object.keys(cumulativeScores).length > 0;
        
        if (hasTop10Indicators || hasCumulativeTop5) {
            html += `
                <div class="ranking-legend" style="margin-top: 20px; padding: 20px; background: #ffffff; border-radius: 12px; border: 2px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
                    <h4 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px; font-weight: 600;">Legend</h4>
                    <div style="display: flex; gap: 30px; flex-wrap: wrap; font-size: 14px; color: #374151;">
            `;
            
            if (hasTop10Indicators) {
                html += `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="top10-indicator">*2</span>
                        <span style="font-weight: 500;">Appears in top 10 multiple times this week</span>
                    </div>
                `;
            }
            
            if (hasCumulativeTop5) {
                html += `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 20px; height: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 4px; border: 1px solid #e5e7eb;"></div>
                        <span style="font-weight: 500;">Top 5 cumulative score for the week</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="cumulative-indicator">★1500</span>
                        <span style="font-weight: 500;">Weekly cumulative score indicator</span>
                    </div>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    showError(message) {
        const tabContentsContainer = document.getElementById('tabContents');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.innerHTML = `<strong>Error:</strong> ${this.escapeHTML(message)}`;
        
        // Replace loading content or add to existing content
        const existingContent = tabContentsContainer.innerHTML;
        if (existingContent.includes('loading')) {
            tabContentsContainer.innerHTML = '';
        }
        tabContentsContainer.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 10000);
    }

    showSuccess(message) {
        const tabContentsContainer = document.getElementById('tabContents');
        const successDiv = document.createElement('div');
        successDiv.className = 'success';
        successDiv.innerHTML = `<strong>Success:</strong> ${this.escapeHTML(message)}`;
        tabContentsContainer.appendChild(successDiv);
        
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 5000);
    }

    escapeHTML(str) {
        return str.replace(/[&<>"']/g, function(m) {
            return ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[m];
        });
    }

    updateConnectionStatus(status) {
        const header = document.querySelector('.header p');
        if (header) {
            const statusIndicator = status.includes('database') ? '🌐' : '💾';
            header.innerHTML = `Upload CSV files to manage daily rankings<br><small style="opacity: 0.8;">${statusIndicator} ${status}</small>`;
        }
    }
}