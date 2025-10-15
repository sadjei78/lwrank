/**
 * Rankings Management Page
 * Handles CSV upload/paste and managing ranking data
 */

import { supabase } from './supabase-client.js';

export class RankingsManager {
    constructor() {
        this.currentDate = new Date().toISOString().split('T')[0];
        this.existingPlayers = [];
        this.parsedData = [];
        
        // Don't initialize immediately - wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.init();
            });
        } else {
            // DOM is already ready
            setTimeout(() => this.init(), 100);
        }
    }

    async init() {
        try {
            console.log('Initializing RankingsManager...');
            await this.loadExistingPlayers();
            this.setupEventListeners();
            this.render();
            console.log('RankingsManager initialized successfully');
        } catch (error) {
            console.error('Error initializing RankingsManager:', error);
            this.showMessage('Error initializing rankings manager: ' + error.message, 'error');
        }
    }

    /**
     * Load existing player names from database for matching
     */
    async loadExistingPlayers() {
        try {
            console.log('Loading existing players...');
            const { data, error } = await supabase
                .from('rankings')
                .select('commander')
                .not('commander', 'is', null);
            
            if (error) {
                console.warn('Error loading existing players:', error);
                this.existingPlayers = [];
                return;
            }
            
            // Get unique player names
            this.existingPlayers = [...new Set(data.map(item => item.commander))];
            console.log(`Loaded ${this.existingPlayers.length} existing players`);
        } catch (error) {
            console.error('Error loading existing players:', error);
            this.existingPlayers = [];
        }
    }

    /**
     * Setup event listeners for the rankings page
     */
    setupEventListeners() {
        // CSV file upload
        const csvFileInput = document.getElementById('csvFileUpload');
        const csvUploadBtn = document.getElementById('csvUploadBtn');
        const csvUploadArea = document.getElementById('csvUploadArea');
        
        if (csvFileInput && csvUploadBtn && csvUploadArea) {
            csvUploadBtn.addEventListener('click', () => csvFileInput.click());
            csvUploadArea.addEventListener('click', () => csvFileInput.click());
            
            csvUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                csvUploadArea.classList.add('dragover');
            });
            
            csvUploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                csvUploadArea.classList.remove('dragover');
            });
            
            csvUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                csvUploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type === 'text/csv') {
                    csvFileInput.files = files;
                    this.handleCsvFileUpload(files[0]);
                }
            });
            
            csvFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleCsvFileUpload(e.target.files[0]);
                }
            });
        }

        // CSV paste functionality
        const csvPasteArea = document.getElementById('csvPasteArea');
        const parseCsvBtn = document.getElementById('parseCsvBtn');
        
        if (csvPasteArea && parseCsvBtn) {
            parseCsvBtn.addEventListener('click', () => {
                const csvData = csvPasteArea.value.trim();
                if (csvData) {
                    this.parseCsvData(csvData);
                } else {
                    this.showMessage('Please enter CSV data to parse.', 'error');
                }
            });
        }

        // Date picker
        const dateInput = document.getElementById('rankingDate');
        if (dateInput) {
            dateInput.addEventListener('change', (e) => {
                this.currentDate = e.target.value;
            });
        }

        // Submit rankings
        const submitBtn = document.getElementById('submitRankingsBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitRankings());
        }

        // Reset upload
        const resetBtn = document.getElementById('resetUploadBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetUpload());
        }

        // Player search
        const searchInput = document.getElementById('playerSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterPlayers(e.target.value));
        }

        // Search button
        const searchBtn = document.getElementById('playerSearchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const searchTerm = document.getElementById('playerSearchInput').value;
                this.filterPlayers(searchTerm);
            });
        }

        // Performance dropdown
        const performanceSelect = document.getElementById('playerPerformanceSelect');
        if (performanceSelect) {
            performanceSelect.addEventListener('change', (e) => {
                const selectedPlayer = e.target.value;
                if (selectedPlayer) {
                    this.viewPlayerPerformance(selectedPlayer);
                }
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
                    <p>Upload CSV file or paste ranking data to manage daily player rankings.</p>
                </div>

                <div class="rankings-content">
                    <!-- CSV Upload Section -->
                    <div class="csv-upload-section" id="csvUploadSection">
                        <h3>📁 Upload CSV File</h3>
                        <div class="upload-area" id="csvUploadArea">
                            <input type="file" id="csvFileUpload" accept=".csv,text/csv" style="display: none;">
                            <div class="upload-content">
                                <span class="upload-icon">📄</span>
                                <h4>Drag & Drop CSV File or Click to Browse</h4>
                                <p>Supports CSV files with Ranking, Commander, Points columns</p>
                                <button type="button" class="upload-btn" id="csvUploadBtn">Choose CSV File</button>
                            </div>
                        </div>
                        
                        <div class="csv-paste-section">
                            <h4>📋 Or Paste CSV Data</h4>
                            <textarea id="csvPasteArea" placeholder="Paste your CSV data here...&#10;&#10;Example:&#10;Ranking,Commander,Points&#10;1,PlayerName,1000000&#10;2,AnotherPlayer,900000"></textarea>
                            <button type="button" class="btn primary" id="parseCsvBtn">Parse CSV Data</button>
                        </div>
                        
                        <div class="date-selector">
                            <label for="rankingDate">Ranking Date:</label>
                            <input type="date" id="rankingDate" class="date-input" value="${this.currentDate}">
                        </div>
                    </div>

                    <!-- Processing Section (Hidden by default) -->
                    <div class="processing-section" id="processingSection" style="display: none;">
                        <div class="loading-spinner"></div>
                        <div class="processing-content">
                            <h3>Processing CSV Data...</h3>
                            <p>Parsing and validating ranking data. This may take a moment.</p>
                        </div>
                    </div>

                    <!-- Results Section (Hidden by default) -->
                    <div class="results-section" id="resultsSection" style="display: none;">
                        <div class="results-header">
                            <h3>Parsed Rankings</h3>
                            <div class="results-actions">
                                <button type="button" class="btn primary" id="submitRankingsBtn">✅ Submit Rankings</button>
                                <button type="button" class="btn secondary" id="resetUploadBtn">🔄 Reset</button>
                            </div>
                        </div>
                        <div class="data-table">
                            <div class="table-header">
                                <div>Rank</div>
                                <div>Commander</div>
                                <div>Points</div>
                                <div>Actions</div>
                            </div>
                            <div class="table-body" id="rankingsTableBody">
                                <!-- Parsed data will be inserted here -->
                            </div>
                        </div>
                    </div>

                    <!-- Player Search Section -->
                    <div class="player-search-section">
                        <h3>🔍 Player Search & Performance</h3>
                        <div class="search-controls">
                            <div class="search-input-group">
                                <input type="text" id="playerSearchInput" class="search-input" placeholder="Search for a player...">
                                <button type="button" class="search-btn" id="playerSearchBtn">Search</button>
                            </div>
                        </div>
                        <div id="playerSearchResults" class="player-results-list">
                            <!-- Search results will be displayed here -->
                        </div>
                    </div>

                    <!-- Player Performance Section -->
                    <div class="performance-section">
                        <h3>📈 Player Performance (Last 30 Days)</h3>
                        <div class="performance-controls">
                            <select id="playerPerformanceSelect" class="player-select">
                                <option value="">Select a player to view performance...</option>
                                <!-- Player names will be loaded here -->
                            </select>
                        </div>
                        <div id="playerPerformanceChart" class="performance-chart-container">
                            <h4>Ranking Trend</h4>
                            <div class="chart-stats" id="performanceStats">
                                <!-- Stats like Avg Rank, Best Rank, Latest Points -->
                            </div>
                            <div class="simple-chart" id="rankingChart">
                                <!-- Chart bars will be rendered here -->
                            </div>
                            <p class="no-data" id="noPerformanceData" style="display: none;">No performance data available for the last 30 days.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        this.populatePlayerSelect();
    }

    /**
     * Handle CSV file upload
     */
    async handleCsvFileUpload(file) {
        if (!file) return;

        // Validate file type
        if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
            this.showMessage('Please upload a valid CSV file.', 'error');
            return;
        }

        // Show processing section
        this.showProcessing();

        try {
            const csvData = await this.readFileAsText(file);
            await this.parseCsvData(csvData);
        } catch (error) {
            console.error('Error reading CSV file:', error);
            this.showMessage('Error reading CSV file. Please try again.', 'error');
            this.hideProcessing();
        }
    }

    /**
     * Read file as text
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    /**
     * Parse CSV data
     */
    async parseCsvData(csvData) {
        try {
            this.showProcessing();
            
            // Parse CSV
            const lines = csvData.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('CSV must have at least a header row and one data row');
            }

            // Parse header
            const header = lines[0].split(',').map(h => h.trim().toLowerCase());
            const expectedHeaders = ['ranking', 'commander', 'points'];
            
            // Check if headers match expected format
            const hasValidHeaders = expectedHeaders.every(expected => 
                header.some(h => h.includes(expected))
            );
            
            if (!hasValidHeaders) {
                throw new Error('CSV must contain columns: Ranking, Commander, Points');
            }

            // Find column indices
            const rankingIndex = header.findIndex(h => h.includes('ranking'));
            const commanderIndex = header.findIndex(h => h.includes('commander'));
            const pointsIndex = header.findIndex(h => h.includes('points'));

            // Parse data rows
            this.parsedData = [];
            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].split(',').map(cell => cell.trim());
                
                if (row.length < 3) continue; // Skip incomplete rows
                
                const ranking = parseInt(row[rankingIndex]);
                const commander = row[commanderIndex];
                const points = row[pointsIndex].replace(/,/g, ''); // Remove commas from points
                
                if (isNaN(ranking) || !commander || !points) continue; // Skip invalid rows
                
                this.parsedData.push({
                    ranking: ranking,
                    commander: commander,
                    points: points
                });
            }

            if (this.parsedData.length === 0) {
                throw new Error('No valid ranking data found in CSV');
            }

            // Show results
            this.hideProcessing();
            this.showResults();
            this.renderParsedData();
            
            this.showMessage(`Successfully parsed ${this.parsedData.length} rankings from CSV.`, 'success');
            
        } catch (error) {
            console.error('Error parsing CSV:', error);
            this.showMessage('Error parsing CSV: ' + error.message, 'error');
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
     * Render parsed data for review
     */
    renderParsedData() {
        const container = document.getElementById('rankingsTableBody');
        if (!container) return;

        container.innerHTML = '';

        this.parsedData.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'table-row';
            row.innerHTML = `
                <div class="col-ranking"><span class="ranking-number">${item.ranking}</span></div>
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
                <div class="col-points"><span class="points-value">${this.formatPoints(item.points)}</span></div>
                <div class="col-actions">
                    <button type="button" 
                            class="btn small danger" 
                            onclick="rankingsManager.removeRow(${index})">
                        Remove
                    </button>
                </div>
            `;
            container.appendChild(row);

            // Setup commander input event listeners
            const commanderInput = row.querySelector(`.commander-input[data-index="${index}"]`);
            const editBtn = row.querySelector(`.edit-commander-btn[data-index="${index}"]`);
            const suggestionsContainer = row.querySelector(`#suggestions-${index}`);

            if (commanderInput) {
                commanderInput.addEventListener('input', () => this.handleCommanderInput(commanderInput, suggestionsContainer));
                commanderInput.addEventListener('focus', () => this.handleCommanderInput(commanderInput, suggestionsContainer));
                commanderInput.addEventListener('blur', () => setTimeout(() => suggestionsContainer.style.display = 'none', 200));
            }

            if (editBtn) {
                editBtn.addEventListener('click', () => this.toggleCommanderEdit(commanderInput, editBtn));
            }
        });
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
     * Remove a row from parsed data
     */
    removeRow(index) {
        this.parsedData.splice(index, 1);
        this.renderParsedData();
    }

    /**
     * Reset upload section
     */
    resetUpload() {
        document.getElementById('csvFileUpload').value = '';
        document.getElementById('csvPasteArea').value = '';
        document.getElementById('rankingsTableBody').innerHTML = '';
        document.getElementById('csvUploadSection').style.display = 'block';
        document.getElementById('processingSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
        this.parsedData = [];
    }

    /**
     * Submit rankings to database
     */
    async submitRankings() {
        if (!this.parsedData || this.parsedData.length === 0) {
            this.showMessage('No data to submit.', 'error');
            return;
        }

        try {
            // Prepare data for insertion
            const rankingsData = this.parsedData.map(item => ({
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
            const resultsContainer = document.getElementById('playerSearchResults');
            if (resultsContainer) {
                resultsContainer.innerHTML = '';
            }
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
        const container = document.getElementById('playerSearchResults');
        if (!container) {
            console.error('Player search results container not found');
            return;
        }

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
            console.log('Loading performance for:', playerName);
            
            // Update the dropdown to show the selected player
            const performanceSelect = document.getElementById('playerPerformanceSelect');
            if (performanceSelect) {
                performanceSelect.value = playerName;
            }
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dateString = thirtyDaysAgo.toISOString().split('T')[0];

            console.log('Querying rankings for player:', playerName, 'from date:', dateString);
            
            // Try to get data from Supabase
            const { data, error } = await supabase
                .from('rankings')
                .select('date, ranking, points')
                .eq('commander', playerName)
                .gte('date', dateString)
                .order('date', { ascending: true });

            if (error) {
                console.error('Database error:', error);
                console.log('Attempting to use localStorage fallback...');
                
                // Try localStorage fallback
                const localData = this.getLocalPerformanceData(playerName, dateString);
                if (localData && localData.length > 0) {
                    console.log('Using localStorage data:', localData);
                    this.renderPerformanceChart(playerName, localData);
                } else {
                    this.renderPerformanceChart(playerName, []);
                    this.showMessage('Performance data not available in offline mode', 'warning');
                }
                return;
            }

            console.log('Performance data loaded:', data);
            this.renderPerformanceChart(playerName, data || []);
            
        } catch (error) {
            console.error('Error loading player performance:', error);
            this.renderPerformanceChart(playerName, []);
            this.showMessage('Error loading player performance: ' + error.message, 'error');
        }
    }

    /**
     * Get performance data from localStorage as fallback
     */
    getLocalPerformanceData(playerName, fromDate) {
        try {
            const storedData = localStorage.getItem('rankingsData');
            if (!storedData) return [];

            const rankingsData = JSON.parse(storedData);
            const playerData = [];

            // Filter data for the specific player and date range
            Object.keys(rankingsData).forEach(date => {
                if (date >= fromDate) {
                    const dayData = rankingsData[date];
                    if (Array.isArray(dayData)) {
                        const playerRecord = dayData.find(record => 
                            record.commander && record.commander.toLowerCase() === playerName.toLowerCase()
                        );
                        if (playerRecord) {
                            playerData.push({
                                date: date,
                                ranking: playerRecord.ranking,
                                points: playerRecord.points
                            });
                        }
                    }
                }
            });

            return playerData.sort((a, b) => new Date(a.date) - new Date(b.date));
        } catch (error) {
            console.error('Error getting local performance data:', error);
            return [];
        }
    }

    /**
     * Render performance chart
     */
    renderPerformanceChart(playerName, data) {
        const container = document.getElementById('playerPerformanceChart');
        if (!container) {
            console.error('Player performance chart container not found');
            return;
        }

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="no-performance-data">
                    <h4>Ranking Trend - ${playerName}</h4>
                    <div class="chart-stats" id="performanceStats">
                        <div class="stat">
                            <span class="stat-label">No data available</span>
                        </div>
                    </div>
                    <div class="simple-chart" id="rankingChart">
                        <p class="no-data">No performance data available for ${playerName} in the last 30 days.</p>
                    </div>
                </div>
            `;
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
                <h4>Ranking Trend - ${playerName}</h4>
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
        const select = document.getElementById('playerPerformanceSelect');
        if (!select) {
            console.error('Player performance select not found');
            return;
        }

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

// Don't create global instance immediately - let main.js handle initialization
// window.rankingsManager = new RankingsManager();

