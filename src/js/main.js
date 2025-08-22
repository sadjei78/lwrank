import { RankingManager } from './ranking-manager.js';
import { CSVProcessor } from './csv-processor.js';
import { UIManager } from './ui-manager.js';

class DailyRankingsApp {
    constructor() {
        this.rankingManager = new RankingManager();
        this.csvProcessor = new CSVProcessor();
        this.uiManager = new UIManager();
        this.selectedDate = new Date();
        this.currentTabDate = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        
        // Show admin features if admin code matches environment variable
        const isAdmin = this.isAdmin();
        console.log('Admin mode:', isAdmin);
        this.uiManager.toggleAdminFeatures(isAdmin);
        
        // Wait for data to load from database
        await this.rankingManager.initializeConnection();
        
        // Set initial date to current week
        this.setDateToCurrentWeek();
        
        // Update UI after data is loaded
        await this.updateWeeklyTabs();
        this.uiManager.updateConnectionStatus(this.rankingManager.getConnectionStatus());
        
        // Update version number
        this.updateVersionNumber();
        
        // Check for day parameter and navigate to specific day tab
        await this.handleDayParameter();
        
        console.log('Daily Rankings Manager initialized');
    }

    setupEventListeners() {
        // Week picker change
        document.getElementById('weekPicker').addEventListener('change', (e) => {
            const weekValue = e.target.value; // Format: YYYY-Www
            if (weekValue) {
                const [year, week] = weekValue.split('-W');
                const date = this.getDateFromWeek(parseInt(year), parseInt(week));
                this.selectedDate = date;
                this.updateWeeklyTabs();
            }
        });

        // Previous/Next week buttons
        document.getElementById('prevWeek').addEventListener('click', () => {
            this.selectedDate.setDate(this.selectedDate.getDate() - 7);
            this.updateWeekPicker();
            this.updateWeeklyTabs();
        });

        document.getElementById('nextWeek').addEventListener('click', () => {
            this.selectedDate.setDate(this.selectedDate.getDate() + 7);
            this.updateWeekPicker();
            this.updateWeeklyTabs();
        });

        // Process CSV button
        document.getElementById('uploadBtn').addEventListener('click', () => {
            this.processCSVFile();
        });

        // Special event and player management
        document.getElementById('createEventBtn').addEventListener('click', () => {
            this.createSpecialEvent();
        });
        
        document.getElementById('updatePlayerBtn').addEventListener('click', () => {
            this.updatePlayerName();
        });
        
        // Special events toggle
        document.getElementById('includeSpecialEvents').addEventListener('change', async () => {
            // Refresh current tab to update weekly calculations
            if (this.currentTabDate) {
                await this.showTab(this.currentTabDate);
            }
        });

        // Exit admin button
        const exitAdminBtn = document.getElementById('exitAdminBtn');
        if (exitAdminBtn) {
            exitAdminBtn.addEventListener('click', () => this.exitAdminMode());
        }

        // Tab click handlers
        document.getElementById('tabs').addEventListener('click', async (e) => {
            if (e.target.classList.contains('tab')) {
                const dateKey = e.target.getAttribute('data-date');
                const tabType = e.target.getAttribute('data-type');
                
                if (tabType === 'reports') {
                    await this.showTab('reports');
                } else if (dateKey) {
                    await this.showTab(dateKey);
                }
            }
        });

        // Collapsible section handlers
        this.setupCollapsibleSections();
    }

