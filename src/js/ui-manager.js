export class UIManager {
    constructor() {
        this.activeTab = null;
    }

    toggleAdminFeatures(isAdmin) {
        console.log('Toggling admin features:', isAdmin);
        const adminControls = document.getElementById('adminControls');
        const adminStatus = document.getElementById('adminStatus');
        
        if (adminControls) {
            adminControls.style.display = isAdmin ? 'flex' : 'none';
            console.log('Admin controls display set to:', adminControls.style.display);
        } else {
            console.error('Admin controls element not found');
        }
        
        if (adminStatus) {
            adminStatus.style.display = isAdmin ? 'flex' : 'none';
        }
    }

    createRankingTable(rankings, displayName, top10Occurrences = {}, bottom20Occurrences = {}, cumulativeScores = {}, isSpecialEvent = false) {
        if (!rankings || rankings.length === 0) {
            return `<div class="no-data">No ranking data available for Daily Rankings - ${displayName}</div>`;
        }

        const sortedRankings = [...rankings].sort((a, b) => a.ranking - b.ranking);
        
        let html = '';
        
        if (isSpecialEvent) {
            // For special events, show all rankings
            html = `
                <h2>Special Event: ${this.escapeHTML(displayName)}</h2>
                <div style="margin-bottom: 15px; color: #666; font-style: italic;">
                    Showing all ${sortedRankings.length} rankings
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
            
            // Add all rankings for special events
            sortedRankings.forEach(rank => {
                html += `
                    <tr>
                        <td class="rank-number">#${this.escapeHTML(rank.ranking.toString())}</td>
                        <td>${this.escapeHTML(rank.commander)}</td>
                        <td class="points">${this.escapeHTML(this.formatNumber(rank.points))}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
        } else {
            // For regular daily rankings, ALWAYS show top 10 and bottom 20 with gap
        const top10 = sortedRankings.slice(0, 10);
        const bottom20 = sortedRankings.slice(-20);
        const hasGap = sortedRankings.length > 30;
        
        const gapStart = top10[top10.length - 1]?.ranking + 1;
        const gapEnd = bottom20[0]?.ranking - 1;

            html = `
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
                const cumulativeIndicator = isTop5Cumulative ? ` <span class="cumulative-indicator" title="Weekly cumulative score">★${this.formatNumber(cumulativeScore)}</span>` : '';
                
            html += `
                    <tr class="${rowClass}">
                    <td class="rank-number">#${this.escapeHTML(rank.ranking.toString())}</td>
                        <td>${this.escapeHTML(commander)}${top10Indicator}${cumulativeIndicator}</td>
                        <td class="points">${this.escapeHTML(this.formatNumber(rank.points))}</td>
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
                const isBottom20Multiple = bottom20Occurrences[commander];
                const isTop5Cumulative = cumulativeScores[commander];
                const cumulativeScore = isTop5Cumulative ? cumulativeScores[commander] : null;
                
                let rowClass = '';
                
                if (isTop5Cumulative) {
                    rowClass = 'cumulative-top5';
                }
                
                const top10Indicator = isTop10Multiple ? ` <span class="top10-indicator" title="Appears in top 10 ${isTop10Multiple} times this week">*${isTop10Multiple}</span>` : '';
                const bottom20Indicator = isBottom20Multiple ? ` <span class="bottom20-indicator" title="Appears in bottom 20 ${isBottom20Multiple} times this week">*${isBottom20Multiple}</span>` : '';
                const cumulativeIndicator = isTop5Cumulative ? ` <span class="cumulative-indicator" title="Weekly cumulative score">★${this.formatNumber(cumulativeScore)}</span>` : '';
                
            html += `
                    <tr class="${rowClass}">
                    <td class="rank-number">#${this.escapeHTML(rank.ranking.toString())}</td>
                        <td>${this.escapeHTML(commander)}${top10Indicator}${bottom20Indicator}${cumulativeIndicator}</td>
                        <td class="points">${this.escapeHTML(this.formatNumber(rank.points))}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        }
        
        // Add legend only for regular daily rankings (not special events)
        if (!isSpecialEvent) {
            const hasTop10Indicators = Object.keys(top10Occurrences).length > 0;
            const hasBottom20Indicators = Object.keys(bottom20Occurrences).length > 0;
            const hasCumulativeTop5 = Object.keys(cumulativeScores).length > 0;
            
            if (hasTop10Indicators || hasBottom20Indicators || hasCumulativeTop5) {
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
                
                if (hasBottom20Indicators) {
                    html += `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="bottom20-indicator">*2</span>
                            <span style="font-weight: 500;">Appears in bottom 20 multiple times this week</span>
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
                            <span class="cumulative-indicator">★${this.formatNumber(1500)}</span>
                            <span>Weekly cumulative score indicator</span>
                        </div>
                    `;
                }
                
                html += `
                        </div>
                    </div>
                `;
            }
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

    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            const indicator = statusElement.querySelector('.status-indicator');
            const text = statusElement.querySelector('.status-text');
            
            if (status.isOnline) {
                indicator.style.background = '#10b981';
                text.textContent = status.status;
            } else {
                indicator.style.background = '#f59e0b';
                text.textContent = status.status;
            }
        }
    }

    showImportConfirmation(rankings, dateKey, displayDate, existingData) {
        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            `;

            // Get sample records
            const sortedRankings = [...rankings].sort((a, b) => a.ranking - b.ranking);
            const top5 = sortedRankings.slice(0, 5);
            const bottom3 = sortedRankings.slice(-3);
            const hasExistingData = existingData && existingData.length > 0;

            // Create modal content
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: white;
                border-radius: 12px;
                padding: 24px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            `;

            modal.innerHTML = `
                <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                    Confirm CSV Import
                </h3>
                
                <div style="margin-bottom: 16px; color: #374151;">
                    Import <strong>${rankings.length} rankings</strong> for <strong>${displayDate}</strong>?
                </div>
                
                ${hasExistingData ? `
                    <div style="margin-bottom: 16px; padding: 12px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; color: #92400e;">
                        ⚠️  <strong>Warning:</strong> This will overwrite ${existingData.length} existing rankings for this date.
                    </div>
                ` : ''}
                
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; color: #374151; font-size: 14px; font-weight: 600;">Sample Records:</h4>
                    
                    <div style="margin-bottom: 12px;">
                        <div style="font-weight: 600; color: #059669; margin-bottom: 4px;">Top 5:</div>
                        ${top5.map(rank => `
                            <div style="padding: 4px 8px; background: #f0fdf4; border-radius: 4px; margin-bottom: 2px; font-size: 13px;">
                                #${rank.ranking} - ${rank.commander} (${this.formatNumber(rank.points)} points)
                            </div>
                        `).join('')}
                    </div>
                    
                    ${bottom3.length > 0 && bottom3[0] !== top5[top5.length - 1] ? `
                        <div>
                            <div style="font-weight: 600; color: #dc2626; margin-bottom: 4px;">Bottom 3:</div>
                            ${bottom3.map(rank => `
                                <div style="padding: 4px 8px; background: #fef2f2; border-radius: 4px; margin-bottom: 2px; font-size: 13px;">
                                    #${rank.ranking} - ${rank.commander} (${this.formatNumber(rank.points)} points)
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="cancelImport" style="
                        padding: 8px 16px;
                        border: 1px solid #d1d5db;
                        background: white;
                        color: #374151;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Cancel</button>
                    <button id="confirmImport" style="
                        padding: 8px 16px;
                        border: none;
                        background: #059669;
                        color: white;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                    ">Import Data</button>
                </div>
            `;

            // Add event listeners
            modal.querySelector('#cancelImport').addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(false);
            });

            modal.querySelector('#confirmImport').addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(true);
            });

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    resolve(false);
                }
            });

            // Add to DOM
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        });
    }
}