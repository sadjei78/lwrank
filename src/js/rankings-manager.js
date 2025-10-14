/**
 * Rankings Management Page
 * Handles uploading screenshots, OCR processing, and managing ranking data
 */

import { OCRService } from './ocr-service.js';
import { supabase } from './supabase-client.js';

export class RankingsManager {
    constructor() {
        this.ocrService = new OCRService();
        this.currentDate = new Date().toISOString().split('T')[0];
        this.existingPlayers = [];
        this.extractedData = [];
        
        this.init();
    }

    async init() {
        await this.loadExistingPlayers();
        this.setupEventListeners();
        this.render();
    }

    /**
     * Load existing player names from database for matching
     */
    async loadExistingPlayers() {
        try {
            const { data, error } = await supabase
                .from('rankings')
                .select('commander')
                .not('commander', 'is', null);
            
            if (error) throw error;
            
            // Get unique player names
            this.existingPlayers = [...new Set(data.map(item => item.commander))];
        } catch (error) {
            console.error('Error loading existing players:', error);
            this.existingPlayers = [];
        }
    }

    /**
     * Setup event listeners for the rankings page
     */
    setupEventListeners() {
        // File upload
        const fileInput = document.getElementById('rankingImageUpload');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // Date picker
        const dateInput = document.getElementById('rankingDate');
        if (dateInput) {
            dateInput.addEventListener('change', (e) => {
                this.currentDate = e.target.value;
            });
        }

        // Submit button
        const submitBtn = document.getElementById('submitRankings');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitRankings());
        }

        // Re-upload button
        const reuploadBtn = document.getElementById('reuploadImage');
        if (reuploadBtn) {
            reuploadBtn.addEventListener('click', () => this.resetUpload());
        }

        // Player search
        const searchInput = document.getElementById('playerSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterPlayers(e.target.value));
        }

        // Search button
        const searchBtn = document.getElementById('searchPlayer');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const searchTerm = document.getElementById('playerSearch').value;
                this.filterPlayers(searchTerm);
            });
        }
    }

    /**
     * Render the rankings management page
     */
    render() {
        const container = document.getElementById('rankingsTab');
        if (!container) return;

        container.innerHTML = `
            <div class="rankings-container">
                <div class="rankings-header">
                    <h2>📊 Rankings Management</h2>
                    <p>Upload screenshots to extract and manage ranking data</p>
                </div>

                <div class="rankings-content">
                    <!-- Upload Section -->
                    <div class="upload-section">
                        <div class="upload-area" id="uploadArea">
                            <div class="upload-content">
                                <div class="upload-icon">📷</div>
                                <h3>Upload Ranking Screenshot</h3>
                                <p>Drag and drop your screenshot here or click to browse</p>
                                <input type="file" id="rankingImageUpload" accept="image/*" style="display: none;">
                                <button type="button" class="upload-btn" onclick="document.getElementById('rankingImageUpload').click()">
                                    Choose File
                                </button>
                            </div>
                        </div>
                        
                        <div class="date-selector">
                            <label for="rankingDate">Ranking Date:</label>
                            <input type="date" id="rankingDate" value="${this.currentDate}" class="date-input">
                        </div>
                    </div>

                    <!-- Processing Section -->
                    <div class="processing-section" id="processingSection" style="display: none;">
                        <div class="processing-content">
                            <div class="loading-spinner"></div>
                            <p>Processing image and extracting data...</p>
                        </div>
                    </div>

                    <!-- Results Section -->
                    <div class="results-section" id="resultsSection" style="display: none;">
                        <div class="results-header">
                            <h3>Extracted Data Preview</h3>
                            <div class="results-actions">
                                <button id="reuploadImage" class="btn secondary">Re-upload Image</button>
                                <button id="submitRankings" class="btn primary">Submit Rankings</button>
                            </div>
                        </div>
                        
                        <div class="extracted-data" id="extractedData">
                            <!-- Extracted data will be populated here -->
                        </div>
                    </div>

                    <!-- Player Search Section -->
                    <div class="player-search-section">
                        <h3>🔍 Player Search & Performance</h3>
                        <div class="search-controls">
                            <div class="search-input-group">
                                <input type="text" id="playerSearch" placeholder="Search for a player..." class="search-input">
                                <button id="searchPlayer" class="search-btn">Search</button>
                            </div>
                        </div>
                        
                        <div class="player-results" id="playerResults">
                            <!-- Player search results will be populated here -->
                        </div>
                    </div>

                    <!-- 30-Day Performance Section -->
                    <div class="performance-section">
                        <h3>📈 30-Day Performance View</h3>
                        <div class="performance-controls">
                            <select id="performancePlayer" class="player-select">
                                <option value="">Select a player to view performance...</option>
                            </select>
                        </div>
                        
                        <div class="performance-chart" id="performanceChart">
                            <!-- Performance chart will be rendered here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        this.populatePlayerSelect();
    }

    /**
     * Handle file upload
     */
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showMessage('Please upload a valid image file.', 'error');
            return;
        }

        // Show processing section
        this.showProcessing();

        try {
            // Process image with OCR
            this.extractedData = await this.ocrService.processImage(file);
            
            // Check if any data was extracted
            if (!this.extractedData || this.extractedData.length === 0) {
                this.showMessage('No ranking data could be extracted from the image. You can manually enter the data below.', 'warning');
                // Initialize with empty data for manual entry
                this.extractedData = [];
            }
            
            // Show results
            this.showResults();
            this.renderExtractedData();
            
        } catch (error) {
            console.error('Error processing image:', error);
            this.showMessage('Error processing image. Please try again.', 'error');
            this.hideProcessing();
        }
    }

    /**
     * Show processing section
     */
    showProcessing() {
        document.getElementById('processingSection').style.display = 'block';
        document.getElementById('resultsSection').style.display = 'none';
    }

    /**
     * Hide processing section
     */
    hideProcessing() {
        document.getElementById('processingSection').style.display = 'none';
    }

    /**
     * Show results section
     */
    showResults() {
        document.getElementById('processingSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'block';
    }

    /**
     * Render extracted data for review
     */
    renderExtractedData() {
        const container = document.getElementById('extractedData');
        if (!container) return;

        // If no data extracted, show manual entry form
        if (!this.extractedData || this.extractedData.length === 0) {
            container.innerHTML = `
                <div class="manual-entry-section">
                    <h4>📝 Manual Data Entry</h4>
                    <p>No data was extracted from the image. You can manually enter the ranking data below:</p>
                    
                    <div class="manual-entry-form">
                        <div class="form-row">
                            <label>Number of Rankings:</label>
                            <input type="number" id="numRankings" min="1" max="100" value="10" class="form-input">
                            <button type="button" id="generateRows" class="btn primary">Generate Rows</button>
                        </div>
                    </div>
                    
                    <div class="data-table" id="manualDataTable" style="display: none;">
                        <div class="table-header">
                            <div class="col-ranking">Ranking</div>
                            <div class="col-commander">Commander</div>
                            <div class="col-points">Points</div>
                            <div class="col-actions">Actions</div>
                        </div>
                        <div class="table-body" id="manualTableBody">
                            <!-- Manual entry rows will be generated here -->
                        </div>
                    </div>
                </div>
            `;
            
            // Setup manual entry event listeners
            this.setupManualEntryListeners();
            return;
        }

        // Render extracted data normally
        container.innerHTML = `
            <div class="data-table">
                <div class="table-header">
                    <div class="col-ranking">Ranking</div>
                    <div class="col-commander">Commander</div>
                    <div class="col-points">Points</div>
                    <div class="col-actions">Actions</div>
                </div>
                <div class="table-body">
                    ${this.extractedData.map((item, index) => `
                        <div class="table-row" data-index="${index}">
                            <div class="col-ranking">
                                <span class="ranking-number">${item.ranking}</span>
                            </div>
                            <div class="col-commander">
                                <div class="commander-input-group">
                                    <input type="text" 
                                           value="${item.commander}" 
                                           class="commander-input" 
                                           data-index="${index}"
                                           readonly>
                                    <button type="button" 
                                            class="edit-commander-btn" 
                                            onclick="rankingsManager.editCommander(${index})">
                                        ✏️
                                    </button>
                                </div>
                                <div class="commander-suggestions" id="suggestions-${index}" style="display: none;">
                                    <!-- Suggestions will be populated here -->
                                </div>
                            </div>
                            <div class="col-points">
                                <span class="points-value">${this.formatPoints(item.points)}</span>
                            </div>
                            <div class="col-actions">
                                <button type="button" 
                                        class="btn small danger" 
                                        onclick="rankingsManager.removeRow(${index})">
                                    Remove
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Setup manual entry event listeners
     */
    setupManualEntryListeners() {
        const generateBtn = document.getElementById('generateRows');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateManualRows());
        }
    }

    /**
     * Generate manual entry rows
     */
    generateManualRows() {
        const numRankings = parseInt(document.getElementById('numRankings').value) || 10;
        const tableBody = document.getElementById('manualTableBody');
        const dataTable = document.getElementById('manualDataTable');
        
        if (!tableBody || !dataTable) return;

        // Initialize extractedData array
        this.extractedData = [];
        
        // Generate rows
        let rowsHTML = '';
        for (let i = 1; i <= numRankings; i++) {
            this.extractedData.push({
                ranking: i,
                commander: '',
                points: '',
                isValid: false
            });
            
            rowsHTML += `
                <div class="table-row" data-index="${i-1}">
                    <div class="col-ranking">
                        <span class="ranking-number">${i}</span>
                    </div>
                    <div class="col-commander">
                        <div class="commander-input-group">
                            <input type="text" 
                                   placeholder="Enter player name" 
                                   class="commander-input" 
                                   data-index="${i-1}">
                            <button type="button" 
                                    class="edit-commander-btn" 
                                    onclick="rankingsManager.editCommander(${i-1})">
                                ✏️
                            </button>
                        </div>
                        <div class="commander-suggestions" id="suggestions-${i-1}" style="display: none;">
                            <!-- Suggestions will be populated here -->
                        </div>
                    </div>
                    <div class="col-points">
                        <input type="text" 
                               placeholder="Enter points" 
                               class="points-input" 
                               data-index="${i-1}">
                    </div>
                    <div class="col-actions">
                        <button type="button" 
                                class="btn small danger" 
                                onclick="rankingsManager.removeRow(${i-1})">
                            Remove
                        </button>
                    </div>
                </div>
            `;
        }
        
        tableBody.innerHTML = rowsHTML;
        dataTable.style.display = 'block';
        
        // Setup input event listeners for manual entry
        this.setupManualInputListeners();
    }

    /**
     * Setup manual input event listeners
     */
    setupManualInputListeners() {
        // Commander name inputs
        document.querySelectorAll('.commander-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (this.extractedData[index]) {
                    this.extractedData[index].commander = e.target.value;
                }
            });
        });
        
        // Points inputs
        document.querySelectorAll('.points-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (this.extractedData[index]) {
                    this.extractedData[index].points = e.target.value.replace(/,/g, '');
                }
            });
        });
    }

    /**
     * Edit commander name with suggestions
     */
    editCommander(index) {
        const input = document.querySelector(`[data-index="${index}"]`);
        const suggestions = document.getElementById(`suggestions-${index}`);
        
        if (!input || !suggestions) return;

        // Make input editable
        input.removeAttribute('readonly');
        input.focus();

        // Get current value
        const currentValue = input.value;
        
        // Find similar names
        const similarNames = this.ocrService.findSimilarNames(currentValue, this.existingPlayers);
        
        if (similarNames.length > 0) {
            suggestions.innerHTML = `
                <div class="suggestions-header">Similar players found:</div>
                ${similarNames.map(sim => `
                    <div class="suggestion-item" onclick="rankingsManager.selectCommander(${index}, '${sim.name}')">
                        ${sim.name} <span class="confidence">(${Math.round(sim.confidence * 100)}% match)</span>
                    </div>
                `).join('')}
            `;
            suggestions.style.display = 'block';
        } else {
            suggestions.style.display = 'none';
        }

        // Handle input changes
        input.addEventListener('input', (e) => {
            const newValue = e.target.value;
            const newSimilarNames = this.ocrService.findSimilarNames(newValue, this.existingPlayers);
            
            if (newSimilarNames.length > 0) {
                suggestions.innerHTML = `
                    <div class="suggestions-header">Similar players found:</div>
                    ${newSimilarNames.map(sim => `
                        <div class="suggestion-item" onclick="rankingsManager.selectCommander(${index}, '${sim.name}')">
                            ${sim.name} <span class="confidence">(${Math.round(sim.confidence * 100)}% match)</span>
                        </div>
                    `).join('')}
                `;
                suggestions.style.display = 'block';
            } else {
                suggestions.style.display = 'none';
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !suggestions.contains(e.target)) {
                suggestions.style.display = 'none';
                input.setAttribute('readonly', 'readonly');
            }
        });
    }

    /**
     * Select commander name from suggestions
     */
    selectCommander(index, name) {
        const input = document.querySelector(`[data-index="${index}"]`);
        const suggestions = document.getElementById(`suggestions-${index}`);
        
        if (input) {
            input.value = name;
            input.setAttribute('readonly', 'readonly');
        }
        
        if (suggestions) {
            suggestions.style.display = 'none';
        }
    }

    /**
     * Remove a row from extracted data
     */
    removeRow(index) {
        this.extractedData.splice(index, 1);
        this.renderExtractedData();
    }

    /**
     * Reset upload section
     */
    resetUpload() {
        document.getElementById('rankingImageUpload').value = '';
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('processingSection').style.display = 'none';
        this.extractedData = [];
    }

    /**
     * Submit rankings to database
     */
    async submitRankings() {
        if (!this.extractedData || this.extractedData.length === 0) {
            this.showMessage('No data to submit.', 'error');
            return;
        }

        try {
            // Prepare data for insertion
            const rankingsData = this.extractedData.map(item => ({
                date: this.currentDate,
                day: this.getDayName(this.currentDate),
                ranking: item.ranking,
                commander: item.commander,
                points: item.points
            }));

            // Insert into database
            const { error } = await supabase
                .from('rankings')
                .insert(rankingsData);

            if (error) throw error;

            this.showMessage(`Successfully submitted ${rankingsData.length} rankings!`, 'success');
            this.resetUpload();
            
            // Refresh existing players list
            await this.loadExistingPlayers();
            
        } catch (error) {
            console.error('Error submitting rankings:', error);
            this.showMessage('Error submitting rankings. Please try again.', 'error');
        }
    }

    /**
     * Filter players based on search input
     */
    async filterPlayers(searchTerm) {
        console.log('Searching for:', searchTerm);
        
        if (!searchTerm || searchTerm.length < 2) {
            document.getElementById('playerResults').innerHTML = '';
            return;
        }

        try {
            console.log('Querying database for players...');
            const { data, error } = await supabase
                .from('rankings')
                .select('commander, ranking, points, date')
                .ilike('commander', `%${searchTerm}%`)
                .order('date', { ascending: false })
                .limit(50);

            if (error) {
                console.error('Database error:', error);
                throw error;
            }

            console.log('Search results:', data);
            this.renderPlayerResults(data);
            
        } catch (error) {
            console.error('Error searching players:', error);
            this.showMessage('Error searching players: ' + error.message, 'error');
        }
    }

    /**
     * Render player search results
     */
    renderPlayerResults(players) {
        const container = document.getElementById('playerResults');
        if (!container) return;

        if (!players || players.length === 0) {
            container.innerHTML = '<p class="no-results">No players found.</p>';
            return;
        }

        // Group by player name
        const playerGroups = players.reduce((acc, player) => {
            if (!acc[player.commander]) {
                acc[player.commander] = [];
            }
            acc[player.commander].push(player);
            return acc;
        }, {});

        container.innerHTML = `
            <div class="player-results-list">
                ${Object.entries(playerGroups).map(([name, records]) => `
                    <div class="player-card">
                        <div class="player-header">
                            <h4>${name}</h4>
                            <span class="record-count">${records.length} records</span>
                        </div>
                        <div class="player-stats">
                            <div class="stat">
                                <span class="stat-label">Best Rank:</span>
                                <span class="stat-value">${Math.min(...records.map(r => r.ranking))}</span>
                            </div>
                            <div class="stat">
                                <span class="stat-label">Latest Points:</span>
                                <span class="stat-value">${this.formatPoints(records[0].points)}</span>
                            </div>
                            <div class="stat">
                                <span class="stat-label">Last Seen:</span>
                                <span class="stat-value">${new Date(records[0].date).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <button class="btn small primary" onclick="rankingsManager.viewPlayerPerformance('${name}')">
                            View 30-Day Performance
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * View 30-day performance for a specific player
     */
    async viewPlayerPerformance(playerName) {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dateString = thirtyDaysAgo.toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('rankings')
                .select('date, ranking, points')
                .eq('commander', playerName)
                .gte('date', dateString)
                .order('date', { ascending: true });

            if (error) throw error;

            this.renderPerformanceChart(playerName, data);
            
        } catch (error) {
            console.error('Error loading player performance:', error);
            this.showMessage('Error loading player performance.', 'error');
        }
    }

    /**
     * Render performance chart
     */
    renderPerformanceChart(playerName, data) {
        const container = document.getElementById('performanceChart');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `<p class="no-data">No performance data available for ${playerName} in the last 30 days.</p>`;
            return;
        }

        // Simple chart rendering (in production, you'd use a charting library)
        const chartData = data.map(item => ({
            date: new Date(item.date),
            ranking: item.ranking,
            points: parseInt(item.points)
        }));

        container.innerHTML = `
            <div class="performance-chart-container">
                <h4>30-Day Performance: ${playerName}</h4>
                <div class="chart-stats">
                    <div class="chart-stat">
                        <span class="stat-label">Data Points:</span>
                        <span class="stat-value">${chartData.length}</span>
                    </div>
                    <div class="chart-stat">
                        <span class="stat-label">Best Rank:</span>
                        <span class="stat-value">${Math.min(...chartData.map(d => d.ranking))}</span>
                    </div>
                    <div class="chart-stat">
                        <span class="stat-label">Worst Rank:</span>
                        <span class="stat-value">${Math.max(...chartData.map(d => d.ranking))}</span>
                    </div>
                    <div class="chart-stat">
                        <span class="stat-label">Avg Rank:</span>
                        <span class="stat-value">${Math.round(chartData.reduce((sum, d) => sum + d.ranking, 0) / chartData.length)}</span>
                    </div>
                </div>
                <div class="simple-chart">
                    ${chartData.map(item => `
                        <div class="chart-bar" style="height: ${(100 - item.ranking) * 2}px;" title="Date: ${item.date.toLocaleDateString()}, Rank: ${item.ranking}">
                            <span class="bar-label">${item.ranking}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Populate player select dropdown
     */
    async populatePlayerSelect() {
        const select = document.getElementById('performancePlayer');
        if (!select) return;

        try {
            const { data, error } = await supabase
                .from('rankings')
                .select('commander')
                .not('commander', 'is', null);

            if (error) throw error;

            const uniquePlayers = [...new Set(data.map(item => item.commander))];
            
            select.innerHTML = `
                <option value="">Select a player to view performance...</option>
                ${uniquePlayers.map(player => `
                    <option value="${player}">${player}</option>
                `).join('')}
            `;

            select.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.viewPlayerPerformance(e.target.value);
                }
            });

        } catch (error) {
            console.error('Error populating player select:', error);
        }
    }

    /**
     * Format points with commas
     */
    formatPoints(points) {
        return parseInt(points).toLocaleString();
    }

    /**
     * Get day name from date string
     */
    getDayName(dateString) {
        const date = new Date(dateString);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[date.getDay()];
    }

    /**
     * Show message to user
     */
    showMessage(message, type = 'info') {
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;
        
        // Add to messages container
        const messagesContainer = document.getElementById('messages');
        if (messagesContainer) {
            messagesContainer.appendChild(messageDiv);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 5000);
        } else {
            // Fallback to console and alert
            console.log(`${type.toUpperCase()}: ${message}`);
            if (type === 'error') {
                alert(`Error: ${message}`);
            }
        }
    }
}

// Make it globally available
window.rankingsManager = new RankingsManager();
