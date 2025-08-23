import { RankingManager } from './ranking-manager.js';
import { CSVProcessor } from './csv-processor.js';
import { UIManager } from './ui-manager.js';
import { LeaderVIPManager } from './leader-vip-manager.js';
import { AutocompleteService } from './autocomplete-service.js';
import { config } from './config.js';

class DailyRankingsApp {
    constructor() {
        this.rankingManager = new RankingManager();
        this.csvProcessor = new CSVProcessor();
        this.uiManager = new UIManager();
        this.leaderVIPManager = new LeaderVIPManager();
        this.autocompleteService = new AutocompleteService(this.rankingManager, this.leaderVIPManager);
        this.selectedDate = new Date();
        this.currentTabDate = null;
        this.adminAuthenticated = false;
        this.modalEventListenersSetup = false;
        
        // Set the leader VIP manager in the UI manager
        this.uiManager.setLeaderVIPManager(this.leaderVIPManager);
        
        // Wait for DOM to be ready before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.init();
            });
        } else {
            this.init();
        }
    }

    async init() {
        this.setupEventListeners();
        
        // Show admin features if admin code matches environment variable
        const isAdmin = this.isAdmin();
        console.log('Admin mode:', isAdmin);
        this.uiManager.toggleAdminFeatures(isAdmin);
        
        // Wait for data to load from database
        try {
            await this.rankingManager.initializeConnection();
        } catch (error) {
            console.warn('Ranking manager connection failed:', error);
        }
        
        try {
            await this.leaderVIPManager.initializeConnection();
        } catch (error) {
            console.warn('Leader VIP manager connection failed:', error);
        }
        
        // Initialize autocomplete service
        try {
            await this.autocompleteService.initialize();
        } catch (error) {
            console.warn('Autocomplete service initialization failed:', error);
        }
        
        // Set initial date to current week
        this.setDateToCurrentWeek();
        
        // Update UI after data is loaded
        await this.updateWeeklyTabs();
        this.uiManager.updateConnectionStatus(this.rankingManager.getConnectionStatus());
        
        // Initialize leader system UI
        this.updateLeaderDropdowns();
        this.updateRecentVIPsList();
        
        // Initialize rotation management after data is loaded
        this.updateRotationOrderList();
        
        // Initialize special events list
        this.updateSpecialEventsList();
        
        // Check if we need to create sample data
        await this.checkAndCreateSampleData();
        
        // Update version number
        this.updateVersionNumber();
        
        // Check for day parameter and navigate to specific day tab
        await this.handleDayParameter();
        
        // Set up periodic updates for rotation dates
        this.setupRotationDateUpdates();
        
        console.log('Daily Rankings Manager initialized');
    }

    setupEventListeners() {
        // Week picker change
        document.getElementById('weekPicker').addEventListener('change', (e) => {
            try {
                const weekValue = e.target.value; // Format: YYYY-Www
                if (weekValue) {
                    const [year, week] = weekValue.split('-W');
                    const yearInt = parseInt(year);
                    const weekInt = parseInt(week);
                    
                    if (isNaN(yearInt) || isNaN(weekInt)) {
                        console.error('Invalid week value format:', weekValue);
                        return;
                    }
                    
                    const date = this.getDateFromWeek(yearInt, weekInt);
                    if (date && !isNaN(date.getTime())) {
                        this.selectedDate = date;
                        this.updateWeeklyTabs();
                    } else {
                        console.error('Invalid date returned from getDateFromWeek:', date);
                        this.setDateToCurrentWeek();
                    }
                }
            } catch (error) {
                console.error('Error in week picker change:', error);
                this.setDateToCurrentWeek();
            }
        });

        // Previous/Next week buttons
        document.getElementById('prevWeek').addEventListener('click', () => {
            try {
                if (!this.selectedDate || isNaN(this.selectedDate.getTime())) {
                    console.error('Invalid selectedDate in prevWeek, resetting');
                    this.setDateToCurrentWeek();
                    return;
                }
                this.selectedDate.setDate(this.selectedDate.getDate() - 7);
                this.updateWeekPicker();
                this.updateWeeklyTabs();
            } catch (error) {
                console.error('Error in prevWeek:', error);
                this.setDateToCurrentWeek();
            }
        });

        document.getElementById('nextWeek').addEventListener('click', () => {
            try {
                if (!this.selectedDate || isNaN(this.selectedDate.getTime())) {
                    console.error('Invalid selectedDate in nextWeek, resetting');
                    this.setDateToCurrentWeek();
                    return;
                }
                this.selectedDate.setDate(this.selectedDate.getDate() + 7);
                this.updateWeekPicker();
                this.updateWeeklyTabs();
            } catch (error) {
                console.error('Error in nextWeek:', error);
                this.setDateToCurrentWeek();
            }
        });

        // Process CSV button
        document.getElementById('uploadBtn').addEventListener('click', () => {
            this.processCSVFile();
        });

        // Process pasted CSV button
        document.getElementById('pasteUploadBtn').addEventListener('click', () => {
            this.processPastedCSV();
        });

        // Special event and player management
        document.getElementById('createEventBtn').addEventListener('click', () => {
            this.createSpecialEvent();
        });
        
        document.getElementById('updatePlayerBtn').addEventListener('click', () => {
            this.updatePlayerName();
        });

        // Leader and VIP management
        document.getElementById('addLeaderBtn').addEventListener('click', () => {
            this.addAllianceLeader();
        });
        

        
        const removeLeaderBtn = document.getElementById('removeLeaderBtn');
        if (removeLeaderBtn) {
            console.log('Remove leader button found, adding event listener');
            removeLeaderBtn.addEventListener('click', () => {
                console.log('Remove leader button clicked');
                this.removeAllianceLeader();
            });
        } else {
            console.error('Remove leader button not found in DOM');
        }
        
        document.getElementById('setVIPBtn').addEventListener('click', () => {
            this.setVIPForDate();
        });



        // VIP player input change listeners for frequency display
        document.getElementById('vipPlayer').addEventListener('input', (e) => {
            this.updateVIPFrequencyDisplay('vipPlayer', e.target.value);
        });

        document.getElementById('editVipPlayer').addEventListener('input', (e) => {
            this.updateVIPFrequencyDisplay('editVipPlayer', e.target.value);
        });


        
        // Admin login button
        const adminLoginBtn = document.getElementById('adminLoginBtn');
        if (adminLoginBtn) {
            console.log('Admin login button found, adding event listener');
            adminLoginBtn.addEventListener('click', () => {
                console.log('Admin login button clicked');
                this.showAdminLoginModal();
            });
        } else {
            console.error('Admin login button not found in DOM');
        }
        
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

        // Sync data button
        const syncDataBtn = document.getElementById('syncDataBtn');
        if (syncDataBtn) {
            syncDataBtn.addEventListener('click', () => this.syncLocalData());
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
        // Check if admin is authenticated via password
        return this.adminAuthenticated;
    }

    // Legacy admin code check (for backward compatibility)
    checkLegacyAdmin() {
        const params = new URLSearchParams(window.location.search);
        const adminCode = params.get('admin');
        const expectedCode = import.meta.env.VITE_ADMIN_CODE;
        
        if (!adminCode || !expectedCode) {
            return false;
        }
        
        return adminCode === expectedCode;
    }

    exitAdminMode() {
        // Clear admin authentication and hide admin features
        this.adminAuthenticated = false;
        this.uiManager.toggleAdminFeatures(false);
        
        // Remove admin tab if it exists
        const adminTab = document.querySelector('.tab[data-type="admin"]');
        if (adminTab) {
            adminTab.remove();
        }
        
        // Clear admin-related data to prevent duplication on re-login
        this.leaderVIPManager.clearAdminData();
        
        // Show success message
        this.uiManager.showSuccess('Admin mode exited successfully');
    }

    showAdminLoginModal() {
        console.log('showAdminLoginModal called');
        const modal = document.getElementById('adminLoginModal');
        if (modal) {
            console.log('Modal found, showing it');
            modal.classList.add('show');
            this.setupAdminLoginListeners();
        } else {
            console.error('Admin login modal not found in DOM');
        }
    }

    setupAdminLoginListeners() {
        const modal = document.getElementById('adminLoginModal');
        const closeBtn = modal.querySelector('.close');
        const loginForm = document.getElementById('adminLoginForm');
        const cancelBtn = document.getElementById('cancelAdminLogin');
        
        // Close modal when clicking X
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
        
        // Handle form submission
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.authenticateAdmin();
        });
        
        // Handle cancel button
        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }

    async authenticateAdmin() {
        const password = document.getElementById('adminPassword').value;
        
        // Try environment variable first, fall back to local config
        let expectedPassword;
        try {
            expectedPassword = import.meta.env.VITE_ADMIN_PASSWORD;
        } catch (error) {
            expectedPassword = config.adminPassword;
        }
        
        if (!expectedPassword) {
            // Fallback to legacy admin code system
            if (this.checkLegacyAdmin()) {
                this.adminAuthenticated = true;
                this.uiManager.toggleAdminFeatures(true);
                document.getElementById('adminLoginModal').classList.remove('show');
                this.uiManager.showSuccess('Admin access granted via legacy code');
                return;
            }
            this.uiManager.showError('Admin system not configured');
            return;
        }
        
        if (password === expectedPassword) {
            this.adminAuthenticated = true;
            this.uiManager.toggleAdminFeatures(true);
            document.getElementById('adminLoginModal').classList.remove('show');
            document.getElementById('adminPassword').value = '';
            this.uiManager.showSuccess('Admin access granted');
            
            // Add admin tab
            await this.updateWeeklyTabs();
        } else {
            this.uiManager.showError('Invalid admin password');
            document.getElementById('adminPassword').value = '';
        }
    }

    updateVersionNumber() {
        const versionElement = document.getElementById('versionNumber');
        if (versionElement) {
            // For now, we'll use a hardcoded version since Vite doesn't expose package.json
            // In a real app, you might use import.meta.env.VITE_APP_VERSION
            versionElement.textContent = 'v1.1.11';
        }
    }

    setDateToCurrentWeek() {
        try {
            const today = new Date();
            if (isNaN(today.getTime())) {
                console.error('Error creating today date, using fallback');
                this.selectedDate = new Date('2024-01-01'); // Fallback date
            } else {
                this.selectedDate = today;
            }
            this.updateWeekPicker();
        } catch (error) {
            console.error('Error in setDateToCurrentWeek:', error);
            this.selectedDate = new Date('2024-01-01'); // Fallback date
            this.updateWeekPicker();
        }
    }

    updateWeekPicker() {
        try {
            const weekPicker = document.getElementById('weekPicker');
            if (!weekPicker) {
                console.error('Week picker element not found');
                return;
            }
            
            if (!this.selectedDate || isNaN(this.selectedDate.getTime())) {
                console.error('Invalid selectedDate in updateWeekPicker, resetting');
                this.setDateToCurrentWeek();
                return;
            }
            
            const weekValue = this.getWeekValue(this.selectedDate);
            weekPicker.value = weekValue;
        } catch (error) {
            console.error('Error in updateWeekPicker:', error);
            // Try to reset the date
            this.setDateToCurrentWeek();
        }
    }

    getWeekValue(date) {
        try {
            if (!date || isNaN(date.getTime())) {
                console.error('Invalid date passed to getWeekValue:', date);
                const today = new Date();
                return this.getWeekValue(today);
            }
            const year = date.getFullYear();
            const week = this.getWeekNumber(date);
            return `${year}-W${week.toString().padStart(2, '0')}`;
        } catch (error) {
            console.error('Error in getWeekValue:', error, 'date:', date);
            const today = new Date();
            return this.getWeekValue(today);
        }
    }

    getWeekNumber(date) {
        try {
            if (!date || isNaN(date.getTime())) {
                console.error('Invalid date passed to getWeekNumber:', date);
                return 1; // Return week 1 as fallback
            }
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        } catch (error) {
            console.error('Error in getWeekNumber:', error, 'date:', date);
            return 1; // Return week 1 as fallback
        }
    }

    getDateFromWeek(year, week) {
        try {
            if (!year || !week || isNaN(year) || isNaN(week)) {
                console.error('Invalid parameters passed to getDateFromWeek:', { year, week });
                const today = new Date();
                return this.getDateFromWeek(today.getFullYear(), this.getWeekNumber(today));
            }
            const simple = new Date(year, 0, 1 + (week - 1) * 7);
            const dow = simple.getDay();
            const ISOweekStart = simple;
            if (dow <= 4)
                ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
            else
                ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
            return ISOweekStart;
        } catch (error) {
            console.error('Error in getDateFromWeek:', error, 'year:', year, 'week:', week);
            const today = new Date();
            return this.getDateFromWeek(today.getFullYear(), this.getWeekNumber(today));
        }
    }

    getWeekDates(date) {
        try {
            const week = [];
            const startOfWeek = new Date(date);
            
            // Validate the date
            if (isNaN(startOfWeek.getTime())) {
                console.error('Invalid date passed to getWeekDates:', date);
                // Return current week as fallback
                const today = new Date();
                return this.getWeekDates(today);
            }
            
            // Get Monday of the week (0 = Sunday, 1 = Monday, etc.)
            const dayOfWeek = startOfWeek.getDay();
            const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            startOfWeek.setDate(startOfWeek.getDate() + daysToMonday);
            
            // Generate full week (Monday to Sunday)
            for (let i = 0; i < 7; i++) {
                const day = new Date(startOfWeek);
                day.setDate(startOfWeek.getDate() + i);
                week.push(day);
            }
            
            return week;
        } catch (error) {
            console.error('Error in getWeekDates:', error, 'date:', date);
            // Return current week as fallback
            const today = new Date();
            return this.getWeekDates(today);
        }
    }

    formatDateKey(date) {
        try {
            if (!date || isNaN(date.getTime())) {
                console.error('Invalid date passed to formatDateKey:', date);
                const today = new Date();
                return this.formatDateKey(today);
            }
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error('Error in formatDateKey:', error, 'date:', date);
            const today = new Date();
            return this.formatDateKey(today);
        }
    }

    formatDateDisplay(date) {
        try {
            if (!date || isNaN(date.getTime())) {
                console.error('Invalid date passed to formatDateDisplay:', date);
                return 'Invalid Date';
            }
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            const dayName = days[date.getDay()];
            const month = months[date.getMonth()];
            const dayNum = date.getDate();
            
            return `${dayName} ${month} ${dayNum}`;
        } catch (error) {
            console.error('Error in formatDateDisplay:', error, 'date:', date);
            return 'Invalid Date';
        }
    }

    formatSimpleDayName(date) {
        try {
            if (!date || isNaN(date.getTime())) {
                console.error('Invalid date passed to formatSimpleDayName:', date);
                return 'Unknown';
            }
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return days[date.getDay()];
        } catch (error) {
            console.error('Error in formatSimpleDayName:', error, 'date:', date);
            return 'Unknown';
        }
    }

    async updateWeeklyTabs() {
        // Validate selectedDate before proceeding
        if (!this.selectedDate || isNaN(this.selectedDate.getTime())) {
            console.error('Invalid selectedDate, resetting to today:', this.selectedDate);
            this.selectedDate = new Date();
        }
        
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
        
        // Add special event tabs (only if they occur within the selected week)
        const specialEvents = await this.rankingManager.getSpecialEvents();
        const weekStart = this.getWeekStart(this.selectedDate);
        const weekEnd = this.getWeekEnd(this.selectedDate);
        
        console.log('Filtering special events for week:', {
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0],
            totalEvents: specialEvents.length
        });
        
        for (const event of specialEvents) {
            // Check if event overlaps with the selected week
            const eventStart = new Date(event.start_date + 'T00:00:00');
            const eventEnd = new Date(event.end_date + 'T23:59:59');
            
            // Event overlaps if: event starts before week ends AND event ends after week starts
            const eventOverlapsWeek = eventStart <= weekEnd && eventEnd >= weekStart;
            
            console.log('Event date check:', {
                eventName: event.name,
                eventStart: event.start_date,
                eventEnd: event.end_date,
                eventStartParsed: eventStart.toISOString(),
                eventEndParsed: eventEnd.toISOString(),
                weekStart: weekStart.toISOString(),
                weekEnd: weekEnd.toISOString(),
                overlaps: eventOverlapsWeek
            });
            
            if (eventOverlapsWeek) {
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
        }
        
        // Add Reports tab
        const reportsTab = document.createElement('button');
        reportsTab.className = 'tab reports-tab';
        reportsTab.textContent = '📊 Reports';
        reportsTab.setAttribute('data-type', 'reports');
        tabsContainer.appendChild(reportsTab);
        
        // Add Admin tab (only show if admin mode is active)
        if (this.isAdmin()) {
            const adminTab = document.createElement('button');
            adminTab.className = 'tab admin-tab';
            adminTab.textContent = '🔐 Admin';
            adminTab.setAttribute('data-type', 'admin');
            tabsContainer.appendChild(adminTab);
            
            // Add click handler for admin tab
            adminTab.addEventListener('click', () => {
                this.showTab('admin');
            });
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
        
        // Check if this is the Reports tab
        if (dateKey === 'reports') {
            // Show reports tab
            document.getElementById('reportsTab').style.display = 'block';
            document.getElementById('adminTab').style.display = 'none';
            document.querySelector('.tabs-container').style.display = 'none';
            
            // Add active class to reports tab
            const reportsTab = document.querySelector('.tab[data-type="reports"]');
            if (reportsTab) {
                reportsTab.classList.add('active');
            }
            
            // Initialize reports functionality
            this.initializeReports();
            return;
        } else if (dateKey === 'admin') {
            // Show admin tab
            document.getElementById('adminTab').style.display = 'block';
            document.getElementById('reportsTab').style.display = 'none';
            document.querySelector('.tabs-container').style.display = 'none';
            
            // Add active class to admin tab
            const adminTab = document.querySelector('.tab[data-type="admin"]');
            if (adminTab) {
                adminTab.classList.add('active');
            }
            
            // Initialize admin functionality
            this.showAdminTab();
            return;
        } else {
            // Hide special tabs and show regular tabs
            document.getElementById('reportsTab').style.display = 'none';
            document.getElementById('adminTab').style.display = 'none';
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
                        true, // isSpecialEvent = true
                        new Date(dateKey + 'T00:00:00') // date parameter
                    );
                } else {
                    // Show conductor banner even when there are no rankings for special events
                    const conductorBanner = this.uiManager.createTrainConductorVIPDisplay(new Date(dateKey + 'T00:00:00'));
                    selectedContent.innerHTML = `
                        ${conductorBanner}
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
                        false, // isSpecialEvent = false
                        new Date(dateKey + 'T00:00:00') // date parameter
                    );
                } else {
                    // Show conductor banner even when there are no rankings
                    const conductorBanner = this.uiManager.createTrainConductorVIPDisplay(new Date(dateKey + 'T00:00:00'));
                    selectedContent.innerHTML = `
                        ${conductorBanner}
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
            
            // Refresh autocomplete with new player names
            await this.autocompleteService.refreshPlayerNames();
            
            // Refresh the current tab to show new data
            await this.showTab(selectedDateKey);
            this.updateDataStatus();
            
            // Clear the file input
            fileInput.value = '';
        });
    }

    async processPastedCSV() {
        const rawCsvInput = document.getElementById('rawCsvInput');
        const selectedDateKey = this.currentTabDate || this.formatDateKey(this.selectedDate);
        
        if (!rawCsvInput.value.trim()) {
            alert('Please paste CSV data into the text area.');
            return;
        }

        try {
            // Process the pasted CSV data
            const csvText = rawCsvInput.value.trim();
            const rankings = this.csvProcessor.processCSVText(csvText);
            
            if (rankings.length === 0) {
                alert('No valid rankings found in pasted CSV data.');
                return;
            }

            // Check if this is a special event
            const isSpecialEvent = selectedDateKey.startsWith('event_');
            
            // Show confirmation dialog with sample data
            const confirmed = await this.showImportConfirmation(rankings, selectedDateKey);
            
            if (!confirmed) {
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
            
            // Refresh autocomplete with new player names
            await this.autocompleteService.refreshPlayerNames();
            
            // Refresh the current tab to show new data
            await this.showTab(selectedDateKey);
            this.updateDataStatus();
            
            // Clear the textarea
            rawCsvInput.value = '';
            
        } catch (error) {
            console.error('Error processing pasted CSV:', error);
            alert('Error processing CSV data. Please check the format and try again.');
        }
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
        try {
            const eventName = document.getElementById('eventName')?.value?.trim();
            const startDate = document.getElementById('eventStartDate')?.value;
            const endDate = document.getElementById('eventEndDate')?.value;
            
            if (!eventName || !startDate || !endDate) {
                this.uiManager.showError('Please fill in all fields for the special event.');
                return;
            }
            
            // Validate date format (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
                this.uiManager.showError('Invalid date format. Please use YYYY-MM-DD format.');
                return;
            }
            
            // Validate date logic
            const startDateObj = new Date(startDate);
            const endDateObj = new Date(endDate);
            
            if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
                this.uiManager.showError('Invalid date values. Please check your input.');
                return;
            }
            
            if (startDateObj > endDateObj) {
                this.uiManager.showError('Start date must be before end date.');
                return;
            }
            
            const success = await this.rankingManager.createSpecialEvent(eventName, startDate, endDate);
            
            if (success) {
                this.uiManager.showSuccess(`Special event "${eventName}" created successfully!`);
                // Clear form
                const eventNameInput = document.getElementById('eventName');
                const eventStartDateInput = document.getElementById('eventStartDate');
                const eventEndDateInput = document.getElementById('eventEndDate');
                
                if (eventNameInput) eventNameInput.value = '';
                if (eventStartDateInput) eventStartDateInput.value = '';
                if (eventEndDateInput) eventEndDateInput.value = '';
                
                // Refresh tabs to include new special event
                await this.updateWeeklyTabs();
                
                // Refresh the special events list in admin tab
                this.updateSpecialEventsList();
            } else {
                this.uiManager.showError('Failed to create special event. Please try again.');
            }
        } catch (error) {
            console.error('Error in createSpecialEvent:', error);
            this.uiManager.showError(`Error creating special event: ${error.message}`);
        }
    }

    async updatePlayerName() {
        const oldName = document.getElementById('oldPlayerName').value.trim();
        const newName = document.getElementById('newPlayerName').value.trim();
        
        if (!oldName || !newName) {
            this.uiManager.showError('Please enter both old and new player names.');
            return;
        }
        
        if (oldName === newName) {
            this.uiManager.showError('Old and new names cannot be the same.');
            return;
        }
        
        const confirmed = confirm(`Are you sure you want to update all records for player "${oldName}" to "${newName}"? This will affect:\n\n• All ranking records\n• Alliance leader status\n• Train conductor rotation\n• VIP selections\n• Special event records\n\nThis action cannot be undone.`);
        
        if (!confirmed) {
            return;
        }
        
        try {
            // Update all references across all tables
            await this.updatePlayerNameEverywhere(oldName, newName);
            
            this.uiManager.showSuccess(`Successfully updated player name from "${oldName}" to "${newName}" across all tables.`);
            
            // Clear form
            document.getElementById('oldPlayerName').value = '';
            document.getElementById('newPlayerName').value = '';
            
            // Refresh all UI components
            this.updateLeaderDropdowns();
            this.updateRotationOrderList();
            this.updateRecentVIPsList();
            
            // Refresh current tab to show updated data
            if (this.currentTabDate) {
                await this.showTab(this.currentTabDate);
            }
        } catch (error) {
            this.uiManager.showError(`Failed to update player name: ${error.message}`);
        }
    }

    async updatePlayerNameEverywhere(oldName, newName) {
        // 1. Update ranking records
        await this.rankingManager.updatePlayerName(oldName, newName);
        
        // 2. Update alliance leaders
        await this.leaderVIPManager.updatePlayerName(oldName, newName);
        
        // 3. Update special events (if they reference player names)
        await this.rankingManager.updatePlayerNameInSpecialEvents(oldName, newName);
        
        // 4. Refresh all data to ensure consistency
        await this.leaderVIPManager.loadFromDatabase();
        await this.rankingManager.loadFromDatabase();
    }

    async addAllianceLeader() {
        const leaderName = document.getElementById('newLeaderName').value.trim();
        
        if (!leaderName) {
            this.uiManager.showError('Please enter a leader name');
            return;
        }
        
        try {
            await this.leaderVIPManager.addAllianceLeader(leaderName);
            this.uiManager.showSuccess(`Successfully added "${leaderName}" as an alliance leader`);
            
            // Clear form
            document.getElementById('newLeaderName').value = '';
            
            // Update leader dropdowns
            this.updateLeaderDropdowns();
            
            // Update rotation order list
            this.updateRotationOrderList();
        } catch (error) {
            this.uiManager.showError(`Error adding alliance leader: ${error.message}`);
        }
    }

    async removeAllianceLeader() {
        console.log('removeAllianceLeader method called');
        const leaderName = document.getElementById('removeLeaderName').value;
        console.log('Selected leader name:', leaderName);
        
        if (!leaderName) {
            this.uiManager.showError('Please select a leader to remove');
            return;
        }
        
        try {
            console.log('Calling leaderVIPManager.removeAllianceLeader...');
            await this.leaderVIPManager.removeAllianceLeader(leaderName);
            this.uiManager.showSuccess(`Successfully removed "${leaderName}" as an alliance leader`);
            
            // Update leader dropdowns
            this.updateLeaderDropdowns();
            
            // Update rotation order list
            this.updateRotationOrderList();
        } catch (error) {
            console.error('Error in removeAllianceLeader:', error);
            
            // Check if this was a soft delete (leader marked as inactive)
            if (error.message.includes('Status marked as inactive')) {
                this.uiManager.showSuccess(`Leader "${leaderName}" marked as inactive due to VIP records. They are no longer visible in active lists.`);
                
                // Even for soft delete, we need to refresh the UI
                this.updateLeaderDropdowns();
                this.updateRotationOrderList();
            } else {
                this.uiManager.showError(`Error removing alliance leader: ${error.message}`);
            }
        }
    }

    async setVIPForDate() {
        const date = document.getElementById('vipDate').value;
        const vipPlayer = document.getElementById('vipPlayer').value.trim();
        const notes = document.getElementById('vipNotes').value.trim();
        
        if (!date || !vipPlayer) {
            this.uiManager.showError('Please enter both date and VIP player name');
            return;
        }
        
        try {
            // Create date in local timezone to avoid timezone shift
            const selectedDate = this.createLocalDate(date);
            const trainConductor = this.leaderVIPManager.getCurrentTrainConductor(selectedDate);
            
            if (!trainConductor) {
                this.uiManager.showError('No train conductor available for the selected date');
                return;
            }
            
            await this.leaderVIPManager.setVIPForDate(selectedDate, trainConductor, vipPlayer, notes);
            this.uiManager.showSuccess(`Successfully set "${vipPlayer}" as VIP for ${date}`);
            
            // Show frequency info for the newly set VIP before clearing
            this.updateVIPFrequencyDisplay('vipPlayer', vipPlayer);
            
            // Clear form
            document.getElementById('vipDate').value = '';
            document.getElementById('vipPlayer').value = '';
            document.getElementById('vipNotes').value = '';
            
            // Hide frequency info after a short delay
            setTimeout(() => {
                this.updateVIPFrequencyDisplay('vipPlayer', '');
            }, 3000);
            
            // Update VIP display
            this.updateRecentVIPsList();
            
            // Refresh current tab to show VIP badges
            if (this.currentTabDate) {
                await this.showTab(this.currentTabDate);
            }
        } catch (error) {
            this.uiManager.showError(`Error setting VIP: ${error.message}`);
        }
    }

    // Helper function to create a date in local timezone
    createLocalDate(dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day); // month is 0-indexed
    }

    // Helper function to format date for display (no timezone conversion)
    formatDateForDisplay(dateString) {
        try {
            if (!dateString || typeof dateString !== 'string') {
                console.warn('Invalid date string for formatDateForDisplay:', dateString);
                return 'Invalid Date';
            }
            
            const [year, month, day] = dateString.split('-').map(Number);
            
            // Validate the parsed values
            if (isNaN(year) || isNaN(month) || isNaN(day)) {
                console.warn('Invalid date parts:', { year, month, day });
                return 'Invalid Date';
            }
            
            // Use the date parts directly to avoid timezone issues
            return `${month}/${day}/${year}`;
        } catch (error) {
            console.error('Error in formatDateForDisplay:', error);
            return 'Error';
        }
    }

    // Get week start (Monday) for a given date
    getWeekStart(date) {
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) {
                console.error('Invalid date passed to getWeekStart:', date);
                return new Date(); // Return today as fallback
            }
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
            const result = new Date(d);
            result.setDate(diff);
            return result;
        } catch (error) {
            console.error('Error in getWeekStart:', error, 'date:', date);
            return new Date(); // Return today as fallback
        }
    }

    // Get week end (Sunday) for a given date
    getWeekEnd(date) {
        try {
            const weekStart = this.getWeekStart(date);
            if (isNaN(weekStart.getTime())) {
                console.error('Invalid weekStart from getWeekStart:', weekStart);
                return new Date(); // Return today as fallback
            }
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            return weekEnd;
        } catch (error) {
            console.error('Error in getWeekEnd:', error, 'date:', date);
            return new Date(); // Return today as fallback
        }
    }

    // Get the next date a specific rotation index will be conductor
    getNextConductorDate(rotationIndex) {
        try {
            const activeRotation = this.leaderVIPManager.trainConductorRotation.filter(entry => entry.is_active);
            if (activeRotation.length === 0) return new Date();
            
            const today = new Date();
            if (isNaN(today.getTime())) {
                console.error('Error creating today date in getNextConductorDate');
                return new Date('2024-01-01'); // Fallback date
            }
            
            const startDate = new Date('2024-01-01'); // Base date for rotation calculation
            if (isNaN(startDate.getTime())) {
                console.error('Error creating start date in getNextConductorDate');
                return today;
            }
            
            // Find the next occurrence of this rotation index
            let currentDate = new Date(today);
            let daysChecked = 0;
            const maxDaysToCheck = 365; // Prevent infinite loop
            
            while (daysChecked < maxDaysToCheck) {
                const daysDiff = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
                const currentRotationIndex = daysDiff % activeRotation.length;
                
                if (currentRotationIndex === rotationIndex) {
                    return currentDate;
                }
                
                currentDate.setDate(currentDate.getDate() + 1);
                daysChecked++;
            }
            
            // Fallback to today if no future date found
            return today;
        } catch (error) {
            console.error('Error in getNextConductorDate:', error);
            return new Date('2024-01-01'); // Fallback date
        }
    }

    // Update rotation dates to show current/next dates
    updateRotationDates() {
        try {
            // This will be called periodically to update the dates
            this.updateRotationOrderList();
        } catch (error) {
            console.error('Error in updateRotationDates:', error);
        }
    }

    // Set up periodic updates for rotation dates
    setupRotationDateUpdates() {
        try {
            // Update rotation dates every hour to keep them current
            setInterval(() => {
                try {
                    this.updateRotationDates();
                } catch (error) {
                    console.error('Error in rotation date update interval:', error);
                }
            }, 60 * 60 * 1000); // 1 hour in milliseconds
            
            // Also update when the page becomes visible (user returns to tab)
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    try {
                        this.updateRotationDates();
                    } catch (error) {
                        console.error('Error in rotation date visibility update:', error);
                    }
                }
            });
        } catch (error) {
            console.error('Error in setupRotationDateUpdates:', error);
        }
    }

    // Check if we need to create sample data for testing
    async checkAndCreateSampleData() {
        try {
            const hasLeaders = this.leaderVIPManager.allianceLeaders.length > 0;
            const hasRotation = this.leaderVIPManager.trainConductorRotation.length > 0;
            
            console.log('Data check:', { hasLeaders, hasRotation });
            console.log('Alliance leaders:', this.leaderVIPManager.allianceLeaders);
            console.log('Train conductor rotation:', this.leaderVIPManager.trainConductorRotation);
            
            if (!hasLeaders && !hasRotation) {
                console.log('No data found, creating sample alliance leaders...');
                
                // Create some sample alliance leaders for testing
                const sampleLeaders = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
                
                for (const leaderName of sampleLeaders) {
                    try {
                        await this.leaderVIPManager.addAllianceLeader(leaderName);
                        console.log(`Added sample leader: ${leaderName}`);
                    } catch (error) {
                        console.log(`Could not add sample leader ${leaderName}:`, error.message);
                    }
                }
                
                // Refresh the rotation display
                this.updateRotationOrderList();
                

            }
        } catch (error) {
            console.error('Error in checkAndCreateSampleData:', error);
        }
    }



    // Update special events list in admin tab
    async updateSpecialEventsList() {
        const eventsListContainer = document.getElementById('currentEventsList');
        const eventCountElement = document.getElementById('eventCount');
        
        if (!eventsListContainer || !eventCountElement) {
            console.log('Special events list elements not found');
            return;
        }
        
        try {
            const specialEvents = await this.rankingManager.getSpecialEvents();
            console.log('All special events:', specialEvents);
            
            // Update event count
            eventCountElement.textContent = specialEvents.length;
            
            if (specialEvents.length === 0) {
                eventsListContainer.innerHTML = '<p class="no-events">No special events found.</p>';
                return;
            }
            
            let html = '';
            specialEvents.forEach(event => {
                try {
                    const startDate = new Date(event.start_date);
                    const endDate = new Date(event.end_date);
                    
                    // Validate dates
                    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                        console.error('Invalid date in special event:', event);
                        return; // Skip this event
                    }
                    
                    const startDateStr = startDate.toLocaleDateString();
                    const endDateStr = endDate.toLocaleDateString();
                
                html += `
                    <div class="event-entry" data-event-key="${this.escapeHTML(event.key)}" data-event-name="${this.escapeHTML(event.name)}" data-start-date="${event.start_date}" data-end-date="${event.end_date}">
                        <div class="event-info">
                            <div class="event-name">${this.escapeHTML(event.name)}</div>
                            <div class="event-dates">${startDateStr} - ${endDateStr}</div>
                            <div class="event-key">Key: ${this.escapeHTML(event.key)}</div>
                        </div>
                        <div class="event-actions">
                            <button class="event-btn edit" data-action="edit">✏️ Edit</button>
                            <button class="event-btn delete" data-action="delete">🗑️ Delete</button>
                        </div>
                    </div>
                `;
                } catch (error) {
                    console.error('Error processing special event:', event, error);
                    // Skip this event and continue with the next one
                }
            });
            
            eventsListContainer.innerHTML = html;
            
            // Setup event delegation for edit/delete buttons
            this.setupSpecialEventListeners();
            
        } catch (error) {
            console.error('Error updating special events list:', error);
            eventsListContainer.innerHTML = '<p class="error">Error loading special events.</p>';
        }
    }

    // Setup event delegation for special event buttons
    setupSpecialEventListeners() {
        const eventsListContainer = document.getElementById('currentEventsList');
        if (!eventsListContainer) return;
        
        eventsListContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('event-btn')) {
                const eventEntry = e.target.closest('.event-entry');
                if (!eventEntry) return;
                
                const eventKey = eventEntry.dataset.eventKey;
                const eventName = eventEntry.dataset.eventName;
                const startDate = eventEntry.dataset.startDate;
                const endDate = eventEntry.dataset.endDate;
                
                if (e.target.dataset.action === 'edit') {
                    this.editSpecialEvent(eventKey, eventName, startDate, endDate);
                } else if (e.target.dataset.action === 'delete') {
                    this.deleteSpecialEvent(eventKey);
                }
            }
        });
    }

    // Edit special event
    editSpecialEvent(eventKey, eventName, startDate, endDate) {
        try {
            console.log('Editing special event:', { eventKey, eventName, startDate, endDate });
            
            // Validate parameters
            if (!eventKey || !eventName || !startDate || !endDate) {
                console.error('Missing required parameters for editSpecialEvent:', { eventKey, eventName, startDate, endDate });
                return;
            }
            
            // Populate the edit modal
            const editEventKey = document.getElementById('editEventKey');
            const editEventName = document.getElementById('editEventName');
            const editEventStartDate = document.getElementById('editEventStartDate');
            const editEventEndDate = document.getElementById('editEventEndDate');
            
            if (editEventKey) editEventKey.value = eventKey;
            if (editEventName) editEventName.value = eventName;
            if (editEventStartDate) editEventStartDate.value = startDate;
            if (editEventEndDate) editEventEndDate.value = endDate;
            
            // Show the modal
            const modal = document.getElementById('eventEditModal');
            if (modal) {
                modal.classList.add('show');
                // Setup event listeners for the modal
                this.setupEventEditModalListeners();
            } else {
                console.error('Event edit modal not found');
            }
        } catch (error) {
            console.error('Error in editSpecialEvent:', error);
        }
    }

    // Delete special event
    async deleteSpecialEvent(eventKey) {
        try {
            if (!eventKey) {
                console.error('No event key provided for deletion');
                return;
            }
            
            if (confirm(`Are you sure you want to delete the special event "${eventKey}"? This will also remove all associated rankings.`)) {
                // Delete the event and its rankings
                await this.rankingManager.deleteSpecialEvent(eventKey);
                this.uiManager.showSuccess('Special event deleted successfully!');
                
                // Refresh the events list
                this.updateSpecialEventsList();
                
                // Refresh the weekly tabs to remove the event tab
                await this.updateWeeklyTabs();
            }
        } catch (error) {
            console.error('Error deleting special event:', error);
            this.uiManager.showError(`Error deleting special event: ${error.message}`);
        }
    }

    // Setup event edit modal event listeners
    setupEventEditModalListeners() {
        try {
            const modal = document.getElementById('eventEditModal');
            if (!modal) {
                console.error('Event edit modal not found');
                return;
            }
            
            const closeBtn = modal.querySelector('.close');
            const form = document.getElementById('eventEditForm');
            const deleteBtn = document.getElementById('deleteEventBtn');
            
            if (!closeBtn || !form || !deleteBtn) {
                console.error('Required modal elements not found:', { closeBtn: !!closeBtn, form: !!form, deleteBtn: !!deleteBtn });
                return;
            }
            
            // Close modal on X click
            closeBtn.onclick = () => {
                modal.classList.remove('show');
            };
            
            // Close modal on outside click
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            };
            
            // Handle form submission
            form.onsubmit = async (e) => {
                e.preventDefault();
                await this.updateSpecialEvent();
            };
            
            // Handle delete button
            deleteBtn.onclick = async () => {
                const eventKey = document.getElementById('editEventKey')?.value;
                if (eventKey) {
                    await this.deleteSpecialEvent(eventKey);
                    modal.classList.remove('show');
                } else {
                    console.error('No event key found for deletion');
                }
            };
        } catch (error) {
            console.error('Error in setupEventEditModalListeners:', error);
        }
    }

    // Update special event
    async updateSpecialEvent() {
        try {
            const eventKey = document.getElementById('editEventKey')?.value;
            const eventName = document.getElementById('editEventName')?.value?.trim();
            const startDate = document.getElementById('editEventStartDate')?.value;
            const endDate = document.getElementById('editEventEndDate')?.value;
            
            if (!eventKey || !eventName || !startDate || !endDate) {
                this.uiManager.showError('Please fill in all fields');
                return;
            }
            
            // Validate date format (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
                this.uiManager.showError('Invalid date format. Please use YYYY-MM-DD format.');
                return;
            }
            
            // Update the special event
            await this.rankingManager.updateSpecialEvent(eventKey, {
                name: eventName,
                start_date: startDate,
                end_date: endDate
            });
            
            this.uiManager.showSuccess('Special event updated successfully!');
            
            // Close the modal
            const modal = document.getElementById('eventEditModal');
            if (modal) {
                modal.classList.remove('show');
            }
            
            // Refresh the events list
            this.updateSpecialEventsList();
            
            // Refresh the weekly tabs to update the event tab
            await this.updateWeeklyTabs();
            
        } catch (error) {
            console.error('Error updating special event:', error);
            this.uiManager.showError(`Error updating special event: ${error.message}`);
        }
    }



    // Update VIP frequency display
    updateVIPFrequencyDisplay(inputId, playerName) {
        const frequencyInfoElement = document.getElementById(inputId === 'vipPlayer' ? 'vipFrequencyInfo' : 'editVipFrequencyInfo');
        if (!frequencyInfoElement) {
            return;
        }
        
        const daysAgoBadge = frequencyInfoElement.querySelector('.days-ago');
        const count30DaysBadge = frequencyInfoElement.querySelector('.count-30-days');
        
        if (!daysAgoBadge || !count30DaysBadge) {
            return;
        }
        
        if (!playerName || playerName.trim() === '') {
            frequencyInfoElement.style.display = 'none';
            return;
        }
        
        const frequencyData = this.leaderVIPManager.getVIPFrequencyInfo(playerName);
        
        if (frequencyData.lastSelectedDays === null) {
            // Player has never been VIP
            daysAgoBadge.textContent = 'Never VIP';
            count30DaysBadge.textContent = '0 times (30d)';
        } else {
            daysAgoBadge.textContent = `${frequencyData.lastSelectedDays} days ago`;
            count30DaysBadge.textContent = `${frequencyData.frequency30Days} times (30d)`;
        }
        
        frequencyInfoElement.style.display = 'flex';
    }



    updateLeaderDropdowns() {
        const removeDropdown = document.getElementById('removeLeaderName');
        // Only show active leaders in dropdown
        const activeLeaders = this.leaderVIPManager.allianceLeaders.filter(leader => leader.is_active);
        
        // Clear existing options
        removeDropdown.innerHTML = '<option value="">Select leader to remove...</option>';
        
        // Add active leaders
        activeLeaders.forEach(leader => {
            const option = document.createElement('option');
            option.value = leader.player_name;
            option.textContent = leader.player_name;
            removeDropdown.appendChild(option);
        });
        
        // Update current leaders display
        this.updateCurrentLeadersList();
    }

    updateCurrentLeadersList() {
        const currentLeadersContainer = document.getElementById('currentLeadersList');
        const leaderCountElement = document.getElementById('leaderCount');
        
        // Debug: Log all leaders and their status
        console.log('All alliance leaders:', this.leaderVIPManager.allianceLeaders);
        
        // Only show active leaders
        const currentLeaders = this.leaderVIPManager.allianceLeaders.filter(leader => leader.is_active);
        
        console.log('Active alliance leaders:', currentLeaders);
        
        // Update the count in the heading
        if (leaderCountElement) {
            leaderCountElement.textContent = currentLeaders.length;
        }
        
        if (currentLeaders.length === 0) {
            currentLeadersContainer.innerHTML = '<p class="no-leaders">No active alliance leaders found</p>';
            return;
        }
        
        // Create 2-column layout
        let html = '<div class="leaders-grid">';
        
        currentLeaders.forEach(leader => {
            html += `
                <div class="leader-entry">
                    <div class="leader-name">${this.escapeHTML(leader.player_name)}</div>
                    <div class="leader-status">Active</div>
                </div>
            `;
        });
        
        html += '</div>';
        currentLeadersContainer.innerHTML = html;
    }

    escapeHTML(str) {
        if (typeof str !== 'string') return str;
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

    updateRecentVIPsList() {
        const recentVIPsContainer = document.getElementById('recentVIPsList');
        const recentVIPs = this.leaderVIPManager.getRecentVIPs(10);
        
        if (recentVIPs.length === 0) {
            recentVIPsContainer.innerHTML = '<p class="no-vips">No VIP selections found</p>';
            return;
        }
        
        let html = '';
        recentVIPs.forEach(vip => {
            const date = this.formatDateForDisplay(vip.date);
            html += `
                <div class="vip-entry">
                    <div class="vip-date">${date}</div>
                    <div class="vip-details">
                        <div class="vip-player">${this.escapeHTML(vip.vip_player)}</div>
                        <div class="vip-conductor">Conductor: ${this.escapeHTML(vip.train_conductor)}</div>
                        ${vip.notes ? `<div class="vip-notes">${this.escapeHTML(vip.notes)}</div>` : ''}
                    </div>
                    <div class="vip-actions">
                        <button class="edit-vip-btn" data-date="${vip.date}" data-vip="${vip.vip_player}" data-notes="${vip.notes || ''}" data-conductor="${vip.train_conductor}">✏️ Edit</button>
                    </div>
                </div>
                `;
        });
        
        recentVIPsContainer.innerHTML = html;
        
        // Add event listeners to edit buttons
        this.setupVIPEditListeners();
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
                // Abbreviated forms
                'mon': 'Monday',
                'tue': 'Tuesday', 
                'wed': 'Wednesday',
                'thu': 'Thursday',
                'fri': 'Friday',
                'sat': 'Saturday',
                'sun': 'Sunday',
                // Full day names
                'monday': 'Monday',
                'tuesday': 'Tuesday',
                'wednesday': 'Wednesday',
                'thursday': 'Thursday',
                'friday': 'Friday',
                'saturday': 'Saturday',
                'sunday': 'Sunday'
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

    showAdminTab() {
        // Set current date for VIP form
        const today = new Date();
        document.getElementById('vipDate').value = this.formatDateForInput(today);
        
        // Update leader dropdowns and current leaders list
        this.updateLeaderDropdowns();
        
        // Update recent VIPs list
        this.updateRecentVIPsList();
        

        
        // Setup autocomplete for leader and VIP inputs
        this.setupAutocomplete();
        
        // Setup train conductor rotation management
        this.setupRotationManagement();
    }

    // Helper function to format date for input fields (local timezone)
    formatDateForInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    setupRotationManagement() {
        this.updateRotationOrderList();
        this.setupRotationEventListeners();
    }

    updateRotationOrderList() {
        const rotationContainer = document.getElementById('rotationOrderList');
        if (!rotationContainer) {
            console.error('Rotation container not found');
            return;
        }
        
        console.log('Current train conductor rotation:', this.leaderVIPManager.trainConductorRotation);
        console.log('All rotation entries with is_active status:');
        this.leaderVIPManager.trainConductorRotation.forEach((entry, index) => {
            console.log(`  ${index}: ${entry.player_name} - is_active: ${entry.is_active}`);
        });
        
        // Only show active rotation entries
        const activeRotation = this.leaderVIPManager.trainConductorRotation.filter(entry => entry.is_active);
        console.log('Active rotation entries:', activeRotation);
        
        if (!activeRotation || activeRotation.length === 0) {
            rotationContainer.innerHTML = '<p class="no-rotation">No active rotation order set. Add alliance leaders first.</p>';
            return;
        }
        
        let html = '';
        activeRotation.forEach((leader, index) => {
            try {
                // Calculate the next date this leader will be conductor
                const nextConductorDate = this.getNextConductorDate(index);
                
                // Validate the returned date
                if (!nextConductorDate || isNaN(nextConductorDate.getTime())) {
                    console.error(`Invalid date returned from getNextConductorDate for index ${index}:`, nextConductorDate);
                    throw new Error('Invalid conductor date');
                }
                
                // Convert Date object to YYYY-MM-DD string for formatDateForDisplay
                const dateString = nextConductorDate.toISOString().split('T')[0];
                const dateDisplay = this.formatDateForDisplay(dateString);
                
                html += `
                    <div class="rotation-item" draggable="true" data-index="${index}" data-leader="${leader.player_name}">
                        <div class="rotation-order">${index + 1}</div>
                        <div class="rotation-leader-name">${this.escapeHTML(leader.player_name)}</div>
                        <div class="rotation-date">${dateDisplay}</div>
                        <div class="rotation-controls">
                            <button class="rotation-btn up" ${index === 0 ? 'disabled' : ''} data-action="up" data-index="${index}">↑</button>
                            <button class="rotation-btn down" ${index === activeRotation.length - 1 ? 'disabled' : ''} data-action="down" data-index="${index}">↓</button>
                            <button class="rotation-btn remove" data-action="remove" data-index="${index}" data-leader="${leader.player_name}">❌</button>
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error(`Error rendering rotation item for ${leader.player_name}:`, error);
                // Fallback: render without date
                html += `
                    <div class="rotation-item" draggable="true" data-index="${index}" data-leader="${leader.player_name}">
                        <div class="rotation-order">${index + 1}</div>
                        <div class="rotation-leader-name">${this.escapeHTML(leader.player_name)}</div>
                        <div class="rotation-date">Error</div>
                        <div class="rotation-controls">
                            <button class="rotation-btn up" ${index === 0 ? 'disabled' : ''} data-action="up" data-index="${index}">↑</button>
                            <button class="rotation-btn down" ${index === activeRotation.length - 1 ? 'disabled' : ''} data-action="down" data-index="${index}">↓</button>
                            <button class="rotation-btn remove" data-action="remove" data-index="${index}" data-leader="${leader.player_name}">❌</button>
                        </div>
                    </div>
                `;
            }
        });
        
        rotationContainer.innerHTML = html;
        
        console.log('Rotation HTML rendered:', html);
        console.log('Rotation container children:', rotationContainer.children.length);
        
        // Setup drag and drop after rendering
        this.setupDragAndDrop();
    }

    setupRotationEventListeners() {
        const rotationContainer = document.getElementById('rotationOrderList');
        if (!rotationContainer) return;
        
        // Handle up/down/remove button clicks
        rotationContainer.addEventListener('click', async (e) => {
            if (e.target.classList.contains('rotation-btn')) {
                const action = e.target.getAttribute('data-action');
                const index = parseInt(e.target.getAttribute('data-index'));
                
                if (action === 'up' && index > 0) {
                    await this.moveRotationItem(index, 'up');
                } else if (action === 'down' && index < this.leaderVIPManager.trainConductorRotation.length - 1) {
                    await this.moveRotationItem(index, 'down');
                } else if (action === 'remove') {
                    const leaderName = e.target.getAttribute('data-leader');
                    await this.removeFromRotation(index, leaderName);
                }
            }
        });
    }

    setupDragAndDrop() {
        const rotationContainer = document.getElementById('rotationOrderList');
        if (!rotationContainer) return;

        const items = rotationContainer.querySelectorAll('.rotation-item');
        
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.index);
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggingItem = rotationContainer.querySelector('.dragging');
                if (draggingItem && draggingItem !== item) {
                    item.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', async (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                
                const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const dropIndex = parseInt(item.dataset.index);
                
                if (draggedIndex !== dropIndex) {
                    await this.reorderRotationByDrag(draggedIndex, dropIndex);
                }
            });
        });
    }

    async reorderRotationByDrag(draggedIndex, dropIndex) {
        const rotation = [...this.leaderVIPManager.trainConductorRotation];
        const draggedItem = rotation[draggedIndex];
        
        // Remove the dragged item
        rotation.splice(draggedIndex, 1);
        
        // Insert at the new position
        rotation.splice(dropIndex, 0, draggedItem);
        
        // Update rotation order numbers
        rotation.forEach((leader, i) => {
            leader.rotation_order = i + 1;
        });
        
        try {
            await this.leaderVIPManager.updateTrainConductorRotation(rotation);
            this.updateRotationOrderList();
            this.uiManager.showSuccess('Train conductor rotation reordered successfully!');
        } catch (error) {
            this.uiManager.showError(`Error reordering rotation: ${error.message}`);
        }
    }

    async removeFromRotation(index, leaderName) {
        if (confirm(`Are you sure you want to remove "${leaderName}" from the train conductor rotation?`)) {
            try {
                // Remove from rotation
                await this.leaderVIPManager.removeFromTrainConductorRotation(index);
                
                // Refresh the rotation display
                this.updateRotationOrderList();
                
                // Show success message
                this.uiManager.showSuccess(`"${leaderName}" removed from train conductor rotation`);
            } catch (error) {
                this.uiManager.showError(`Error removing from rotation: ${error.message}`);
            }
        }
    }

    async moveRotationItem(index, direction) {
        const rotation = [...this.leaderVIPManager.trainConductorRotation];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        
        // Swap the items
        [rotation[index], rotation[newIndex]] = [rotation[newIndex], rotation[index]];
        
        // Update the rotation order numbers
        rotation.forEach((leader, i) => {
            leader.rotation_order = i + 1;
        });
        
        try {
            await this.leaderVIPManager.updateTrainConductorRotation(rotation);
            this.updateRotationOrderList();
            this.uiManager.showSuccess('Train conductor rotation updated successfully!');
        } catch (error) {
            this.uiManager.showError(`Error updating rotation: ${error.message}`);
        }
    }

    setupAutocomplete() {
        // Setup autocomplete for old player name input (include all players)
        const oldPlayerInput = document.getElementById('oldPlayerName');
        const oldPlayerAutocomplete = document.getElementById('oldPlayerAutocomplete');
        
        if (oldPlayerInput && oldPlayerAutocomplete) {
            this.autocompleteService.setupAutocomplete(
                oldPlayerInput, 
                oldPlayerAutocomplete, 
                (selectedName) => {
                    oldPlayerInput.value = selectedName;
                },
                false // Don't exclude leaders for old player name selection
            );
        }
        
        // Setup autocomplete for new leader input (include all players)
        const newLeaderInput = document.getElementById('newLeaderName');
        const leaderAutocomplete = document.getElementById('leaderAutocomplete');
        
        if (newLeaderInput && leaderAutocomplete) {
            this.autocompleteService.setupAutocomplete(
                newLeaderInput, 
                leaderAutocomplete, 
                (selectedName) => {
                    newLeaderInput.value = selectedName;
                },
                false // Don't exclude leaders for leader selection
            );
        }
        
        // Setup autocomplete for VIP player input (exclude leaders)
        const vipPlayerInput = document.getElementById('vipPlayer');
        const vipAutocomplete = document.getElementById('vipAutocomplete');
        
        if (vipPlayerInput && vipAutocomplete) {
            this.autocompleteService.setupAutocomplete(
                vipPlayerInput, 
                vipAutocomplete, 
                (selectedName) => {
                    vipPlayerInput.value = selectedName;
                },
                true // Exclude leaders from VIP selection
            );
        }
    }

    setupVIPEditListeners() {
        const editButtons = document.querySelectorAll('.edit-vip-btn');
        editButtons.forEach(button => {
            // Remove any existing event listeners to prevent duplicates
            button.removeEventListener('click', this.handleEditVIPClick);
            // Add the event listener
            button.addEventListener('click', this.handleEditVIPClick);
        });
    }

    // Handler for edit VIP button clicks (bound to this instance)
    handleEditVIPClick = (event) => {
        const button = event.currentTarget;
        this.openVIPEditModal(button.dataset.date, button.dataset.vip, button.dataset.notes, button.dataset.conductor);
    }

    openVIPEditModal(date, vipPlayer, notes, conductor) {
        const modal = document.getElementById('vipEditModal');
        const editVipDate = document.getElementById('editVipDate');
        const editVipPlayer = document.getElementById('editVipPlayer');
        const editVipConductor = document.getElementById('editVipConductor');
        const editVipNotes = document.getElementById('editVipNotes');
        
        // Populate the form
        editVipDate.value = date;
        editVipPlayer.value = vipPlayer;
        editVipConductor.value = conductor || '';
        editVipNotes.value = notes;
        
        // Show frequency info for current VIP player
        this.updateVIPFrequencyDisplay('editVipPlayer', vipPlayer);
        
        // Setup autocomplete for edit form
        const editVipAutocomplete = document.getElementById('editVipAutocomplete');
        if (editVipAutocomplete) {
            this.autocompleteService.setupAutocomplete(
                editVipPlayer,
                editVipAutocomplete,
                (selectedName) => {
                    editVipPlayer.value = selectedName;
                },
                true // Exclude leaders from VIP selection
            );
        }
        
        // Setup autocomplete for conductor field (alliance leaders only)
        const editVipConductorAutocomplete = document.getElementById('editVipConductorAutocomplete');
        if (editVipConductorAutocomplete) {
            this.autocompleteService.setupAutocomplete(
                editVipConductor,
                editVipConductorAutocomplete,
                (selectedName) => {
                    editVipConductor.value = selectedName;
                },
                false // Include all players for conductor selection
            );
        }
        
        // Show the modal
        modal.classList.add('show');
        
        // Setup modal event listeners only once
        if (!this.modalEventListenersSetup) {
            this.setupModalEventListeners();
            this.modalEventListenersSetup = true;
        }
    }

    setupModalEventListeners() {
        const modal = document.getElementById('vipEditModal');
        const closeBtn = modal.querySelector('.close');
        const editForm = document.getElementById('vipEditForm');
        const deleteBtn = document.getElementById('deleteVipBtn');
        
        // Remove any existing event listeners to prevent duplicates
        closeBtn.removeEventListener('click', this.handleModalClose);
        modal.removeEventListener('click', this.handleModalOutsideClick);
        editForm.removeEventListener('submit', this.handleVIPFormSubmit);
        deleteBtn.removeEventListener('click', this.handleVIPDelete);
        
        // Close modal when clicking X
        closeBtn.addEventListener('click', this.handleModalClose);
        
        // Close modal when clicking outside
        modal.addEventListener('click', this.handleModalOutsideClick);
        
        // Handle form submission
        editForm.addEventListener('submit', this.handleVIPFormSubmit);
        
        // Handle delete button
        deleteBtn.addEventListener('click', this.handleVIPDelete);
    }

    // Modal event handlers (bound to this instance)
    handleModalClose = () => {
        document.getElementById('vipEditModal').classList.remove('show');
        // Clear frequency display when modal is closed
        this.updateVIPFrequencyDisplay('editVipPlayer', '');
    }

    handleModalOutsideClick = (e) => {
        if (e.target === e.currentTarget) {
            e.currentTarget.classList.remove('show');
            // Clear frequency display when modal is closed
            this.updateVIPFrequencyDisplay('editVipPlayer', '');
        }
    }

    handleVIPFormSubmit = async (e) => {
        e.preventDefault();
        await this.updateVIPEntry();
    }

    handleVIPDelete = async () => {
        if (confirm('Are you sure you want to delete this VIP selection?')) {
            await this.deleteVIPEntry();
        }
    }

    async updateVIPEntry() {
        const date = document.getElementById('editVipDate').value;
        const vipPlayer = document.getElementById('editVipPlayer').value;
        const conductor = document.getElementById('editVipConductor').value;
        const notes = document.getElementById('editVipNotes').value;
        
        if (!vipPlayer.trim()) {
            this.uiManager.showError('VIP player name is required');
            return;
        }
        
        if (!conductor.trim()) {
            this.uiManager.showError('Train conductor is required');
            return;
        }
        
        try {
            // Update the VIP entry with manually selected conductor
            const vipDate = this.createLocalDate(date);
            await this.leaderVIPManager.setVIPForDate(vipDate, conductor, vipPlayer, notes);
            
            // Close modal and refresh lists
            document.getElementById('vipEditModal').classList.remove('show');
            this.updateRecentVIPsList();
            
            this.uiManager.showSuccess('VIP entry updated successfully!');
        } catch (error) {
            this.uiManager.showError(`Error updating VIP: ${error.message}`);
        }
    }

    async deleteVIPEntry() {
        const date = document.getElementById('editVipDate').value;
        
        try {
            // Delete the VIP entry
            await this.leaderVIPManager.deleteVIPForDate(this.createLocalDate(date));
            
            // Close modal and refresh lists
            document.getElementById('vipEditModal').classList.remove('show');
            this.updateRecentVIPsList();
            
            this.uiManager.showSuccess('VIP entry deleted successfully!');
        } catch (error) {
            this.uiManager.showError(`Error deleting VIP: ${error.message}`);
        }
    }

    async syncLocalData() {
        try {
            this.uiManager.showSuccess('Starting data sync...');
            await this.leaderVIPManager.syncLocalDataToDatabase();
            this.uiManager.showSuccess('Data sync completed successfully!');
            
            // Refresh UI to show synced data
            this.updateLeaderDropdowns();
            this.updateRecentVIPsList();
        } catch (error) {
            this.uiManager.showError(`Error syncing data: ${error.message}`);
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