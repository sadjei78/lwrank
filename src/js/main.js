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
                await this.showTab(dateKey);
            }
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
}

// Initialize the application when the page loads
window.addEventListener('load', () => {
    window.dailyRankingsApp = new DailyRankingsApp();
});