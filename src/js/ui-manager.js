export class UIManager {
    constructor() {
        this.activeTab = null;
        this.leaderVIPManager = null;
        this.rankingManager = null;
    }

    setLeaderVIPManager(manager) {
        this.leaderVIPManager = manager;
    }

    setRankingManager(manager) {
        this.rankingManager = manager;
    }

    toggleAdminFeatures(isAdmin) {
        console.log('Toggling admin features:', isAdmin);
        
        // Update admin status display
        const adminStatus = document.getElementById('adminStatus');
        if (adminStatus) {
            adminStatus.style.display = isAdmin ? 'flex' : 'none';
        }
        
        // Update admin tab if it exists
        const adminTab = document.querySelector('.tab[data-type="admin"]');
        if (adminTab) {
            adminTab.style.display = isAdmin ? 'block' : 'none';
        }
        
        // Update admin tab content if it exists
        const adminTabContent = document.getElementById('adminTab');
        if (adminTabContent) {
            adminTabContent.style.display = isAdmin ? 'block' : 'none';
        }
        
        console.log('Admin features toggled:', isAdmin);
    }

    createRankingTable(rankings, displayName, top10Occurrences = {}, bottom20Occurrences = {}, cumulativeScores = {}, isSpecialEvent = false, date = null) {
        if (!rankings || rankings.length === 0) {
            return `<div class="no-data">No ranking data available for Daily Rankings - ${displayName}</div>`;
        }

        const sortedRankings = [...rankings].sort((a, b) => a.ranking - b.ranking);
        
        let html = '';
        
        if (isSpecialEvent) {
            // For special events, show all rankings (no train conductor needed)
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
            const commander = rank.commander;
            const isRemoved = this.rankingManager && this.rankingManager.isPlayerRemoved(commander);
            const removedClass = isRemoved ? 'player-removed' : '';
            const leaderIndicator = this.leaderVIPManager && this.leaderVIPManager.isAllianceLeader(commander) 
                ? ' <span class="leader-indicator" title="Alliance Leader">👑</span>' : '';
            const vipIndicator = this.leaderVIPManager && date && this.leaderVIPManager.isVIPForWeek(commander, new Date(date))
                ? ' <span class="vip-badge" title="VIP for this week">⭐</span>' : '';
            
            html += `
                <tr>
                    <td class="rank-number">#${this.escapeHTML(rank.ranking.toString())}</td>
                    <td class="${removedClass}">${this.escapeHTML(commander)}${leaderIndicator}${vipIndicator}</td>
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
                ${this.createTrainConductorVIPDisplay(date)}
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
                const isRemoved = this.rankingManager && this.rankingManager.isPlayerRemoved(commander);
                const removedClass = isRemoved ? 'player-removed' : '';
                const isTop10Multiple = top10Occurrences[commander];
                const isTop5Cumulative = cumulativeScores[commander];
                const cumulativeScore = isTop5Cumulative ? cumulativeScores[commander] : null;
                
                let rowClass = '';
                
                if (isTop5Cumulative) {
                    rowClass = 'cumulative-top5';
                }
                
                const top10Indicator = isTop10Multiple ? ` <span class="top10-indicator" title="Appears in top 10 ${isTop10Multiple} times this week">*${isTop10Multiple}</span>` : '';
                const cumulativeIndicator = isTop5Cumulative ? ` <span class="cumulative-indicator" title="Weekly cumulative score">★${this.formatNumber(cumulativeScore)}</span>` : '';
                const leaderIndicator = this.leaderVIPManager && this.leaderVIPManager.isAllianceLeader(commander) 
                    ? ' <span class="leader-indicator" title="Alliance Leader">👑</span>' : '';
                const vipIndicator = this.leaderVIPManager && date && this.leaderVIPManager.isVIPForWeek(commander, new Date(date))
                    ? ' <span class="vip-badge" title="VIP for this week">⭐</span>' : '';
                
            html += `
                    <tr class="${rowClass}">
                    <td class="rank-number">#${this.escapeHTML(rank.ranking.toString())}</td>
                        <td class="${removedClass}">${this.escapeHTML(commander)}${top10Indicator}${cumulativeIndicator}${leaderIndicator}${vipIndicator}</td>
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
                const isRemoved = this.rankingManager && this.rankingManager.isPlayerRemoved(commander);
                const removedClass = isRemoved ? 'player-removed' : '';
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
                const leaderIndicator = this.leaderVIPManager && this.leaderVIPManager.isAllianceLeader(commander) 
                    ? ' <span class="leader-indicator" title="Alliance Leader">👑</span>' : '';
                const vipIndicator = this.leaderVIPManager && date && this.leaderVIPManager.isVIPForWeek(commander, new Date(date))
                    ? ' <span class="vip-badge" title="VIP for this week">⭐</span>' : '';
                
            html += `
                    <tr class="${rowClass}">
                    <td class="rank-number">#${this.escapeHTML(rank.ranking.toString())}</td>
                        <td class="${removedClass}">${this.escapeHTML(commander)}${top10Indicator}${bottom20Indicator}${cumulativeIndicator}${leaderIndicator}${vipIndicator}</td>
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
            const hasLeaderIndicators = this.leaderVIPManager && this.leaderVIPManager.allianceLeaders.length > 0;
            const hasVIPIndicators = this.leaderVIPManager && date && this.leaderVIPManager.getVIPForDate(new Date(date));
            
            if (hasTop10Indicators || hasBottom20Indicators || hasCumulativeTop5 || hasLeaderIndicators || hasVIPIndicators) {
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

                if (hasLeaderIndicators) {
                    html += `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="leader-indicator">👑</span>
                            <span style="font-weight: 500;">Alliance Leader</span>
                        </div>
                    `;
                }

                if (hasVIPIndicators) {
                    html += `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="vip-badge">⭐</span>
                            <span style="font-weight: 500;">VIP for this week</span>
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

    showInfo(message) {
        const tabContentsContainer = document.getElementById('tabContents');
        const infoDiv = document.createElement('div');
        infoDiv.className = 'info';
        infoDiv.innerHTML = `<strong>Info:</strong> ${this.escapeHTML(message)}`;
        tabContentsContainer.appendChild(infoDiv);
        
        setTimeout(() => {
            if (infoDiv.parentNode) {
                infoDiv.remove();
            }
        }, 4000);
    }

    escapeHTML(str) {
        // Handle null, undefined, or non-string values
        if (str == null) return '';
        if (typeof str !== 'string') return String(str);
        
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

    // Helper method to format train time for display
    formatTrainTime(trainTime) {
        if (!trainTime) return '4:00 AM';
        
        const timeMap = {
            '04:00:00': '4:00 AM',
            '12:00:00': '12:00 PM',
            '20:00:00': '8:00 PM'
        };
        
        return timeMap[trainTime] || trainTime;
    }

    // Create train conductor and VIP display for individual day tabs
    createTrainConductorVIPDisplay(date) {
        if (!this.leaderVIPManager || !date) {
            console.log('createTrainConductorVIPDisplay: Missing leaderVIPManager or date', { 
                hasLeaderVIPManager: !!this.leaderVIPManager, 
                date: date 
            });
            return '';
        }
        
        try {
            console.log('createTrainConductorVIPDisplay: Processing date', date);
            
            // Validate date before creating new Date object
            const dateObj = new Date(date);
            if (isNaN(dateObj.getTime())) {
                console.error('createTrainConductorVIPDisplay: Invalid date provided:', date);
                return '';
            }
            
            const trains = this.leaderVIPManager.getVIPForDate(dateObj);
            
            console.log('createTrainConductorVIPDisplay: Results', { trains });
            
            if (!trains || trains.length === 0) {
                console.log('createTrainConductorVIPDisplay: No trains found for date', date);
                return '';
            }
            
            let html = '<div class="day-tab-conductor-info">';
            
            // Display each train with its conductor and VIP
            trains.forEach((train, index) => {
                const trainNumber = index + 1;
                html += `<div class="train-entry">`;
                html += `<div class="conductor-badge">🚂 <strong>Train ${trainNumber} Conductor:</strong> ${this.escapeHTML(train.train_conductor)}</div>`;
                html += `<div class="vip-badge">⭐ <strong>Train ${trainNumber} VIP:</strong> ${this.escapeHTML(train.vip_player)}</div>`;
                html += `</div>`;
            });
            
            html += '</div>';
            console.log('createTrainConductorVIPDisplay: Generated HTML', html);
            return html;
        } catch (error) {
            console.error('Error creating train conductor VIP display:', error);
            return '';
        }
    }
}