    setupCollapsibleSections() {
        const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
        
        collapsibleHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const targetId = header.getAttribute('data-target');
                const content = document.getElementById(targetId);
                const icon = header.querySelector('.collapsible-icon');
                
                if (content.classList.contains('collapsed')) {
                    // Expand
                    content.classList.remove('collapsed');
                    header.classList.remove('collapsed');
                } else {
                    // Collapse
                    content.classList.add('collapsed');
                    header.classList.add('collapsed');
                }
            });
        });
    }

    isAdmin() {
        const params = new URLSearchParams(window.location.search);
        const adminCode = params.get('admin');
        const expectedCode = import.meta.env.VITE_ADMIN_CODE;
        
        if (!adminCode || !expectedCode) {
            return false;
        }
        
        return adminCode === expectedCode;
    }

    exitAdminMode() {
        // Remove admin parameter from URL and reload
        const url = new URL(window.location);
        url.searchParams.delete('admin');
        window.location.href = url.toString();
    }

    updateVersionNumber() {
        const versionElement = document.getElementById('versionNumber');
        if (versionElement) {
            // For now, we'll use a hardcoded version since Vite doesn't expose package.json
            // In a real app, you might use import.meta.env.VITE_APP_VERSION
            versionElement.textContent = 'v1.0.0';
        }
    }

    setDateToCurrentWeek() {
        const today = new Date();
        this.selectedDate = today;
        this.updateWeekPicker();
    }

    updateWeekPicker() {
        const weekPicker = document.getElementById('weekPicker');
        const weekValue = this.getWeekValue(this.selectedDate);
        weekPicker.value = weekValue;
    }

    getWeekValue(date) {
        const year = date.getFullYear();
        const week = this.getWeekNumber(date);
        return `${year}-W${week.toString().padStart(2, '0')}`;
    }

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    getDateFromWeek(year, week) {
        const simple = new Date(year, 0, 1 + (week - 1) * 7);
        const dow = simple.getDay();
        const ISOweekStart = simple;
        if (dow <= 4)
            ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
        else
            ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
        return ISOweekStart;
    }

    getWeekDates(date) {
        const week = [];
        const startOfWeek = new Date(date);
        
        // Get Monday of the week (0 = Sunday, 1 = Monday, etc.)
        const dayOfWeek = startOfWeek.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setDate(startOfWeek.getDate() + daysToMonday);
        
        // Generate weekdays (Monday to Saturday)
        for (let i = 0; i < 6; i++) {
            const day = new Date(startOfWeek);
            day.setDate(startOfWeek.getDate() + i);
            week.push(day);
        }
        
        return week;
    }

    formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatDateDisplay(date) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const dayName = days[date.getDay()];
        const month = months[date.getMonth()];
        const dayNum = date.getDate();
        
        return `${dayName} ${month} ${dayNum}`;
    }

    formatSimpleDayName(date) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[date.getDay()];
    }

    async updateWeeklyTabs() {
        console.log('Updating weekly tabs for date:', this.selectedDate);
        const weekDates = this.getWeekDates(this.selectedDate);
        const tabsContainer = document.getElementById('tabs');
        const tabContentsContainer = document.getElementById('tabContents');
        
        // Clear existing tabs and content
        tabsContainer.innerHTML = '';
        tabContentsContainer.innerHTML = '';
        
        // Create tabs for each weekday
        for (const date of weekDates) {
            const dateKey = this.formatDateKey(date);
            const simpleDayName = this.formatSimpleDayName(date);
            
            console.log('Creating tab for:', dateKey, simpleDayName);
            
            // Create tab button
            const tab = document.createElement('button');
            tab.className = 'tab';
            tab.textContent = simpleDayName;
            tab.setAttribute('data-date', dateKey);
            tabsContainer.appendChild(tab);
            
            // Create tab content
            const content = document.createElement('div');
            content.className = 'tab-content';
            content.id = `tab-${dateKey}`;
            tabContentsContainer.appendChild(content);
        }
        
        // Add special event tabs
        const specialEvents = await this.rankingManager.getSpecialEvents();
        for (const event of specialEvents) {
            const eventKey = event.key;
            const eventName = event.name;
            
            // Create special event tab
            const eventTab = document.createElement('button');
            eventTab.className = 'tab special-event-tab';
            eventTab.textContent = eventName;
            eventTab.setAttribute('data-date', eventKey);
            eventTab.setAttribute('data-type', 'special-event');
            tabsContainer.appendChild(eventTab);
            
            // Create special event content
            const eventContent = document.createElement('div');
            eventContent.className = 'tab-content';
            eventContent.id = `tab-${eventKey}`;
            tabContentsContainer.appendChild(eventContent);
        }
        
        // Add Reports tab
        const reportsTab = document.createElement('button');
        reportsTab.className = 'tab reports-tab';
        reportsTab.textContent = '📊 Reports';
        reportsTab.setAttribute('data-type', 'reports');
        tabsContainer.appendChild(reportsTab);
        
        // Show first tab by default
        if (weekDates.length > 0) {
            const firstDateKey = this.formatDateKey(weekDates[0]);
            await this.showTab(firstDateKey);
        }
        
        this.updateDataStatus();
    }

    async showTab(dateKey) {
        console.log('Showing tab for dateKey:', dateKey);
        this.currentTabDate = dateKey;
        
        // Hide all tab contents
        const allContents = document.querySelectorAll('.tab-content');
        allContents.forEach(content => content.classList.remove('active'));
        
        // Remove active class from all tabs
        const allTabs = document.querySelectorAll('.tab');
        allTabs.forEach(tab => tab.classList.remove('active'));
        
        // Check if this is the Reports tab
        if (dateKey === 'reports') {
            // Show reports tab
            document.getElementById('reportsTab').style.display = 'block';
            document.querySelector('.tabs-container').style.display = 'none';
            
            // Add active class to reports tab
            const reportsTab = document.querySelector('.tab[data-type="reports"]');
            if (reportsTab) {
                reportsTab.classList.add('active');
            }
            
            // Initialize reports functionality
            this.initializeReports();
            return;
        } else {
            // Hide reports tab and show regular tabs
            document.getElementById('reportsTab').style.display = 'none';
            document.querySelector('.tabs-container').style.display = 'block';
        }
        
        // Show selected tab content
        const selectedContent = document.getElementById(`tab-${dateKey}`);
        if (selectedContent) {
            selectedContent.classList.add('active');
            
            // Check if this is a special event tab
            const isSpecialEvent = dateKey.startsWith('event_');
            
            if (isSpecialEvent) {
                // Handle special event display
                const eventName = dateKey.split('_').slice(1, -2).join('_');
                
                // Load special event data
                const eventRankings = await this.rankingManager.getRankingsForSpecialEvent(dateKey);
                
                if (eventRankings && eventRankings.length > 0) {
                    // For special events, show all rankings without weekly stats
                    selectedContent.innerHTML = this.uiManager.createRankingTable(
                        eventRankings, 
                        eventName, 
                        {}, // No top 10 occurrences for special events
                        {}, // No bottom 20 occurrences for special events
                        {}, // No cumulative scores for special events
                        true // isSpecialEvent = true
                    );
                } else {
                    selectedContent.innerHTML = `
                        <div class="no-data">
                            <h3>Special Event: ${eventName}</h3>
                            <p>No ranking data available for this special event. Upload a CSV file to add rankings.</p>
                        </div>
                    `;
                }
            } else {
                // Load and display rankings for this date
                const rankings = await this.rankingManager.getRankingsForDate(dateKey);
                
                // Ensure we're using the correct date for display
                const date = new Date(dateKey + 'T00:00:00'); // Ensure correct date parsing
                const displayName = this.formatDateDisplay(date);
                
                const weekDates = this.getWeekDates(this.selectedDate);
                // Convert Date objects to date keys for weekly calculations
                const weekDateKeys = weekDates.map(date => this.formatDateKey(date));
                const top10Occurrences = await this.rankingManager.getWeeklyTop10Occurrences(weekDateKeys);
                const bottom20Occurrences = await this.rankingManager.getWeeklyBottom20Occurrences(weekDateKeys);
                const cumulativeScores = await this.rankingManager.getWeeklyCumulativeScores(weekDateKeys);
                
                if (rankings && rankings.length > 0) {
                    selectedContent.innerHTML = this.uiManager.createRankingTable(
                        rankings, 
                        displayName, 
                        top10Occurrences, 
                        bottom20Occurrences,
                        cumulativeScores,
                        false // isSpecialEvent = false
                    );
                } else {
                    selectedContent.innerHTML = `
                        <div class="no-data">
                            <h3>No ranking data available for ${displayName}</h3>
                            <p>Upload a CSV file to add rankings for this date.</p>
                        </div>
                    `;
                }
            }
        }
        
        // Add active class to selected tab
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            if (tab.getAttribute('data-date') === dateKey) {
                tab.classList.add('active');
            }
        });

        // Update data analysis summary
        await this.updateDataAnalysis();
    }

    async processCSVFile() {
        const fileInput = document.getElementById('csvFileUpload');
        const selectedDateKey = this.currentTabDate || this.formatDateKey(this.selectedDate);
        
        if (!fileInput.files.length) {
            alert('Please select a CSV file.');
            return;
        }

        const file = fileInput.files[0];
        
        this.csvProcessor.processFile(file, async (rankings) => {
            if (rankings.length === 0) {
                alert('No valid rankings found in CSV.');
                return;
            }

            // Check if this is a special event
            const isSpecialEvent = selectedDateKey.startsWith('event_');
            
            // Show confirmation dialog with sample data
            const confirmed = await this.showImportConfirmation(rankings, selectedDateKey);
            
            if (!confirmed) {
                // Clear the file input if user cancels
                fileInput.value = '';
                return;
            }

            const uniqueRankings = this.rankingManager.removeDuplicateRankings(rankings);
            
            if (isSpecialEvent) {
                // Handle special event data
                await this.rankingManager.setRankingsForSpecialEvent(selectedDateKey, uniqueRankings);
                const eventName = selectedDateKey.split('_').slice(1, -2).join('_');
                this.uiManager.showSuccess(`Successfully processed ${uniqueRankings.length} rankings for special event: ${eventName}!`);
            } else {
                // Handle regular date data
                await this.rankingManager.setRankingsForDate(selectedDateKey, uniqueRankings);
                
                // Refresh data from database to ensure weekly statistics are accurate
                await this.rankingManager.refreshDataFromDatabase();
                
                const selectedDate = new Date(selectedDateKey);
                this.uiManager.showSuccess(`Successfully processed ${uniqueRankings.length} rankings for ${this.formatDateDisplay(selectedDate)}!`);
            }
            
            // Refresh the current tab to show new data
            await this.showTab(selectedDateKey);
            this.updateDataStatus();
            
            // Clear the file input
            fileInput.value = '';
        });
    }

    async showImportConfirmation(rankings, dateKey) {
        // Check if this is a special event
        const isSpecialEvent = dateKey.startsWith('event_');
        
        let displayDate;
        let existingData;
        
        if (isSpecialEvent) {
            // Extract event name from the key
            const eventName = dateKey.split('_').slice(1, -2).join('_');
            displayDate = `Special Event: ${eventName}`;
            existingData = await this.rankingManager.getRankingsForSpecialEvent(dateKey);
        } else {
            // Regular date handling
            const date = new Date(dateKey + 'T00:00:00');
            displayDate = this.formatDateDisplay(date);
            existingData = await this.rankingManager.getRankingsForDate(dateKey);
        }
        
        // Use the custom modal from UI manager
        return await this.uiManager.showImportConfirmation(rankings, dateKey, displayDate, existingData);
    }

    async createSpecialEvent() {
        const eventName = document.getElementById('eventName').value.trim();
        const startDate = document.getElementById('eventStartDate').value;
        const endDate = document.getElementById('eventEndDate').value;
        
        if (!eventName || !startDate || !endDate) {
            alert('Please fill in all fields for the special event.');
            return;
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            alert('Start date must be before end date.');
            return;
        }
        
        const success = await this.rankingManager.createSpecialEvent(eventName, startDate, endDate);
        
        if (success) {
            this.uiManager.showSuccess(`Special event "${eventName}" created successfully!`);
            // Clear form
            document.getElementById('eventName').value = '';
            document.getElementById('eventStartDate').value = '';
            document.getElementById('eventEndDate').value = '';
            
            // Refresh tabs to include new special event
            await this.updateWeeklyTabs();
        } else {
            this.uiManager.showError('Failed to create special event. Please try again.');
        }
    }

    async updatePlayerName() {
        const oldName = document.getElementById('oldPlayerName').value.trim();
        const newName = document.getElementById('newPlayerName').value.trim();
        
        if (!oldName || !newName) {
            alert('Please enter both old and new player names.');
            return;
        }
        
        if (oldName === newName) {
            alert('Old and new names cannot be the same.');
            return;
        }
        
        const confirmed = confirm(`Are you sure you want to update all records for player "${oldName}" to "${newName}"? This will affect cumulative scores and rankings.`);
        
        if (!confirmed) {
            return;
        }
        
        const success = await this.rankingManager.updatePlayerName(oldName, newName);
        
        if (success) {
            this.uiManager.showSuccess(`Successfully updated player name from "${oldName}" to "${newName}". Cumulative scores and rankings have been updated.`);
            // Clear form
            document.getElementById('oldPlayerName').value = '';
            document.getElementById('newPlayerName').value = '';
            
            // Refresh current tab to show updated data
            if (this.currentTabDate) {
                await this.showTab(this.currentTabDate);
            }
        } else {
            this.uiManager.showError('Failed to update player name. Player may not exist or no changes were made.');
        }
    }

    updateDataStatus() {
        const dataStatus = document.getElementById('dataStatus');
        const dataCount = document.getElementById('dataCount');
        const totalRankings = this.rankingManager.getTotalRankingsCount();
        
        if (totalRankings > 0) {
            dataCount.textContent = totalRankings;
            dataStatus.style.display = 'block';
        } else {
            dataStatus.style.display = 'none';
        }
    }

    async handleDayParameter() {
        const urlParams = new URLSearchParams(window.location.search);
        const dayParam = urlParams.get('day');
        
        if (dayParam) {
            const dayMapping = {
                'mon': 'Monday',
                'tue': 'Tuesday', 
                'wed': 'Wednesday',
                'thu': 'Thursday',
                'fri': 'Friday',
                'sat': 'Saturday',
                'sun': 'Sunday'
            };
            
            const targetDay = dayMapping[dayParam.toLowerCase()];
            if (targetDay) {
                // Find the tab with the target day name
                const tabs = document.querySelectorAll('.tab');
                let targetTab = null;
                
                for (const tab of tabs) {
                    if (tab.textContent === targetDay) {
                        targetTab = tab;
                        break;
                    }
                }
                
                if (targetTab) {
                    // Click the target tab to show it
                    targetTab.click();
                    console.log(`Navigated to ${targetDay} tab via day parameter`);
                } else {
                    console.log(`Day tab ${targetDay} not found`);
                }
            } else {
                console.log(`Invalid day parameter: ${dayParam}. Valid values are: ${Object.keys(dayMapping).join(', ')}`);
            }
        }
    }

    async updateDataAnalysis() {
        const dataAnalysis = document.getElementById('dataAnalysis');
        const analysisContent = document.getElementById('analysisContent');
        
        if (!dataAnalysis || !analysisContent) return;
        
        try {
            const currentDateKey = this.currentTabDate;
            if (!currentDateKey) return;
            
            const isSpecialEvent = currentDateKey.startsWith('event_');
            
            if (isSpecialEvent) {
                // Special event analysis
                const eventName = currentDateKey.split('_').slice(1, -2).join('_');
                const eventRankings = await this.rankingManager.getRankingsForSpecialEvent(currentDateKey);
                
                if (eventRankings && eventRankings.length > 0) {
                    const analysis = this.generateSpecialEventAnalysis(eventRankings, eventName);
                    analysisContent.innerHTML = analysis;
                    dataAnalysis.style.display = 'block';
                } else {
                    dataAnalysis.style.display = 'none';
                }
            } else {
                // Regular date analysis
                const rankings = await this.rankingManager.getRankingsForDate(currentDateKey);
                const weekDates = this.getWeekDates(this.selectedDate);
                const weekDateKeys = weekDates.map(date => this.formatDateKey(date));
                const top10Occurrences = await this.rankingManager.getWeeklyTop10Occurrences(weekDateKeys);
                const cumulativeScores = await this.rankingManager.getWeeklyCumulativeScores(weekDateKeys);
                
                if (rankings && rankings.length > 0) {
                    const analysis = this.generateDailyAnalysis(rankings, currentDateKey, top10Occurrences, cumulativeScores, weekDateKeys);
                    analysisContent.innerHTML = analysis;
                    dataAnalysis.style.display = 'block';
                } else {
                    dataAnalysis.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error updating data analysis:', error);
            dataAnalysis.style.display = 'none';
        }
    }

    generateDailyAnalysis(rankings, dateKey, top10Occurrences, cumulativeScores, weekDateKeys) {
        const date = new Date(dateKey + 'T00:00:00');
        const dayName = this.formatSimpleDayName(date);
        const totalPlayers = rankings.length;
        
        // Find top performers
        const top3 = rankings.slice(0, 3);
        const top3Names = top3.map(r => r.commander).join(', ');
        
        // Calculate average points with validation and debugging
        console.log('Rankings data for average calculation:', rankings);
        console.log('Sample ranking object:', rankings[0]);
        
        const validRankings = rankings.filter(r => {
            const hasPoints = r.points !== null && r.points !== undefined;
            const isNumber = !isNaN(Number(r.points));
            const isPositive = Number(r.points) > 0;
            console.log(`Player ${r.commander}: points=${r.points}, hasPoints=${hasPoints}, isNumber=${isNumber}, isPositive=${isPositive}`);
            return hasPoints && isNumber && isPositive;
        });
        
        console.log('Valid rankings with points:', validRankings);
        
        let avgPoints = 0;
        let pointsAnalysis = '';
        
        if (validRankings.length > 0) {
            const totalPoints = validRankings.reduce((sum, r) => sum + Number(r.points), 0);
            avgPoints = Math.round(totalPoints / validRankings.length);
            console.log('Total points:', totalPoints, 'Valid players:', validRankings.length, 'Average:', avgPoints);
            pointsAnalysis = `with an average of ${avgPoints} points`;
        } else {
            pointsAnalysis = '(points data not available)';
            console.warn('No valid points data found for average calculation');
        }
        
        // Find players with multiple top 10 appearances this week
        const multiTop10Players = Object.entries(top10Occurrences)
            .filter(([_, count]) => count > 1)
            .sort(([_, a], [__, b]) => b - a)
            .slice(0, 3);
        
        // Find top cumulative performers
        const topCumulative = Object.entries(cumulativeScores)
            .sort(([_, a], [__, b]) => b - a)
            .slice(0, 3);
        
        let analysis = `
            <p><span class="analysis-highlight">${dayName} Analysis:</span> ${totalPlayers} players competed today ${pointsAnalysis}.</p>
            <div class="analysis-stat">
                <strong>Top 3 Today:</strong> ${top3Names}
            </div>
        `;
        
        if (multiTop10Players.length > 0) {
            const multiTop10Text = multiTop10Players
                .map(([name, count]) => `${name} (${count}x)`)
                .join(', ');
            analysis += `
                <div class="analysis-stat">
                    <strong>Consistent Performers This Week:</strong> ${multiTop10Text}
                </div>
            `;
        }
        
        if (topCumulative.length > 0) {
            const topCumulativeText = topCumulative
                .map(([name, score]) => `${name} (${score} pts)`)
                .join(', ');
            analysis += `
                <div class="analysis-stat">
                    <strong>Weekly Leaders:</strong> ${topCumulativeText}
                </div>
            `;
        }
        
        return analysis;
    }

    generateSpecialEventAnalysis(rankings, eventName) {
        const totalPlayers = rankings.length;
        
        // Calculate average points with validation
        const validRankings = rankings.filter(r => {
            const hasPoints = r.points !== null && r.points !== undefined;
            const isNumber = !isNaN(Number(r.points));
            const isPositive = Number(r.points) > 0;
            return hasPoints && isNumber && isPositive;
        });
        
        let avgPoints = 0;
        let pointsAnalysis = '';
        
        if (validRankings.length > 0) {
            const totalPoints = validRankings.reduce((sum, r) => sum + Number(r.points), 0);
            avgPoints = Math.round(totalPoints / validRankings.length);
            pointsAnalysis = `with an average of ${avgPoints} points`;
        } else {
            pointsAnalysis = '(points data not available)';
        }
        
        const top3 = rankings.slice(0, 3);
        const top3Names = top3.map(r => r.commander).join(', ');
        
        const analysis = `
            <p><span class="analysis-highlight">${eventName} Analysis:</span> ${totalPlayers} players participated in this special event ${pointsAnalysis}.</p>
            <div class="analysis-stat">
                <strong>Event Winners:</strong> ${top3Names}
            </div>
        `;
        
        return analysis;
    }

    initializeReports() {
        // Set up report generation button
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateReport());
        }
        
        // Set up report type change handler
        const reportType = document.getElementById('reportType');
        if (reportType) {
            reportType.addEventListener('change', () => {
                if (reportType.value) {
                    this.generateReport();
                }
            });
        }
        
        // Set up filter change handlers
        const minAppearances = document.getElementById('minAppearances');
        const dateRange = document.getElementById('dateRange');
        
        if (minAppearances) {
            minAppearances.addEventListener('change', () => {
                if (reportType.value) {
                    this.generateReport();
                }
            });
        }
        
        if (dateRange) {
            dateRange.addEventListener('change', () => {
                if (reportType.value) {
                    this.generateReport();
                }
            });
        }
    }

    async generateReport() {
        const reportType = document.getElementById('reportType').value;
        const minAppearances = parseInt(document.getElementById('minAppearances').value) || 3;
        const dateRange = document.getElementById('dateRange').value;
        
        if (!reportType) return;
        
        // Show loading
        this.showReportLoading(true);
        
        try {
            let reportData;
            let reportTitle;
            
            switch (reportType) {
                case 'top10-alltime':
                    reportData = await this.generateTop10AllTimeReport(minAppearances, dateRange);
                    reportTitle = '🏆 Top 10 Performers All Time';
                    break;
                case 'bottom10-alltime':
                    reportData = await this.generateBottom10AllTimeReport(minAppearances, dateRange);
                    reportTitle = '📉 Bottom 10 All Time (Excluding Top 10 Achievers)';
                    break;
                case 'top10-avgpoints':
                    reportData = await this.generateTop10AvgPointsReport(minAppearances, dateRange);
                    reportTitle = '⭐ Top 10 Individual Average Points';
                    break;
                case 'bottom10-avgpoints':
                    reportData = await this.generateBottom10AvgPointsReport(minAppearances, dateRange);
                    reportTitle = '🔻 Bottom 10 Individual Average Points';
                    break;
                case 'top10-weekly':
                    reportData = await this.generateTop10WeeklyReport(minAppearances, dateRange);
                    reportTitle = '📈 Top 10 Weekly Total Points';
                    break;
                case 'bottom10-weekly':
                    reportData = await this.generateBottom10WeeklyReport(minAppearances, dateRange);
                    reportTitle = '📊 Bottom 10 Weekly Total Points';
                    break;
                default:
                    throw new Error('Unknown report type');
            }
            
            this.displayReport(reportTitle, reportData);
        } catch (error) {
            console.error('Error generating report:', error);
            this.displayReportError('Failed to generate report: ' + error.message);
        } finally {
            this.showReportLoading(false);
        }
    }

    showReportLoading(show) {
        const loading = document.querySelector('.report-loading');
        const content = document.getElementById('reportContent');
        
        if (loading) loading.style.display = show ? 'block' : 'none';
        if (content) content.style.display = show ? 'none' : 'block';
    }

    displayReport(title, data) {
        const content = document.getElementById('reportContent');
        if (!content) return;
        
        let html = `
            <div class="report-header">
                <h3>${title}</h3>
                <div class="report-meta">
                    <span class="meta-item">📊 ${data.length} results</span>
                    <span class="meta-item">⏰ Generated: ${new Date().toLocaleString()}</span>
                </div>
            </div>
            <div class="report-table-container">
                <table class="report-table">
                    <thead>
                        <tr>
        `;
        
        // Add headers based on data structure
        if (data.length > 0) {
            const headers = Object.keys(data[0]);
            headers.forEach(header => {
                html += `<th>${this.formatHeader(header)}</th>`;
            });
        }
        
        html += `
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add data rows
        data.forEach((row, index) => {
            html += '<tr>';
            Object.values(row).forEach(value => {
                html += `<td>${this.formatValue(value)}</td>`;
            });
            html += '</tr>';
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        content.innerHTML = html;
    }

    displayReportError(message) {
        const content = document.getElementById('reportContent');
        if (!content) return;
        
        content.innerHTML = `
            <div class="report-error">
                <h3>❌ Error</h3>
                <p>${message}</p>
            </div>
        `;
    }

    formatHeader(header) {
        return header
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/_/g, ' ');
    }

    formatValue(value) {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'number') {
            return value.toLocaleString();
        }
        return value.toString();
    }

    // Report Generation Methods
    async generateTop10AllTimeReport(minAppearances, dateRange) {
        try {
            const allRankings = await this.rankingManager.getAllRankings();
            
            // Validate that we got an array
            if (!Array.isArray(allRankings)) {
                console.error('getAllRankings did not return an array:', allRankings);
                throw new Error('Failed to retrieve rankings data');
            }
            
            const filteredRankings = this.filterRankingsByDateRange(allRankings, dateRange);
            
            // Group by player and calculate metrics
            const playerStats = this.calculatePlayerStats(filteredRankings, minAppearances);
            
            // Sort by average ranking (lower is better)
            const sortedPlayers = playerStats
                .sort((a, b) => a.avgRanking - b.avgRanking)
                .slice(0, 10);
            
            return sortedPlayers.map(player => ({
                rank: 0, // Will be set by displayReport
                commander: player.commander,
                totalAppearances: player.totalAppearances,
                averageRanking: Math.round(player.avgRanking * 100) / 100,
                bestRanking: player.bestRanking,
                worstRanking: player.worstRanking,
                daysParticipated: player.daysParticipated,
                averagePoints: Math.round(player.avgPoints)
            }));
        } catch (error) {
            console.error('Error in generateTop10AllTimeReport:', error);
            throw new Error(`Failed to generate Top 10 All Time report: ${error.message}`);
        }
    }

    async generateBottom10AllTimeReport(minAppearances, dateRange) {
        try {
            const allRankings = await this.rankingManager.getAllRankings();
            
            // Validate that we got an array
            if (!Array.isArray(allRankings)) {
                console.error('getAllRankings did not return an array:', allRankings);
                throw new Error('Failed to retrieve rankings data');
            }
            
            const filteredRankings = this.filterRankingsByDateRange(allRankings, dateRange);
            
            // Get players who have achieved top 10
            const top10Achievers = new Set();
            filteredRankings.forEach(ranking => {
                if (ranking.ranking <= 10) {
                    top10Achievers.add(ranking.commander);
                }
            });
            
            // Filter out top 10 achievers and calculate stats
            const nonTop10Rankings = filteredRankings.filter(r => !top10Achievers.has(r.commander));
            const playerStats = this.calculatePlayerStats(nonTop10Rankings, minAppearances);
            
            // Sort by average ranking (higher is worse)
            const sortedPlayers = playerStats
                .sort((a, b) => b.avgRanking - a.avgRanking)
                .slice(0, 10);
            
            return sortedPlayers.map(player => ({
                rank: 0,
                commander: player.commander,
                totalAppearances: player.totalAppearances,
                averageRanking: Math.round(player.avgRanking * 100) / 100,
                bestRanking: player.bestRanking,
                worstRanking: player.worstRanking,
                daysParticipated: player.daysParticipated,
                averagePoints: Math.round(player.avgPoints)
            }));
        } catch (error) {
            console.error('Error in generateBottom10AllTimeReport:', error);
            throw new Error(`Failed to generate Bottom 10 All Time report: ${error.message}`);
        }
    }

    async generateTop10AvgPointsReport(minAppearances, dateRange) {
        try {
            const allRankings = await this.rankingManager.getAllRankings();
            
            // Validate that we got an array
            if (!Array.isArray(allRankings)) {
                console.error('getAllRankings did not return an array:', allRankings);
                throw new Error('Failed to retrieve rankings data');
            }
            
            const filteredRankings = this.filterRankingsByDateRange(allRankings, dateRange);
            
            const playerStats = this.calculatePlayerStats(filteredRankings, minAppearances);
            
            // Sort by average points (higher is better)
            const sortedPlayers = playerStats
                .filter(p => p.avgPoints > 0)
                .sort((a, b) => b.avgPoints - a.avgPoints)
                .slice(0, 10);
            
            return sortedPlayers.map(player => ({
                rank: 0,
                commander: player.commander,
                totalAppearances: player.totalAppearances,
                averagePoints: Math.round(player.avgPoints),
                averageRanking: Math.round(player.avgRanking * 100) / 100,
                bestRanking: player.bestRanking,
                daysParticipated: player.daysParticipated
            }));
        } catch (error) {
            console.error('Error in generateTop10AvgPointsReport:', error);
            throw new Error(`Failed to generate Top 10 Average Points report: ${error.message}`);
        }
    }

    async generateBottom10AvgPointsReport(minAppearances, dateRange) {
        try {
            const allRankings = await this.rankingManager.getAllRankings();
            
            // Validate that we got an array
            if (!Array.isArray(allRankings)) {
                console.error('getAllRankings did not return an array:', allRankings);
                throw new Error('Failed to retrieve rankings data');
            }
            
            const filteredRankings = this.filterRankingsByDateRange(allRankings, dateRange);
            
            const playerStats = this.calculatePlayerStats(filteredRankings, minAppearances);
            
            // Sort by average points (lower is worse)
            const sortedPlayers = playerStats
                .filter(p => p.avgPoints > 0)
                .sort((a, b) => a.avgPoints - b.avgPoints)
                .slice(0, 10);
            
            return sortedPlayers.map(player => ({
                rank: 0,
                commander: player.commander,
                totalAppearances: player.totalAppearances,
                averagePoints: Math.round(player.avgPoints),
                averageRanking: Math.round(player.avgRanking * 100) / 100,
                worstRanking: player.worstRanking,
                daysParticipated: player.daysParticipated
            }));
        } catch (error) {
            console.error('Error in generateBottom10AvgPointsReport:', error);
            throw new Error(`Failed to generate Bottom 10 Average Points report: ${error.message}`);
        }
    }

    async generateTop10WeeklyReport(minAppearances, dateRange) {
        try {
            const allRankings = await this.rankingManager.getAllRankings();
            
            // Validate that we got an array
            if (!Array.isArray(allRankings)) {
                console.error('getAllRankings did not return an array:', allRankings);
                throw new Error('Failed to retrieve rankings data');
            }
            
            const filteredRankings = this.filterRankingsByDateRange(allRankings, dateRange);
            
            // Group by week and player
            const weeklyStats = this.calculateWeeklyStats(filteredRankings, minAppearances);
            
            // Sort by total weekly points (higher is better)
            const sortedPlayers = weeklyStats
                .sort((a, b) => b.totalWeeklyPoints - a.totalWeeklyPoints)
                .slice(0, 10);
            
            return sortedPlayers.map(player => ({
                rank: 0,
                commander: player.commander,
                totalWeeklyPoints: Math.round(player.totalWeeklyPoints),
                weeksParticipated: player.weeksParticipated,
                averageWeeklyPoints: Math.round(player.avgWeeklyPoints),
                bestWeekPoints: Math.round(player.bestWeekPoints),
                totalAppearances: player.totalAppearances
            }));
        } catch (error) {
            console.error('Error in generateTop10WeeklyReport:', error);
            throw new Error(`Failed to generate Top 10 Weekly report: ${error.message}`);
        }
    }

    async generateBottom10WeeklyReport(minAppearances, dateRange) {
        try {
            const allRankings = await this.rankingManager.getAllRankings();
            
            // Validate that we got an array
            if (!Array.isArray(allRankings)) {
                console.error('getAllRankings did not return an array:', allRankings);
                throw new Error('Failed to retrieve rankings data');
            }
            
            const filteredRankings = this.filterRankingsByDateRange(allRankings, dateRange);
            
            const weeklyStats = this.calculateWeeklyStats(filteredRankings, minAppearances);
            
            // Sort by total weekly points (lower is worse)
            const sortedPlayers = weeklyStats
                .sort((a, b) => a.totalWeeklyPoints - b.totalWeeklyPoints)
                .slice(0, 10);
            
            return sortedPlayers.map(player => ({
                rank: 0,
                commander: player.commander,
                totalWeeklyPoints: Math.round(player.totalWeeklyPoints),
                weeksParticipated: player.weeksParticipated,
                averageWeeklyPoints: Math.round(player.avgWeeklyPoints),
                worstWeekPoints: Math.round(player.worstWeekPoints),
                totalAppearances: player.totalAppearances
            }));
        } catch (error) {
            console.error('Error in generateBottom10WeeklyReport:', error);
            throw new Error(`Failed to generate Bottom 10 Weekly report: ${error.message}`);
        }
    }

    // Helper methods for report generation
    filterRankingsByDateRange(rankings, dateRange) {
        // Validate input
        if (!Array.isArray(rankings)) {
            console.error('filterRankingsByDateRange: rankings is not an array:', rankings);
            return [];
        }
        
        if (dateRange === 'all') return rankings;
        
        const now = new Date();
        let cutoffDate;
        
        switch (dateRange) {
            case 'last30':
                cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'last90':
                cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case 'lastyear':
                cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                return rankings;
        }
        
        return rankings.filter(ranking => {
            try {
                if (!ranking || !ranking.day) return false;
                const rankingDate = new Date(ranking.day + 'T00:00:00');
                return !isNaN(rankingDate.getTime()) && rankingDate >= cutoffDate;
            } catch (error) {
                console.warn('Error processing ranking date:', ranking, error);
                return false;
            }
        });
    }

    calculatePlayerStats(rankings, minAppearances) {
        // Validate input
        if (!Array.isArray(rankings)) {
            console.error('calculatePlayerStats: rankings is not an array:', rankings);
            return [];
        }
        
        const playerMap = new Map();
        
        rankings.forEach(ranking => {
            try {
                if (!ranking || !ranking.commander || !ranking.ranking) {
                    console.warn('Skipping invalid ranking:', ranking);
                    return;
                }
                
                if (!playerMap.has(ranking.commander)) {
                    playerMap.set(ranking.commander, {
                        commander: ranking.commander,
                        totalAppearances: 0,
                        totalPoints: 0,
                        totalRanking: 0,
                        bestRanking: Infinity,
                        worstRanking: 0,
                        days: new Set()
                    });
                }
                
                const player = playerMap.get(ranking.commander);
                player.totalAppearances++;
                player.totalRanking += Number(ranking.ranking) || 0;
                player.bestRanking = Math.min(player.bestRanking, Number(ranking.ranking) || Infinity);
                player.worstRanking = Math.max(player.worstRanking, Number(ranking.ranking) || 0);
                player.days.add(ranking.day);
                
                // Handle points conversion
                if (ranking.points && !isNaN(Number(ranking.points))) {
                    player.totalPoints += Number(ranking.points);
                }
            } catch (error) {
                console.warn('Error processing ranking:', ranking, error);
            }
        });
        
        return Array.from(playerMap.values())
            .filter(player => player.totalAppearances >= minAppearances)
            .map(player => ({
                commander: player.commander,
                totalAppearances: player.totalAppearances,
                avgRanking: player.totalRanking / player.totalAppearances,
                avgPoints: player.totalPoints / player.totalAppearances,
                bestRanking: player.bestRanking === Infinity ? 0 : player.bestRanking,
                worstRanking: player.worstRanking,
                daysParticipated: player.days.size
            }));
    }

    calculateWeeklyStats(rankings, minAppearances) {
        // Validate input
        if (!Array.isArray(rankings)) {
            console.error('calculateWeeklyStats: rankings is not an array:', rankings);
            return [];
        }
        
        const playerMap = new Map();
        
        // Group by week and player
        rankings.forEach(ranking => {
            try {
                if (!ranking || !ranking.commander || !ranking.day) {
                    console.warn('Skipping invalid ranking for weekly stats:', ranking);
                    return;
                }
                
                const weekKey = this.getWeekKey(ranking.day);
                const playerKey = ranking.commander;
                
                if (!playerMap.has(playerKey)) {
                    playerMap.set(playerKey, {
                        commander: playerKey,
                        weeklyPoints: new Map(),
                        totalAppearances: 0
                    });
                }
                
                const player = playerMap.get(playerKey);
                player.totalAppearances++;
                
                if (!player.weeklyPoints.has(weekKey)) {
                    player.weeklyPoints.set(weekKey, 0);
                }
                
                if (ranking.points && !isNaN(Number(ranking.points))) {
                    player.weeklyPoints.set(weekKey, player.weeklyPoints.get(weekKey) + Number(ranking.points));
                }
            } catch (error) {
                console.warn('Error processing ranking for weekly stats:', ranking, error);
            }
        });
        
        return Array.from(playerMap.values())
            .filter(player => player.totalAppearances >= minAppearances)
            .map(player => {
                try {
                    const weeklyPoints = Array.from(player.weeklyPoints.values());
                    const totalWeeklyPoints = weeklyPoints.reduce((sum, points) => sum + (points || 0), 0);
                    const avgWeeklyPoints = weeklyPoints.length > 0 ? totalWeeklyPoints / weeklyPoints.length : 0;
                    const bestWeekPoints = weeklyPoints.length > 0 ? Math.max(...weeklyPoints) : 0;
                    const worstWeekPoints = weeklyPoints.length > 0 ? Math.min(...weeklyPoints) : 0;
                    
                    return {
                        commander: player.commander,
                        totalWeeklyPoints,
                        avgWeeklyPoints,
                        bestWeekPoints,
                        worstWeekPoints,
                        weeksParticipated: player.weeklyPoints.size,
                        totalAppearances: player.totalAppearances
                    };
                } catch (error) {
                    console.error('Error calculating weekly stats for player:', player, error);
                    return null;
                }
            })
            .filter(player => player !== null); // Remove any failed calculations
    }

    getWeekKey(dayString) {
        // Convert day string to week key
        try {
            const date = new Date(dayString + 'T00:00:00');
            if (isNaN(date.getTime())) {
                // If it's not a valid date, return the original string
                return dayString;
            }
            
            const year = date.getFullYear();
            const week = Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7);
            return `${year}-W${week.toString().padStart(2, '0')}`;
        } catch (error) {
            return dayString;
        }
    }
}

// Initialize the application when the page loads
window.addEventListener('load', () => {
    window.dailyRankingsApp = new DailyRankingsApp();
});