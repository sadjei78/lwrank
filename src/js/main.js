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
        
        // Show admin features if admin=true in URL
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
        document.getElementById('csvFileBtn').addEventListener('click', () => {
            this.processCSVFile();
        });

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
        return params.get('admin') === 'true';
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
        
        // Generate weekdays (Monday to Friday)
        for (let i = 0; i < 5; i++) {
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
            
            // Load and display rankings for this date
            const rankings = await this.rankingManager.getRankingsForDate(dateKey);
            console.log('Rankings for', dateKey, ':', rankings);
            
            // Ensure we're using the correct date for display
            const date = new Date(dateKey + 'T00:00:00'); // Ensure correct date parsing
            const displayName = this.formatDateDisplay(date);
            
            // Get weekly statistics for enhanced display
            const weekDates = this.getWeekDates(this.selectedDate);
            const top10Occurrences = this.rankingManager.getWeeklyTop10Occurrences(weekDates);
            const cumulativeScores = this.rankingManager.getWeeklyCumulativeScores(weekDates);
            
            if (rankings && rankings.length > 0) {
                selectedContent.innerHTML = this.uiManager.createRankingTable(
                    rankings, 
                    displayName, 
                    top10Occurrences, 
                    cumulativeScores
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

            const uniqueRankings = this.rankingManager.removeDuplicateRankings(rankings);
            await this.rankingManager.setRankingsForDate(selectedDateKey, uniqueRankings);
            
            // Refresh the current tab to show new data
            await this.showTab(selectedDateKey);
            const selectedDate = new Date(selectedDateKey);
            this.uiManager.showSuccess(`Successfully processed ${uniqueRankings.length} rankings for ${this.formatDateDisplay(selectedDate)}!`);
            this.updateDataStatus();
            
            // Clear the file input
            fileInput.value = '';
        });
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