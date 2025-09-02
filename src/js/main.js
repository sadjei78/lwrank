import { RankingManager } from './ranking-manager.js';
import { CSVProcessor } from './csv-processor.js';
import { UIManager } from './ui-manager.js';
import { LeaderVIPManager } from './leader-vip-manager.js';
import { AutocompleteService } from './autocomplete-service.js';
import { SeasonRankingManager } from './season-ranking-manager.js';
import { config } from './config.js';

class DailyRankingsApp {
    constructor() {
        this.rankingManager = new RankingManager();
        this.csvProcessor = new CSVProcessor();
        this.uiManager = new UIManager();
        this.leaderVIPManager = new LeaderVIPManager();
        this.autocompleteService = new AutocompleteService(this.rankingManager, this.leaderVIPManager);
        this.seasonRankingManager = new SeasonRankingManager(this.rankingManager, this.leaderVIPManager);
        this.selectedDate = new Date();
        this.currentTabDate = null;
        this.adminAuthenticated = false;
        this.modalEventListenersSetup = false;
        
        // Set the leader VIP manager in the UI manager
        this.uiManager.setLeaderVIPManager(this.leaderVIPManager);
        this.uiManager.setRankingManager(this.rankingManager);
        
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
        
        // Initialize Supabase connection
        try {
            console.log('Starting Supabase initialization...');
            const { initializeSupabase } = await import('./supabase-client.js');
            await initializeSupabase();
            console.log('Supabase initialization completed');
        } catch (error) {
            console.warn('Supabase initialization failed:', error);
        }
        
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
        const connectionStatus = await this.rankingManager.getConnectionStatus();
        this.uiManager.updateConnectionStatus(connectionStatus);
        
        // Admin functionality will be initialized when admin content loads
        // (Leader dropdowns, VIP lists, rotation management, special events)
        
        // Check if we need to create sample data
        await this.checkAndCreateSampleData();
        
        // Update version number
        this.updateVersionNumber();
        
        // Check for day parameter and navigate to specific day tab
        await this.handleDayParameter();
        
        // Set up periodic updates for rotation dates
        this.setupRotationDateUpdates();
        
        console.log('Daily Rankings Manager initialized');
        console.log('🚀 LWRank v1.1.68 loaded successfully!');
        console.log('📝 VIP frequency real-time updates are now active');
        console.log('🔍 Check browser console for VIP frequency debugging');
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

        // Admin-specific event listeners will be set up when admin content loads

        // Admin-specific event listeners will be set up when admin content loads
        

        

        
        // Admin-specific event listeners will be set up when admin content loads



        // VIP player input change listeners for frequency display - will be set up when admin tab loads
        // These are set up in showAdminTab() to ensure DOM elements exist


        
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

        // Admin banner clickable to return to admin tab
        const adminBannerClickable = document.getElementById('adminBannerClickable');
        if (adminBannerClickable) {
            adminBannerClickable.addEventListener('click', async () => {
                try {
                    await this.navigateToAdminTab();
                } catch (error) {
                    console.error('Error navigating to admin tab:', error);
                    this.uiManager.showError('Error navigating to admin tab. Please try again.');
                }
            });
        }

        // Admin-specific event listeners will be set up when admin content loads



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
        console.log('Setting up collapsible sections, found:', collapsibleHeaders.length, 'headers');
        
        if (collapsibleHeaders.length === 0) {
            console.warn('No collapsible headers found - admin content may not be loaded yet');
            return;
        }
        
        collapsibleHeaders.forEach((header, index) => {
            console.log(`Setting up collapsible header ${index}:`, header.textContent);
            
            // Remove any existing event listeners to prevent duplicates
            const newHeader = header.cloneNode(true);
            header.parentNode.replaceChild(newHeader, header);
            
            // Function to handle the expand/collapse logic
            const handleToggle = (e) => {
                e.preventDefault();
                console.log('Collapsible header activated:', newHeader.textContent, 'Event type:', e.type);
                
                const targetId = newHeader.getAttribute('data-target');
                const content = document.getElementById(targetId);
                const icon = newHeader.querySelector('.collapsible-icon');
                
                console.log('Target ID:', targetId, 'Content found:', !!content, 'Icon found:', !!icon);
                
                if (content && icon) {
                    if (content.classList.contains('collapsed')) {
                        // Expand
                        console.log('Expanding section:', targetId);
                        content.classList.remove('collapsed');
                        newHeader.classList.remove('collapsed');
                        icon.style.transform = 'rotate(0deg)';
                    } else {
                        // Collapse
                        console.log('Collapsing section:', targetId);
                        content.classList.add('collapsed');
                        newHeader.classList.add('collapsed');
                        icon.style.transform = 'rotate(-90deg)';
                    }
                } else {
                    console.error('Missing content or icon for:', targetId);
                }
            };
            
            // Add click handler
            newHeader.addEventListener('click', handleToggle);
            
            // Add touch handler for mobile devices
            newHeader.addEventListener('touchstart', (e) => {
                console.log('Touch event detected on collapsible header');
                handleToggle(e);
            });
            
            // Add touchend handler as backup for mobile
            newHeader.addEventListener('touchend', (e) => {
                console.log('Touch end event detected on collapsible header');
                // Don't prevent default here to allow normal touch behavior
            });
        });
        
        console.log('Collapsible sections setup completed');
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

    async navigateToAdminTab() {
        console.log('navigateToAdminTab called');
        
        try {
            // Check if we're in admin mode
            if (!this.isAdmin()) {
                console.log('Not in admin mode, cannot navigate to admin tab');
                this.uiManager.showError('Admin access required. Please log in as admin first.');
                return;
            }
            
            console.log('Admin mode confirmed, looking for admin tab...');
            
            // First, ensure admin tab exists by calling updateWeeklyTabs if needed
            if (!document.querySelector('.tab[data-type="admin"]')) {
                console.log('Admin tab not found, refreshing tabs...');
                await this.updateWeeklyTabs();
                
                // Wait a bit for the DOM to update
                await new Promise(resolve => setTimeout(resolve, 200));
                
                console.log('Tabs refreshed, checking for admin tab again...');
            }
            
            // Now try to find the admin tab again
            const adminTab = document.querySelector('.tab[data-type="admin"]');
            console.log('Admin tab search result:', adminTab);
            
            if (adminTab) {
                console.log('Admin tab found, clicking it...');
                adminTab.click();
                // Scroll to top for better mobile experience
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                console.error('Admin tab still not found after refresh');
                console.log('All tabs in DOM:', document.querySelectorAll('.tab'));
                console.log('All elements with data-type:', document.querySelectorAll('[data-type]'));
                this.uiManager.showError('Admin tab not available. Please try refreshing the page.');
            }
        } catch (error) {
            console.error('Error in navigateToAdminTab:', error);
            this.uiManager.showError('Error navigating to admin tab. Please try again.');
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
            
            // Load secure admin content
            this.loadAdminContent();
            
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
                versionElement.textContent = 'v1.1.68';
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
        
        // Validate week dates before using toISOString
        if (isNaN(weekStart.getTime()) || isNaN(weekEnd.getTime())) {
            console.error('Invalid week dates detected, using fallback dates');
            const today = new Date();
            const fallbackWeekStart = this.getWeekStart(today);
            const fallbackWeekEnd = this.getWeekEnd(today);
            
            console.log('Filtering special events for week (fallback):', {
                weekStart: fallbackWeekStart.toISOString().split('T')[0],
                weekEnd: fallbackWeekEnd.toISOString().split('T')[0],
                totalEvents: specialEvents.length
            });
        } else {
            console.log('Filtering special events for week:', {
                weekStart: weekStart.toISOString().split('T')[0],
                weekEnd: weekEnd.toISOString().split('T')[0],
                totalEvents: specialEvents.length
            });
        }
        
        for (const event of specialEvents) {
            try {
                // Check if event overlaps with the selected week
                const eventStart = new Date(event.startDate + 'T00:00:00');
                const eventEnd = new Date(event.endDate + 'T23:59:59');
                
                // Validate event dates
                if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) {
                    console.warn('Invalid date in special event, skipping:', {
                        eventName: event.name,
                        startDate: event.startDate,
                        endDate: event.endDate
                    });
                    continue; // Skip this event
                }
                
                // Use fallback dates if week dates are invalid
                const effectiveWeekStart = isNaN(weekStart.getTime()) ? this.getWeekStart(new Date()) : weekStart;
                const effectiveWeekEnd = isNaN(weekEnd.getTime()) ? this.getWeekEnd(new Date()) : weekEnd;
                
                // Event overlaps if: event starts before week ends AND event ends after week starts
                const eventOverlapsWeek = eventStart <= effectiveWeekEnd && eventEnd >= effectiveWeekStart;
                
                // Include pinned events regardless of date overlap
                const shouldIncludeEvent = eventOverlapsWeek || event.pinned;
                
                console.log('Event date check:', {
                    eventName: event.name,
                    eventStart: event.startDate,
                    eventEnd: event.endDate,
                    eventStartParsed: eventStart.toISOString(),
                    eventEndParsed: eventEnd.toISOString(),
                    weekStart: effectiveWeekStart.toISOString(),
                    weekEnd: effectiveWeekEnd.toISOString(),
                    overlaps: eventOverlapsWeek,
                    pinned: event.pinned,
                    shouldInclude: shouldIncludeEvent
                });
                
                if (shouldIncludeEvent) {
                    const eventKey = event.key;
                    const eventName = event.name;
                    
                    // Create special event tab
                    const eventTab = document.createElement('button');
                    eventTab.className = `tab special-event-tab${event.pinned ? ' pinned' : ''}`;
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
            } catch (error) {
                console.error('Error processing special event:', event, error);
                // Continue with next event instead of crashing
                continue;
            }
        }
        
        // Add Reports tab
        const reportsTab = document.createElement('button');
        reportsTab.className = 'tab reports-tab';
        reportsTab.textContent = '📊 Reports';
        reportsTab.setAttribute('data-type', 'reports');
        reportsTab.style.display = 'inline-block'; // Ensure it's visible
        reportsTab.style.visibility = 'visible'; // Ensure it's visible
        tabsContainer.appendChild(reportsTab);
        
        // Add click handler for reports tab
        reportsTab.addEventListener('click', () => {
            console.log('Reports tab clicked');
            this.showTab('reports');
        });
        
        console.log('Reports tab created and added to DOM');
        console.log('Reports tab element:', reportsTab);
        console.log('Reports tab parent:', reportsTab.parentElement);
        console.log('All tabs in container:', tabsContainer.querySelectorAll('.tab').length);
        console.log('Reports tab computed styles:', window.getComputedStyle(reportsTab));
        
        // Add Admin tab (only show if admin mode is active)
        console.log('Checking admin status:', this.isAdmin(), 'adminAuthenticated:', this.adminAuthenticated);
        if (this.isAdmin()) {
            console.log('Creating admin tab...');
            const adminTab = document.createElement('button');
            adminTab.className = 'tab admin-tab';
            adminTab.textContent = '🔐 Admin';
            adminTab.setAttribute('data-type', 'admin');
            tabsContainer.appendChild(adminTab);
            
            // Add click handler for admin tab
            adminTab.addEventListener('click', () => {
                this.showTab('admin');
            });
            console.log('Admin tab created successfully');
        } else {
            console.log('Admin tab not created - not in admin mode');
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
            console.log('Showing Reports tab...');
            
            // Show reports tab
            const reportsTabElement = document.getElementById('reportsTab');
            const adminTabElement = document.getElementById('adminTab');
            const tabsContainerElement = document.querySelector('.tabs-container');
            
            console.log('Reports tab element found:', !!reportsTabElement);
            console.log('Admin tab element found:', !!adminTabElement);
            console.log('Tabs container found:', !!tabsContainerElement);
            
            if (reportsTabElement) {
                reportsTabElement.style.display = 'block';
                console.log('Reports tab display set to block');
            }
            
            if (adminTabElement) {
                adminTabElement.style.display = 'none';
            }
            
            if (tabsContainerElement) {
                tabsContainerElement.style.display = 'none';
            }
            
            // Add active class to reports tab
            const reportsTab = document.querySelector('.tab[data-type="reports"]');
            if (reportsTab) {
                reportsTab.classList.add('active');
                console.log('Active class added to Reports tab');
            } else {
                console.error('Reports tab button not found in DOM');
            }
            
            // Initialize reports functionality
            this.initializeReports();
            console.log('Reports functionality initialized');
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
            
            // Initialize admin functionality - ensure admin content is loaded first
            if (!document.querySelector('#adminTab .admin-sections')) {
                // Admin content not loaded yet, load it first
                this.loadAdminContent();
            }
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
                    // Use the start date from the event key for display purposes
                    const eventStartDate = dateKey.split('_').slice(-2)[0]; // Get the start date part
                    const displayDate = new Date(eventStartDate + 'T00:00:00');
                    
                    // For special events, create the ranking table with proper parameters
                    selectedContent.innerHTML = this.uiManager.createRankingTable(
                        eventRankings, 
                        eventName, 
                        {}, // No top 10 occurrences for special events
                        {}, // No bottom 20 occurrences for special events
                        {}, // No cumulative scores for special events
                        true, // isSpecialEvent = true
                        displayDate // Use the actual start date
                    );
                } else {
                    // Special events don't need conductor banners - just show event info
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

    async processCSVFile(selectedDate) {
        const fileInput = document.getElementById('csvFileUpload');
        const selectedDateKey = selectedDate || this.currentTabDate || this.formatDateKey(this.selectedDate);
        
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
            
            // Get existing player names before adding new ones
            const existingPlayers = new Set();
            const allExistingRankings = await this.rankingManager.getAllRankings();
            allExistingRankings.forEach(ranking => {
                if (ranking.commander) {
                    existingPlayers.add(ranking.commander);
                }
            });
            
            // Find new player names
            const newPlayers = uniqueRankings
                .filter(ranking => ranking.commander && !existingPlayers.has(ranking.commander))
                .map(ranking => ranking.commander);
            
            // Show new player names if any
            if (newPlayers.length > 0) {
                const newPlayersList = newPlayers.join(', ');
                this.uiManager.showInfo(`New players added to database: ${newPlayersList}`);
                console.log('New players found:', newPlayers);
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

    async processPastedCSV(selectedDate) {
        const rawCsvInput = document.getElementById('rawCsvInput');
        const selectedDateKey = selectedDate || this.currentTabDate || this.formatDateKey(this.selectedDate);
        
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
            
            // Get existing player names before adding new ones
            const existingPlayers = new Set();
            const allExistingRankings = await this.rankingManager.getAllRankings();
            allExistingRankings.forEach(ranking => {
                if (ranking.commander) {
                    existingPlayers.add(ranking.commander);
                }
            });
            
            // Find new player names
            const newPlayers = uniqueRankings
                .filter(ranking => ranking.commander && !existingPlayers.has(ranking.commander))
                .map(ranking => ranking.commander);
            
            // Show new player names if any
            if (newPlayers.length > 0) {
                const newPlayersList = newPlayers.join(', ');
                this.uiManager.showInfo(`New players added to database: ${newPlayersList}`);
                console.log('New players found:', newPlayers);
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

    // CSV upload handler methods for admin interface
    async handleCSVUpload() {
        console.log('handleCSVUpload method called');
        try {
            // Validate date selection
            const selectedDate = this.validateCSVUploadDate();
            if (!selectedDate) return;
            
            await this.processCSVFile(selectedDate);
        } catch (error) {
            console.error('Error in handleCSVUpload:', error);
            this.uiManager.showError('Error processing CSV upload. Please try again.');
        }
    }

    async handlePasteCSVUpload() {
        console.log('handlePasteCSVUpload method called');
        try {
            // Validate date selection
            const selectedDate = this.validateCSVUploadDate();
            if (!selectedDate) return;
            
            await this.processPastedCSV(selectedDate);
        } catch (error) {
            console.error('Error in handlePasteCSVUpload:', error);
            this.uiManager.showError('Error processing pasted CSV data. Please try again.');
        }
    }

    // Validate CSV upload date selection
    validateCSVUploadDate() {
        const dateInput = document.getElementById('csvUploadDate');
        if (!dateInput) {
            this.uiManager.showError('Date selector not found. Please refresh the page.');
            return null;
        }
        
        const selectedDate = dateInput.value;
        if (!selectedDate) {
            this.uiManager.showError('Please select a date for the CSV upload.');
            return null;
        }
        
        // Convert to Date object and validate
        const date = new Date(selectedDate);
        if (isNaN(date.getTime())) {
            this.uiManager.showError('Invalid date selected. Please choose a valid date.');
            return null;
        }
        
        // Check if date is in the future
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        if (date > today) {
            this.uiManager.showError('Cannot upload scores for future dates. Please select today or a past date.');
            return null;
        }
        
        return selectedDate;
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
            console.log('createSpecialEvent method called');
            
            const eventNameInput = document.getElementById('eventName');
            const startDateInput = document.getElementById('eventStartDate');
            const endDateInput = document.getElementById('eventEndDate');
            const eventWeightInput = document.getElementById('eventWeight');
            
            console.log('Form elements found:', {
                eventNameInput: !!eventNameInput,
                startDateInput: !!startDateInput,
                endDateInput: !!endDateInput,
                eventWeightInput: !!eventWeightInput
            });
            
            // Get data upload inputs
            const csvFile = document.getElementById('eventCSVFile')?.files[0];
            const rawData = document.getElementById('eventRawData')?.value?.trim();
            
            if (!eventNameInput || !startDateInput || !endDateInput) {
                console.error('Special event form elements not found - admin content not loaded');
                this.uiManager.showError('Admin interface not ready. Please try again.');
                return;
            }
            
            const eventName = eventNameInput.value.trim();
            const startDate = startDateInput.value;
            const endDate = endDateInput.value;
            const eventWeight = parseFloat(eventWeightInput?.value) || 10.0; // Default to 10% if not specified
            
            if (!eventName || !startDate || !endDate) {
                this.uiManager.showError('Please fill in all fields for the special event.');
                return;
            }
            
            if (eventWeight < 0 || eventWeight > 100) {
                this.uiManager.showError('Event weight must be between 0 and 100 percent');
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
            
            // Prevent future dates
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset time to start of day
            
            if (startDateObj > today || endDateObj > today) {
                this.uiManager.showError('Cannot create special events with future dates. Please use today or past dates only.');
                return;
            }
            
            console.log('About to call rankingManager.createSpecialEvent with:', { eventName, startDate, endDate, eventWeight });
            const success = await this.rankingManager.createSpecialEvent(eventName, startDate, endDate, eventWeight);
            console.log('createSpecialEvent result:', success);
            
            if (success) {
                console.log('Special event created successfully, showing success message');
                this.uiManager.showSuccess(`Special event "${eventName}" created successfully!`);
                
                // Process data if provided
                if (csvFile || rawData) {
                    try {
                        let csvContent = '';
                        
                        if (csvFile) {
                            csvContent = await this.readFileAsText(csvFile);
                        } else if (rawData) {
                            csvContent = rawData;
                        }

                        if (csvContent) {
                            // Process the CSV data for the special event
                            await this.processSpecialEventData(csvContent, eventName, startDate, endDate);
                        }
                    } catch (dataError) {
                        console.error('Error processing event data:', dataError);
                        this.uiManager.showError(`Event created but failed to process data: ${dataError.message}`);
                    }
                }
                
                // Clear form
                this.clearEventForm();
                
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

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    async processSpecialEventData(csvContent, eventName, startDate, endDate = null) {
        try {
            // Use existing CSV processing logic but for special events
            const lines = csvContent.trim().split('\n');
            const rankings = [];
            
            // If endDate is not provided, use startDate as endDate
            if (!endDate) {
                endDate = startDate;
            }
            
            // Create the special event date key in the correct format
            const eventDateKey = `event_${eventName.replace(/\s+/g, '_').toLowerCase()}_${startDate}_${endDate}`;
            
            for (let i = 1; i < lines.length; i++) { // Skip header
                const line = lines[i].trim();
                if (!line) continue;
                
                const [rank, commander, points] = line.split(',').map(s => s.trim());
                
                if (rank && commander && points) {
                    const ranking = {
                        ranking: parseInt(rank),
                        commander: commander.replace(/['"]/g, ''),
                        points: parseInt(points),
                        day: eventDateKey, // Use the day field for special event keys
                        date: null // Set date to null for special events to avoid constraint conflicts
                    };
                    rankings.push(ranking);
                }
            }

            if (rankings.length > 0) {
                // Save rankings to database
                await this.rankingManager.saveSpecialEventRankings(rankings);
                this.uiManager.showSuccess(`Successfully processed ${rankings.length} rankings for event "${eventName}"`);
                
                // Refresh the current tab if it's showing this event
                await this.updateWeeklyTabs();
            } else {
                this.uiManager.showError('No valid rankings found in CSV data');
            }
            
        } catch (error) {
            console.error('Error in processSpecialEventData:', error);
            throw new Error(`Failed to process CSV data: ${error.message}`);
        }
    }

    clearEventForm() {
        const fields = [
            'eventName',
            'eventStartDate', 
            'eventEndDate',
            'eventCSVFile',
            'eventRawData'
        ];
        
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = '';
            }
        });
        
        // Reset tab to CSV upload
        const csvTab = document.querySelector('.tab-btn[data-tab="csv-upload"]');
        const rawTab = document.querySelector('.tab-btn[data-tab="raw-data"]');
        const csvContent = document.getElementById('csv-upload-tab');
        const rawContent = document.getElementById('raw-data-tab');
        
        if (csvTab && rawTab && csvContent && rawContent) {
            csvTab.classList.add('active');
            rawTab.classList.remove('active');
            csvContent.classList.add('active');
            rawContent.classList.remove('active');
        }
    }

    async addRemovedPlayer() {
        const removedPlayerInput = document.getElementById('removedPlayerName');
        const removalReasonInput = document.getElementById('removalReason');
        
        if (!removedPlayerInput || !removalReasonInput) {
            console.error('Removed player form elements not found - admin content not loaded');
            this.uiManager.showError('Admin interface not ready. Please try again.');
            return;
        }
        
        const playerName = removedPlayerInput.value.trim();
        const reason = removalReasonInput.value.trim();
        
        if (!playerName) {
            this.uiManager.showError('Please enter a player name');
            return;
        }
        
        try {
            const success = await this.rankingManager.addRemovedPlayer(playerName, 'Admin', reason || null);
            
            if (success) {
                this.uiManager.showSuccess(`Successfully marked "${playerName}" as removed from alliance`);
                
                // Clear form
                removedPlayerInput.value = '';
                removalReasonInput.value = '';
                
                // Update removed players list
                this.updateRemovedPlayersList();
                
                // Refresh all tabs to show updated styling
                await this.updateWeeklyTabs();
            } else {
                this.uiManager.showError('Failed to mark player as removed. Please try again.');
            }
        } catch (error) {
            console.error('Error adding removed player:', error);
            this.uiManager.showError(`Error marking player as removed: ${error.message}`);
        }
    }

    async updateRemovedPlayersList() {
        try {
            const removedPlayers = await this.rankingManager.getRemovedPlayers();
            const removedPlayersList = document.getElementById('currentRemovedPlayersList');
            const removedPlayerCount = document.getElementById('removedPlayerCount');
            
            if (!removedPlayersList || !removedPlayerCount) {
                console.error('Removed players list elements not found');
                return;
            }
            
            removedPlayerCount.textContent = removedPlayers.length;
            
            if (removedPlayers.length === 0) {
                removedPlayersList.innerHTML = '<p class="no-removed-players">No players are currently marked as removed.</p>';
                return;
            }
            
            const removedPlayersHTML = removedPlayers.map(player => {
                const isPDX2 = player.reason && player.reason.toUpperCase() === 'PDX2';
                const itemClass = isPDX2 ? 'removed-player-item pdx2-highlight' : 'removed-player-item';
                
                return `
                    <div class="${itemClass}">
                        <div class="removed-player-info">
                            <span class="removed-player-name">${player.playerName}</span>
                            <span class="removed-date">Removed: ${player.removedDate}</span>
                            ${player.reason ? `<span class="removal-reason">Reason: ${player.reason}</span>` : ''}
                        </div>
                        <button class="restore-player-btn" data-player="${player.playerName}">🔄 Restore</button>
                    </div>
                `;
            }).join('');
            
            removedPlayersList.innerHTML = removedPlayersHTML;
            
            // Add event listeners for restore buttons
            removedPlayersList.querySelectorAll('.restore-player-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const playerName = e.target.dataset.player;
                    await this.restoreRemovedPlayer(playerName);
                });
            });
            
        } catch (error) {
            console.error('Error updating removed players list:', error);
        }
    }

    async toggleSpecialEventPinned(eventKey, pinned) {
        try {
            const success = await this.rankingManager.toggleSpecialEventPinned(eventKey, pinned);
            
            if (success) {
                const action = pinned ? 'pinned' : 'unpinned';
                this.uiManager.showSuccess(`Successfully ${action} special event`);
                
                // Update special events list
                this.updateSpecialEventsList();
                
                // Refresh weekly tabs to show/hide pinned events
                await this.updateWeeklyTabs();
            } else {
                this.uiManager.showError('Failed to toggle pinned status. Please try again.');
            }
        } catch (error) {
            console.error('Error toggling special event pinned status:', error);
            this.uiManager.showError(`Error toggling pinned status: ${error.message}`);
        }
    }

    async restoreRemovedPlayer(playerName) {
        try {
            const success = await this.rankingManager.removePlayerFromRemovedList(playerName);
            
            if (success) {
                this.uiManager.showSuccess(`Successfully restored "${playerName}" to active status`);
                
                // Update removed players list
                this.updateRemovedPlayersList();
                
                // Refresh all tabs to show updated styling
                await this.updateWeeklyTabs();
            } else {
                this.uiManager.showError('Failed to restore player. Please try again.');
            }
        } catch (error) {
            console.error('Error restoring removed player:', error);
            this.uiManager.showError(`Error restoring player: ${error.message}`);
        }
    }

    async updatePlayerName() {
        const oldNameInput = document.getElementById('oldPlayerName');
        const newNameInput = document.getElementById('newPlayerName');
        
        if (!oldNameInput || !newNameInput) {
            console.error('Player name form elements not found - admin content not loaded');
            this.uiManager.showError('Admin interface not ready. Please try again.');
            return;
        }
        
        const oldName = oldNameInput.value.trim();
        const newName = newNameInput.value.trim();
        
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
            oldNameInput.value = '';
            newNameInput.value = '';
            
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

    async checkForNewNames() {
        try {
            console.log('Checking for players with single instances...');
            
            // Get all rankings from database
            const allRankings = await this.rankingManager.getAllRankings();
            
            // Count occurrences of each player name
            const playerCounts = {};
            allRankings.forEach(ranking => {
                if (ranking.commander) {
                    playerCounts[ranking.commander] = (playerCounts[ranking.commander] || 0) + 1;
                }
            });
            
            // Find players with only 1 instance
            const singleInstancePlayers = Object.entries(playerCounts)
                .filter(([name, count]) => count === 1)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => a.name.localeCompare(b.name));
            
            console.log('Single instance players found:', singleInstancePlayers);
            
            // Update the UI
            const resultsDiv = document.getElementById('newNamesResults');
            const selectElement = document.getElementById('singleInstancePlayers');
            
            if (singleInstancePlayers.length === 0) {
                resultsDiv.style.display = 'block';
                selectElement.innerHTML = '<option value="">No players with single instances found</option>';
                this.uiManager.showInfo('No players with single instances found. All players appear multiple times.');
            } else {
                resultsDiv.style.display = 'block';
                
                // Clear existing options and add new ones
                selectElement.innerHTML = '<option value="">Select a player to populate Old Player Name...</option>';
                singleInstancePlayers.forEach(player => {
                    const option = document.createElement('option');
                    option.value = player.name;
                    option.textContent = `${player.name} (1 instance)`;
                    selectElement.appendChild(option);
                });
                
                this.uiManager.showSuccess(`Found ${singleInstancePlayers.length} players with single instances. Select a name to populate the Old Player Name field.`);
            }
            
        } catch (error) {
            console.error('Error checking for new names:', error);
            this.uiManager.showError('Failed to check for new names. Please try again.');
        }
    }

    setupVIPFrequencyListeners() {
        console.log('Setting up VIP frequency listeners...');
        
        // VIP Player input change listener
        const vipPlayerInput = document.getElementById('vipPlayer');
        if (vipPlayerInput) {
            console.log('VIP Player input found, adding listener');
            vipPlayerInput.addEventListener('input', (e) => {
                console.log('VIP Player input changed:', e.target.value);
                this.updateVIPFrequencyDisplay('vipPlayer', e.target.value);
            });
        } else {
            console.error('VIP Player input not found');
        }
        
        // Edit VIP Player input change listener
        const editVipPlayerInput = document.getElementById('editVipPlayer');
        if (editVipPlayerInput) {
            console.log('Edit VIP Player input found, adding listener');
            editVipPlayerInput.addEventListener('input', (e) => {
                console.log('Edit VIP Player input changed:', e.target.value);
                this.updateVIPFrequencyDisplay('editVipPlayer', e.target.value);
            });
        } else {
            console.error('Edit VIP Player input not found');
        }
        
        console.log('VIP frequency listeners setup complete');
    }

    loadAdminContent() {
        console.log('Loading secure admin content...');
        const adminTab = document.getElementById('adminTab');
        
        if (!adminTab) {
            console.error('Admin tab not found');
            return;
        }
        
        // Clear loading content and add secure admin content
        adminTab.innerHTML = `
            <div class="admin-header">
                <h2>🔐 Admin Panel</h2>
                <p>Manage system settings, data, and configurations</p>
            </div>
            
            <div class="admin-sections">
                <!-- CSV Upload Section -->
                <div class="admin-section collapsible">
                    <div class="collapsible-header" data-target="csvUploadContent">
                        <h3>📁 CSV Upload</h3>
                        <span class="collapsible-icon">▼</span>
                    </div>
                    <div id="csvUploadContent" class="collapsible-content collapsed">
                        <div class="csv-upload">
                        <!-- Date Selection for CSV Upload -->
                        <div class="upload-date-selector">
                            <h4>📅 Select Date for Scores</h4>
                            <div class="date-input-group">
                                <label for="csvUploadDate">Date:</label>
                                <input type="date" id="csvUploadDate" class="form-input" required>
                                <small class="form-help">Choose the date these scores should be applied to</small>
                            </div>
                        </div>
                        
                        <div class="upload-divider">
                            <span>OR</span>
                        </div>
                        
                        <div class="upload-option">
                            <h4>📄 File Upload</h4>
                            <label for="csvFileUpload">Upload CSV File:</label>
                            <input type="file" id="csvFileUpload" accept=".csv">
                            <button id="uploadBtn" class="upload-btn">Upload File</button>
                        </div>
                        
                        <div class="upload-divider">
                            <span>OR</span>
                        </div>
                        
                        <div class="upload-option">
                            <h4>📝 Raw CSV Paste</h4>
                            <label for="rawCsvInput">Paste CSV Data:</label>
                            <textarea id="rawCsvInput" placeholder="Paste your CSV data here...&#10;Format: ranking,commander,points&#10;Example:&#10;1,PlayerName,1000&#10;2,AnotherPlayer,950" rows="8" class="form-input"></textarea>
                            <button id="pasteUploadBtn" class="upload-btn">Upload Pasted Data</button>
                        </div>
                        
                        <div class="csv-help">
                            <small class="form-help">
                                <strong>CSV Format:</strong> ranking,commander,points<br>
                                <strong>Example:</strong><br>
                                1,PlayerName,1000<br>
                                2,AnotherPlayer,950<br>
                                3,ThirdPlayer,900
                            </small>
                        </div>
                    </div>
                    </div>
                </div>
                
                <!-- Special Event Management Section -->
                <div class="admin-section collapsible">
                    <div class="collapsible-header" data-target="specialEventContent">
                        <h3>🎯 Special Event Management</h3>
                        <span class="collapsible-icon">▼</span>
                    </div>
                    <div id="specialEventContent" class="collapsible-content collapsed">
                        <div class="event-form">
                        <div class="form-group">
                            <label for="eventName">Event Name:</label>
                            <input type="text" id="eventName" placeholder="e.g., Summer Tournament" class="form-input">
                        </div>
                        <div class="form-group">
                            <label for="eventStartDate">Start Date:</label>
                            <input type="date" id="eventStartDate" class="form-input">
                        </div>
                        <div class="form-group">
                            <label for="eventEndDate">End Date:</label>
                            <input type="date" id="eventEndDate" class="form-input">
                        </div>
                        <div class="form-group">
                            <label for="eventWeight">Event Weight (%):</label>
                            <input type="number" id="eventWeight" placeholder="10" min="0" max="100" step="0.01" class="form-input">
                            <small class="form-help">Weight percentage (0-100%) representing how much this event contributes to overall season ranking score</small>
                        </div>
                        
                        <div class="event-data-section">
                            <h4>📊 Add Event Data (Optional)</h4>
                            <p class="form-help">You can add event data now or later. If adding now, the event will be created and data will be processed immediately.</p>
                            
                            <div class="data-input-tabs">
                                <button type="button" class="tab-btn active" data-tab="csv-upload">📁 CSV Upload</button>
                                <button type="button" class="tab-btn" data-tab="raw-data">📝 Raw Data</button>
                            </div>
                            
                            <div class="tab-content active" id="csv-upload-tab">
                                <div class="form-group">
                                    <label for="eventCSVFile">CSV File:</label>
                                    <input type="file" id="eventCSVFile" accept=".csv" class="form-input">
                                    <small class="form-help">Upload a CSV file with event rankings</small>
                                </div>
                            </div>
                            
                            <div class="tab-content" id="raw-data-tab">
                                <div class="form-group">
                                    <label for="eventRawData">Raw Data:</label>
                                    <textarea id="eventRawData" placeholder="Paste CSV data here (rank,commander,points format)" class="form-input" rows="6"></textarea>
                                    <small class="form-help">Paste CSV data in rank,commander,points format</small>
                                </div>
                            </div>
                        </div>
                        
                        <button id="createEventBtn" class="event-btn">Create Special Event</button>
                    </div>
                    
                    <div class="current-events">
                        <h4>All Special Events (<span id="eventCount">0</span>)</h4>
                        <div class="event-actions-header">
                            <button id="cleanupInvalidEventsBtn" class="cleanup-btn">🧹 Cleanup Invalid Events</button>
                            <small class="form-help">Remove events with invalid dates that may cause errors</small>
                        </div>
                        <div id="currentEventsList" class="current-events-list">
                            <p class="loading-events">Loading special events...</p>
                        </div>
                    </div>
                    </div>
                </div>
                
                <!-- Player Name Management Section -->
                <div class="admin-section collapsible">
                    <div class="collapsible-header" data-target="playerNameContent">
                        <h3>👤 Player Name Management</h3>
                        <span class="collapsible-icon">▼</span>
                    </div>
                    <div id="playerNameContent" class="collapsible-content collapsed">
                        <div class="player-form">
                        <div class="form-group">
                            <label for="oldPlayerName">Old Player Name:</label>
                            <div class="autocomplete-container">
                                <input type="text" id="oldPlayerName" placeholder="Enter old name" class="form-input">
                                <div id="oldPlayerAutocomplete" class="autocomplete-dropdown"></div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="newPlayerName">New Player Name:</label>
                            <input type="text" id="newPlayerName" placeholder="Enter new name" class="form-input">
                        </div>
                        <button id="updatePlayerBtn" class="player-btn">Update Player Name</button>
                        
                        <div class="new-names-check">
                            <h4>🔍 Check for Potential Typos</h4>
                            <p class="form-help">Find players with only 1 instance (potential typos or name variations)</p>
                            <button id="checkNewNamesBtn" class="check-names-btn">Check for New Names</button>
                            
                            <div id="newNamesResults" class="new-names-results" style="display: none;">
                                <label for="singleInstancePlayers">Players with 1 instance:</label>
                                <select id="singleInstancePlayers" class="form-input">
                                    <option value="">Select a player to populate Old Player Name...</option>
                                </select>
                                <small class="form-help">Click on a name to populate the "Old Player Name" field above</small>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>

                <!-- Removed Players Management Section -->
                <div class="admin-section collapsible">
                    <div class="collapsible-header" data-target="removedPlayersContent">
                        <h3>🚫 Removed Players Management</h3>
                        <span class="collapsible-icon">▼</span>
                    </div>
                    <div id="removedPlayersContent" class="collapsible-content collapsed">
                        <div class="removed-player-form">
                        <div class="form-group">
                            <label for="removedPlayerName">Player Name:</label>
                            <div class="autocomplete-container">
                                <input type="text" id="removedPlayerName" placeholder="Enter player name" class="form-input">
                                <div id="removedPlayerAutocomplete" class="autocomplete-dropdown"></div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="removalReason">Reason (Optional):</label>
                            <textarea id="removalReason" placeholder="Enter reason for removal..." class="form-input" rows="3"></textarea>
                        </div>
                        <button id="addRemovedPlayerBtn" class="removed-player-btn">Mark as Removed</button>
                        
                        <div class="removed-players-help">
                            <small class="form-help">
                                <strong>Note:</strong> Removed players will still appear in rankings and reports with their names crossed out or in red to indicate they are no longer in the alliance.
                            </small>
                        </div>
                    </div>
                    
                    <div class="current-removed-players">
                        <h4>Currently Removed Players (<span id="removedPlayerCount">0</span>)</h4>
                        <div id="currentRemovedPlayersList" class="current-removed-players-list">
                            <p class="loading-removed-players">Loading removed players...</p>
                        </div>
                    </div>
                    </div>
                </div>

                <!-- Alliance Leader Management Section -->
                <div class="admin-section collapsible">
                    <div class="collapsible-header" data-target="allianceLeaderContent">
                        <h3>👑 Alliance Leader Management</h3>
                        <span class="collapsible-icon">▼</span>
                    </div>
                    <div id="allianceLeaderContent" class="collapsible-content collapsed">
                        <div class="leader-form">
                            <div class="form-group">
                                <label for="newLeaderName">New Alliance Leader:</label>
                                <div class="autocomplete-container">
                                    <input type="text" id="newLeaderName" placeholder="Enter leader name" class="form-input">
                                    <div id="leaderAutocomplete" class="autocomplete-dropdown"></div>
                                </div>
                                <button id="addLeaderBtn" class="leader-btn">Add Leader</button>
                            </div>
                            <div class="form-group">
                                <label for="removeLeaderName">Remove Alliance Leader:</label>
                                <select id="removeLeaderName" class="form-input">
                                    <option value="">Select leader to remove...</option>
                                </select>
                                <button id="removeLeaderBtn" class="leader-btn">Remove Leader</button>
                            </div>
                        </div>
                        
                        <div class="current-leaders">
                            <h4>Current Alliance Leaders (<span id="leaderCount">0</span>)</h4>
                            <div id="currentLeadersList" class="current-leaders-list">
                                <p class="loading-leaders">Loading current leaders...</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Train Conductor Rotation Management Section -->
                <div class="admin-section collapsible">
                    <div class="collapsible-header" data-target="trainRotationContent">
                        <h3>🚂 Train Conductor Rotation</h3>
                        <span class="collapsible-icon">▼</span>
                    </div>
                    <div id="trainRotationContent" class="collapsible-content collapsed">
                        <div class="rotation-form">
                            <div class="form-group">
                                <label>Rotation Order (drag to reorder):</label>
                                <div id="rotationOrderList" class="rotation-order-list">
                                    <p class="loading-rotation">Loading rotation order...</p>
                                </div>
                            </div>
                            <div class="rotation-help">
                                <small class="form-help">
                                    The train conductor rotates daily based on this order. 
                                    Drag leaders to reorder them, use the buttons to move them up/down, or click the ❌ button to remove them from rotation.
                                </small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- VIP Management Section -->
                <div class="admin-section collapsible">
                    <div class="collapsible-header" data-target="vipManagementContent">
                        <h3>⭐ VIP Management</h3>
                        <span class="collapsible-icon">▼</span>
                    </div>
                    <div id="vipManagementContent" class="collapsible-content collapsed">
                        <div class="vip-form">
                        <div class="form-group">
                            <label for="vipDate">Date:</label>
                            <input type="date" id="vipDate" class="form-input">
                        </div>
                        <div class="form-group">
                            <label for="vipPlayer">VIP Player:</label>
                            <div class="autocomplete-container">
                                <input type="text" id="vipPlayer" placeholder="Enter VIP player name" class="form-input">
                                <div id="vipAutocomplete" class="autocomplete-dropdown"></div>
                            </div>
                            <div id="vipFrequencyInfo" class="vip-frequency-info" style="display: none;">
                                <span class="frequency-badge days-ago"></span>
                                <span class="frequency-badge count-30-days"></span>
                                <button type="button" id="refreshVIPFrequencyBtn" class="refresh-btn" title="Refresh VIP frequency info">🔄</button>
                            </div>

                            <small class="form-help">Note: Alliance leaders are excluded from VIP selection</small>
                        </div>
                        <div class="form-group">
                            <label for="vipNotes">Notes (optional):</label>
                            <input type="text" id="vipNotes" placeholder="Any additional notes" class="form-input">
                        </div>
                        <button id="setVIPBtn" class="vip-btn">Set VIP</button>
                    </div>
                    
                    <div class="recent-vips">
                        <h4>Recent VIP Selections</h4>
                        <div id="recentVIPsList" class="recent-vips-list">
                            <p class="loading-vips">Loading recent VIPs...</p>
                        </div>
                    </div>
                    </div>
                </div>

                <!-- Season Ranking System Section -->
                <div class="admin-section collapsible">
                    <div class="collapsible-header" data-target="seasonRankingContent">
                        <h3>🏆 Season Ranking System</h3>
                        <span class="collapsible-icon">▼</span>
                    </div>
                    <div id="seasonRankingContent" class="collapsible-content collapsed">
                        <div class="season-ranking-form">
                            <div class="season-config">
                                <h4>📅 Season Configuration</h4>
                                <div class="form-group">
                                    <label for="seasonName">Season Name:</label>
                                    <input type="text" id="seasonName" placeholder="e.g., Winter 2025 Season" class="form-input">
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="seasonStartDate">Start Date:</label>
                                        <input type="date" id="seasonStartDate" class="form-input">
                                    </div>
                                    <div class="form-group">
                                        <label for="seasonEndDate">End Date:</label>
                                        <input type="date" id="seasonEndDate" class="form-input">
                                    </div>
                                </div>
                            </div>

                            <div class="weight-config">
                                <h4>⚖️ Scoring Weights</h4>
                                <div class="weight-inputs">
                                    <div class="form-group">
                                        <label for="kudosWeight">Kudos Points (1-10 scale):</label>
                                        <input type="number" id="kudosWeight" value="25" min="0" max="100" class="form-input">
                                        <span class="weight-percent">%</span>
                                    </div>
                                    <div class="form-group">
                                        <label for="vsPerformanceWeight">VS Performance (Top 10 appearances):</label>
                                        <input type="number" id="vsPerformanceWeight" value="35" min="0" max="100" class="form-input">
                                        <span class="weight-percent">%</span>
                                    </div>
                                    <div class="form-group">
                                        <label for="specialEventsWeight">Special Events (Rank in events):</label>
                                        <input type="number" id="specialEventsWeight" value="25" min="0" max="100" class="form-input">
                                        <span class="weight-percent">%</span>
                                    </div>
                                </div>
                                <div class="weight-total">
                                    <span>Total: <span id="weightTotal">100</span>%</span>
                                </div>
                            </div>

                            <div class="season-actions">
                                <button type="button" id="generateSeasonReportBtn" class="season-btn primary">🏆 Generate Season Report</button>
                                <button type="button" id="clearSeasonDataBtn" class="season-btn secondary">🗑️ Clear Season Data</button>
                            </div>
                        </div>

                        <div class="kudos-management">
                            <h4>⭐ Kudos Points Management</h4>
                            <div class="kudos-form">
                                <div class="form-group">
                                    <label for="kudosPlayerName">Player Name:</label>
                                    <div class="autocomplete-container">
                                        <input type="text" id="kudosPlayerName" placeholder="Enter player name" class="form-input">
                                        <div id="kudosPlayerAutocomplete" class="autocomplete-dropdown"></div>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="kudosPoints">Points (1-10):</label>
                                    <input type="number" id="kudosPoints" min="1" max="10" value="5" class="form-input">
                                </div>
                                <div class="form-group">
                                    <label for="kudosReason">Reason:</label>
                                    <textarea id="kudosReason" placeholder="Why are you awarding these points?" class="form-input" rows="2"></textarea>
                                </div>
                                <button id="awardKudosBtn" class="kudos-btn">⭐ Award Kudos</button>
                            </div>
                            
                            <div class="recent-kudos">
                                <h5>Recent Kudos Awards</h5>
                                <div id="recentKudosList" class="recent-kudos-list">
                                    <p class="loading-kudos">Loading recent kudos...</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        `;
        
        // Add Season Report Display Section (separate from collapsible sections)
        const seasonReportSection = `
            <div class="admin-section">
                <div class="collapsible">
                    <div class="collapsible-header">
                        <h3>📊 Season Report Results</h3>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content collapsed">
                        <div class="season-report-display" id="seasonReportDisplay" style="display: none;">
                            <div id="seasonReportContent" class="season-report-content">
                                <!-- Season report will be generated here -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Find the admin sections container and append the season report section
        const adminSectionsContainer = document.querySelector('.admin-sections');
        if (adminSectionsContainer) {
            adminSectionsContainer.innerHTML += seasonReportSection;
            console.log('Season report section added to admin sections');
        } else {
            console.error('Admin sections container not found');
        }
        
        // Ensure season report elements are available
        this.ensureSeasonReportElements();
        
        // Add modals for editing
        this.addAdminModals();
        
        // Setup admin event listeners
        this.setupAdminEventListeners();
        
        // Initialize admin data displays
        this.updateLeaderDropdowns();
        this.updateRecentVIPsList();
        this.updateRotationOrderList();
        this.updateSpecialEventsList();
        this.updateRemovedPlayersList();
        
        // Setup autocomplete for leader and VIP inputs
        this.setupAutocomplete();
        
        // Setup autocomplete for removed player input
        this.setupRemovedPlayerAutocomplete();
        
        // Setup collapsible sections immediately after content is loaded
        this.setupCollapsibleSections();
        
        console.log('Admin content loaded and initialized successfully');
    }

    addAdminModals() {
        // Add special event edit modal
        const eventEditModal = document.createElement('div');
        eventEditModal.id = 'eventEditModal';
        eventEditModal.className = 'modal';
        eventEditModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✏️ Edit Special Event</h3>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="eventEditForm">
                        <input type="hidden" id="editEventKey" name="editEventKey">
                        <div class="form-group">
                            <label for="editEventName">Event Name:</label>
                            <input type="text" id="editEventName" placeholder="e.g., Summer Tournament" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="editEventStartDate">Start Date:</label>
                            <input type="date" id="editEventStartDate" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="editEventEndDate">End Date:</label>
                            <input type="date" id="editEventEndDate" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="editEventWeight">Event Weight (%):</label>
                            <input type="number" id="editEventWeight" placeholder="10" min="0" max="100" step="0.01" class="form-input">
                            <small class="form-help">Weight percentage (0-100%) representing how much this event contributes to overall season ranking score</small>
                        </div>
                        
                        <div class="event-data-section">
                            <h4>📊 Update Event Data (Optional)</h4>
                            <p class="form-help">You can add or update event data. New data will replace existing rankings for this event.</p>
                            
                            <div class="data-input-tabs">
                                <button type="button" class="tab-btn active" data-tab="edit-csv-upload">📁 CSV Upload</button>
                                <button type="button" class="tab-btn" data-tab="edit-raw-data">📝 Raw Data</button>
                            </div>
                            
                            <div class="tab-content active" id="edit-csv-upload-tab">
                                <div class="form-group">
                                    <label for="editEventCSVFile">CSV File:</label>
                                    <input type="file" id="editEventCSVFile" accept=".csv" class="form-input">
                                    <small class="form-help">Upload a CSV file with updated event rankings</small>
                                </div>
                            </div>
                            
                            <div class="tab-content" id="edit-raw-data-tab">
                                <div class="form-group">
                                    <label for="editEventRawData">Raw Data:</label>
                                    <textarea id="editEventRawData" placeholder="Paste CSV data here (rank,commander,points format)" class="form-input" rows="6"></textarea>
                                    <small class="form-help">Paste CSV data in rank,commander,points format</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="event-btn">Update Event</button>
                            <button type="button" class="event-btn secondary" id="deleteEventBtn">Delete Event</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(eventEditModal);

        // Add VIP edit modal
        const vipEditModal = document.createElement('div');
        vipEditModal.id = 'vipEditModal';
        vipEditModal.className = 'modal';
        vipEditModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✏️ Edit VIP Selection</h3>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="vipEditForm">
                        <input type="hidden" id="editVipDate" name="editVipDate">
                        <div class="form-group">
                            <label for="editVipPlayer">VIP Player:</label>
                            <div class="autocomplete-container">
                                <input type="text" id="editVipPlayer" placeholder="Enter VIP player name" class="form-input" required>
                                <div id="editVipAutocomplete" class="autocomplete-dropdown"></div>
                            </div>
                            <div id="editVipFrequencyInfo" class="vip-frequency-info" style="display: none;">
                                <span class="frequency-badge days-ago"></span>
                                <span class="frequency-badge count-30-days"></span>
                                <button type="button" id="refreshEditVIPFrequencyBtn" class="refresh-btn" title="Refresh VIP frequency info">🔄</button>
                            </div>
                            <small class="form-help">Note: Alliance leaders are excluded from VIP selection</small>
                        </div>
                        <div class="form-group">
                            <label for="editVipConductor">Train Conductor:</label>
                            <div class="autocomplete-container">
                                <input type="text" id="editVipConductor" placeholder="Enter train conductor name" class="form-input" required>
                                <div id="editVipConductorAutocomplete" class="autocomplete-dropdown"></div>
                            </div>
                            <small class="form-help">Select the train conductor for this VIP selection</small>
                        </div>
                        <div class="form-group">
                            <label for="editVipNotes">Notes (optional):</label>
                            <input type="text" id="editVipNotes" placeholder="Any additional notes" class="form-input">
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="vip-btn">Update VIP</button>
                            <button type="button" class="vip-btn secondary" id="deleteVipBtn">Delete VIP</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(vipEditModal);
    }

    setupAdminEventListeners() {
        console.log('Setting up admin event listeners...');
        
        // Set VIP button
        const setVIPBtn = document.getElementById('setVIPBtn');
        if (setVIPBtn) {
            setVIPBtn.addEventListener('click', () => {
                this.setVIPForDate();
            });
        } else {
            console.error('Set VIP button not found');
        }
        
        // Check for new names button
        const checkNewNamesBtn = document.getElementById('checkNewNamesBtn');
        if (checkNewNamesBtn) {
            checkNewNamesBtn.addEventListener('click', async () => {
                await this.checkForNewNames();
            });
        } else {
            console.error('Check new names button not found');
        }

        // Single instance players dropdown change
        const singleInstancePlayers = document.getElementById('singleInstancePlayers');
        if (singleInstancePlayers) {
            singleInstancePlayers.addEventListener('change', (e) => {
                const selectedName = e.target.value;
                if (selectedName) {
                    document.getElementById('oldPlayerName').value = selectedName;
                    this.uiManager.showInfo(`Populated "Old Player Name" with: ${selectedName}`);
                }
            });
        } else {
            console.error('Single instance players dropdown not found');
        }
        
        // CSV upload button
        const uploadBtn = document.getElementById('uploadBtn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                this.handleCSVUpload();
            });
        } else {
            console.error('Upload button not found');
        }
        
        // Paste CSV upload button
        const pasteUploadBtn = document.getElementById('pasteUploadBtn');
        if (pasteUploadBtn) {
            pasteUploadBtn.addEventListener('click', () => {
                this.handlePasteCSVUpload();
            });
        } else {
            console.error('Paste upload button not found');
        }
        
        // Create event button
        const createEventBtn = document.getElementById('createEventBtn');
        if (createEventBtn) {
            console.log('Create event button found, adding event listener');
            createEventBtn.addEventListener('click', () => {
                console.log('Create Special Event button clicked');
                this.createSpecialEvent();
            });
        } else {
            console.error('Create event button not found - admin content may not be loaded');
        }
        
        // Setup event data tabs
        this.setupEventDataTabs();
        
        // Update player button
        const updatePlayerBtn = document.getElementById('updatePlayerBtn');
        if (updatePlayerBtn) {
            updatePlayerBtn.addEventListener('click', () => {
                this.updatePlayerName();
            });
        } else {
            console.error('Update player button not found');
        }
        
        // Add leader button
        const addLeaderBtn = document.getElementById('addLeaderBtn');
        if (addLeaderBtn) {
            addLeaderBtn.addEventListener('click', () => {
                this.addAllianceLeader();
            });
        } else {
            console.error('Add leader button not found');
        }
        
        // Remove leader button
        const removeLeaderBtn = document.getElementById('removeLeaderBtn');
        if (removeLeaderBtn) {
            removeLeaderBtn.addEventListener('click', () => {
                this.removeAllianceLeader();
            });
        } else {
            console.error('Remove leader button not found');
        }
        
        // Add removed player button
        const addRemovedPlayerBtn = document.getElementById('addRemovedPlayerBtn');
        if (addRemovedPlayerBtn) {
            addRemovedPlayerBtn.addEventListener('click', () => {
                this.addRemovedPlayer();
            });
        } else {
            console.error('Add removed player button not found');
        }
        
        // VIP frequency refresh buttons
        const refreshVIPFrequencyBtn = document.getElementById('refreshVIPFrequencyBtn');
        if (refreshVIPFrequencyBtn) {
            refreshVIPFrequencyBtn.addEventListener('click', () => {
                const vipPlayerInput = document.getElementById('vipPlayer');
                if (vipPlayerInput && vipPlayerInput.value.trim()) {
                    this.updateVIPFrequencyDisplay('vipPlayer', vipPlayerInput.value.trim());
                }
            });
        }
        
        const refreshEditVIPFrequencyBtn = document.getElementById('refreshEditVIPFrequencyBtn');
        if (refreshEditVIPFrequencyBtn) {
            refreshEditVIPFrequencyBtn.addEventListener('click', () => {
                const editVipPlayerInput = document.getElementById('editVipPlayer');
                if (editVipPlayerInput && editVipPlayerInput.value.trim()) {
                    this.updateVIPFrequencyDisplay('editVipPlayer', editVipPlayerInput.value.trim());
                }
            });
        }

        // Season Ranking System Event Listeners
        this.setupSeasonRankingEventListeners();
        
        console.log('Admin event listeners setup complete');
    }

    setupSeasonRankingEventListeners() {
        console.log('Setting up season ranking event listeners...');

        // Weight total calculation
        const weightInputs = ['kudosWeight', 'vsPerformanceWeight', 'specialEventsWeight'];
        weightInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', this.updateWeightTotal.bind(this));
            }
        });

        // Award Kudos button
        const awardKudosBtn = document.getElementById('awardKudosBtn');
        if (awardKudosBtn) {
            awardKudosBtn.addEventListener('click', () => {
                this.awardKudos();
            });
        }

        // Generate Season Report button
        const generateSeasonReportBtn = document.getElementById('generateSeasonReportBtn');
        console.log('Generate Season Report button found:', generateSeasonReportBtn);
        console.log('All buttons with "generate" in ID:', document.querySelectorAll('[id*="generate"]'));
        if (generateSeasonReportBtn) {
            generateSeasonReportBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Generate Season Report button clicked!');
                this.generateSeasonReport();
            });
            console.log('Generate Season Report event listener attached');
        } else {
            console.error('Generate Season Report button not found!');
            console.log('Available buttons in admin sections:', document.querySelectorAll('#adminSections button'));
        }

        // Clear Season Data button
        const clearSeasonDataBtn = document.getElementById('clearSeasonDataBtn');
        if (clearSeasonDataBtn) {
            clearSeasonDataBtn.addEventListener('click', () => {
                this.clearSeasonData();
            });
        }

        // Setup autocomplete for kudos player input
        this.setupKudosPlayerAutocomplete();

        console.log('Season ranking event listeners setup complete');
    }

    updateWeightTotal() {
        const kudosWeight = parseInt(document.getElementById('kudosWeight')?.value || 0);
        const vsWeight = parseInt(document.getElementById('vsPerformanceWeight')?.value || 0);
        const eventsWeight = parseInt(document.getElementById('specialEventsWeight')?.value || 0);
        
        const total = kudosWeight + vsWeight + eventsWeight;
        const totalElement = document.getElementById('weightTotal');
        if (totalElement) {
            totalElement.textContent = total;
            totalElement.style.color = total === 100 ? '#059669' : '#ef4444';
        }
    }

    async awardKudos() {
        const playerName = document.getElementById('kudosPlayerName')?.value.trim();
        const points = parseInt(document.getElementById('kudosPoints')?.value);
        const reason = document.getElementById('kudosReason')?.value.trim();

        if (!playerName) {
            this.uiManager.showError('Please enter a player name');
            return;
        }

        if (!points || points < 1 || points > 10) {
            this.uiManager.showError('Please enter points between 1 and 10');
            return;
        }

        try {
            const awardedBy = 'Admin'; // You could get this from user context
            
            // Check if player already has kudos for today
            const today = new Date().toISOString().split('T')[0];
            const existingKudos = await this.seasonRankingManager.getKudosForPlayerAndDate(playerName, today);
            
            await this.seasonRankingManager.awardKudos(playerName, points, reason, awardedBy);
            
            if (existingKudos && existingKudos.length > 0) {
                this.uiManager.showSuccess(`Updated kudos for ${playerName} to ${points} points (was ${existingKudos[0].points} points)`);
            } else {
                this.uiManager.showSuccess(`Successfully awarded ${points} kudos points to ${playerName}`);
            }
            
            // Clear form
            document.getElementById('kudosPlayerName').value = '';
            document.getElementById('kudosPoints').value = '5';
            document.getElementById('kudosReason').value = '';
            
            // Update recent kudos list
            this.updateRecentKudosList();
            
        } catch (error) {
            console.error('Error awarding kudos:', error);
            this.uiManager.showError(`Error awarding kudos: ${error.message}`);
        }
    }

    async generateSeasonReport() {
        console.log('generateSeasonReport method called!');
        const seasonName = document.getElementById('seasonName')?.value.trim();
        const startDate = document.getElementById('seasonStartDate')?.value;
        const endDate = document.getElementById('seasonEndDate')?.value;
        
        console.log('Form values:', { seasonName, startDate, endDate });

        if (!seasonName) {
            this.uiManager.showError('Please enter a season name');
            return;
        }

        if (!startDate || !endDate) {
            this.uiManager.showError('Please select both start and end dates');
            return;
        }

        if (new Date(startDate) >= new Date(endDate)) {
            this.uiManager.showError('End date must be after start date');
            return;
        }

        const weights = {
            kudos: parseInt(document.getElementById('kudosWeight')?.value || 0),
            vsPerformance: parseInt(document.getElementById('vsPerformanceWeight')?.value || 0),
            specialEvents: parseInt(document.getElementById('specialEventsWeight')?.value || 0)
        };

        // Validate that the main weights (excluding alliance contribution) total 100%
        if (weights.kudos + weights.vsPerformance + weights.specialEvents !== 100) {
            this.uiManager.showError('Kudos, VS Performance, and Special Events weights must total exactly 100%');
            return;
        }

        // Show loading spinner and disable button
        const generateBtn = document.getElementById('generateSeasonReportBtn');
        const originalBtnText = generateBtn?.textContent;
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '⏳ Generating Report...';
        }

        try {
            console.log('Starting season report generation...');
            this.uiManager.showSuccess('Generating season report... This may take a moment.');
            
            // Generate rankings
            console.log('Calling generateSeasonRankings...');
            const rankings = await this.seasonRankingManager.generateSeasonRankings(
                seasonName, startDate, endDate, weights
            );
            console.log('Generated rankings:', rankings);

            // Save to database
            console.log('Saving rankings to database...');
            await this.seasonRankingManager.saveSeasonRankings(seasonName, startDate, endDate, rankings);
            console.log('Rankings saved successfully');

            // Display results
            console.log('Displaying season report...');
            await this.displaySeasonReport(seasonName, startDate, endDate, rankings, weights);
            console.log('Season report displayed');
            
            this.uiManager.showSuccess('Season report generated successfully!');
            
        } catch (error) {
            console.error('Error generating season report:', error);
            this.uiManager.showError(`Error generating season report: ${error.message}`);
        } finally {
            // Restore button state
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.innerHTML = originalBtnText || '🏆 Generate Season Report';
            }
        }
    }

    ensureSeasonReportElements() {
        console.log('Ensuring season report elements exist...');
        
        // Check if elements already exist
        let reportDisplay = document.getElementById('seasonReportDisplay');
        let reportContent = document.getElementById('seasonReportContent');
        
        if (reportDisplay && reportContent) {
            console.log('Season report elements already exist');
            return;
        }
        
        // Create the season report section if it doesn't exist
        const seasonReportSection = `
            <div class="admin-section">
                <div class="collapsible">
                    <div class="collapsible-header">
                        <h3>📊 Season Report Results</h3>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content collapsed">
                        <div class="season-report-display" id="seasonReportDisplay" style="display: none;">
                            <div id="seasonReportContent" class="season-report-content">
                                <!-- Season report will be generated here -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Find the admin sections container and append the season report section
        const adminSectionsContainer = document.querySelector('.admin-sections');
        if (adminSectionsContainer) {
            adminSectionsContainer.innerHTML += seasonReportSection;
            console.log('Season report section created and added to admin sections');
        } else {
            console.error('Admin sections container not found when trying to create season report elements');
            console.log('Available admin elements:', document.querySelectorAll('#adminTab *'));
        }
    }

    async clearSeasonData() {
        const seasonName = document.getElementById('seasonName')?.value.trim();
        const startDate = document.getElementById('seasonStartDate')?.value;
        const endDate = document.getElementById('seasonEndDate')?.value;

        if (!seasonName || !startDate || !endDate) {
            this.uiManager.showError('Please fill in season configuration before clearing data');
            return;
        }

        if (!confirm(`Are you sure you want to clear all season data for "${seasonName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await this.seasonRankingManager.clearSeasonData(seasonName, startDate, endDate);
            this.uiManager.showSuccess('Season data cleared successfully');
            
            // Hide report display
            const reportDisplay = document.getElementById('seasonReportDisplay');
            if (reportDisplay) {
                reportDisplay.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Error clearing season data:', error);
            this.uiManager.showError(`Error clearing season data: ${error.message}`);
        }
    }

    async displaySeasonReport(seasonName, startDate, endDate, rankings, weights) {
        console.log('displaySeasonReport called with:', { seasonName, startDate, endDate, rankings: rankings.length, weights });
        
        // Wait longer for DOM to be ready and retry if elements not found
        let reportDisplay = document.getElementById('seasonReportDisplay');
        let reportContent = document.getElementById('seasonReportContent');
        
        // If elements not found, wait and retry
        if (!reportDisplay || !reportContent) {
            console.log('Elements not found, waiting and retrying...');
            await new Promise(resolve => setTimeout(resolve, 500));
            reportDisplay = document.getElementById('seasonReportDisplay');
            reportContent = document.getElementById('seasonReportContent');
        }
        
        // If still not found, try to create them
        if (!reportDisplay || !reportContent) {
            console.log('Elements still not found, attempting to create them...');
            this.ensureSeasonReportElements();
            reportDisplay = document.getElementById('seasonReportDisplay');
            reportContent = document.getElementById('seasonReportContent');
        }
        
        console.log('Report display elements:', { reportDisplay, reportContent });
        console.log('All elements with seasonReportDisplay ID:', document.querySelectorAll('#seasonReportDisplay'));
        console.log('All elements with seasonReportContent ID:', document.querySelectorAll('#seasonReportContent'));
        
        if (!reportDisplay || !reportContent) {
            console.error('Season report display elements not found after retries');
            console.log('Available elements in admin sections:', document.querySelector('.admin-sections')?.innerHTML.substring(0, 500));
            this.uiManager.showError('Could not display season report - elements not found');
            return;
        }

        const eligiblePlayers = rankings.length;
        const excludedPlayers = await this.getExcludedPlayersInfo(startDate, endDate);

        const summaryHTML = `
            <div class="season-summary">
                <h5>📊 Season Summary</h5>
                <p><strong>Season:</strong> ${seasonName}</p>
                <p><strong>Period:</strong> ${startDate} to ${endDate}</p>
                <p><strong>Eligible Players:</strong> ${eligiblePlayers}</p>
                <p><strong>Excluded:</strong> ${excludedPlayers.leaders} Leaders, ${excludedPlayers.removed} Removed</p>
                <p><strong>Weights:</strong> Kudos ${weights.kudos}%, VS ${weights.vsPerformance}%, Events ${weights.specialEvents}%, Alliance ${weights.allianceContribution}%</p>
            </div>
        `;

        const rankingsHTML = rankings.map((ranking, index) => {
            const isTop3 = index < 3;
            const itemClass = isTop3 ? 'season-ranking-item top-3' : 'season-ranking-item';
            const uniqueId = `ranking-${index}`;
            
            // Create hover summary
            const hoverSummary = `Kudos: ${ranking.kudosScore.toFixed(1)}% | VS: ${ranking.vsPerformanceScore.toFixed(1)}% | Events: ${ranking.specialEventsScore.toFixed(1)}% | Alliance: ${ranking.allianceContributionScore.toFixed(1)}%`;
            
            return `
                <div class="${itemClass}" data-ranking-id="${uniqueId}">
                    <div class="season-ranking-header clickable" onclick="toggleRankingDetails('${uniqueId}')" title="${hoverSummary}">
                        <div>
                            <span class="season-rank">#${ranking.finalRank}</span>
                            <span class="season-player-name">${ranking.playerName}</span>
                            <span class="expand-icon" id="icon-${uniqueId}">▼</span>
                        </div>
                        <span class="season-total-score">${ranking.totalWeightedScore.toFixed(1)}</span>
                    </div>
                    <div class="season-score-breakdown collapsed" id="details-${uniqueId}">
                        <div class="score-component">
                            <div class="score-component-label">Kudos</div>
                            <div class="score-component-value">${ranking.kudosScore.toFixed(1)}%</div>
                        </div>
                        <div class="score-component">
                            <div class="score-component-label">VS Performance</div>
                            <div class="score-component-value">${ranking.vsPerformanceScore.toFixed(1)}%</div>
                        </div>
                        <div class="score-component">
                            <div class="score-component-label">Special Events</div>
                            <div class="score-component-value">${ranking.specialEventsScore.toFixed(1)}%</div>
                        </div>
                        <div class="score-component">
                            <div class="score-component-label">Alliance Contribution</div>
                            <div class="score-component-value">${ranking.allianceContributionScore.toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        reportContent.innerHTML = summaryHTML + `
            <div class="season-rankings-list">
                ${rankingsHTML}
            </div>
        `;
        
        // Add the toggle function to the global scope
        window.toggleRankingDetails = function(rankingId) {
            const detailsElement = document.getElementById(`details-${rankingId}`);
            const iconElement = document.getElementById(`icon-${rankingId}`);
            
            if (detailsElement && iconElement) {
                if (detailsElement.classList.contains('collapsed')) {
                    detailsElement.classList.remove('collapsed');
                    iconElement.textContent = '▲';
                } else {
                    detailsElement.classList.add('collapsed');
                    iconElement.textContent = '▼';
                }
            }
        };

        console.log('Setting report display to block...');
        reportDisplay.style.display = 'block';
        
        // Also expand the season report section
        const seasonReportSection = reportDisplay.closest('.collapsible');
        if (seasonReportSection) {
            const content = seasonReportSection.querySelector('.collapsible-content');
            const toggle = seasonReportSection.querySelector('.collapsible-toggle');
            if (content && toggle) {
                content.classList.remove('collapsed');
                toggle.textContent = '▲';
                console.log('Season report section expanded');
            }
        }
        
        console.log('Report display should now be visible');
    }

    async getExcludedPlayersInfo(startDate, endDate) {
        try {
            const allPlayers = await this.seasonRankingManager.getAllPlayersInPeriod(startDate, endDate);
            const eligiblePlayers = await this.seasonRankingManager.getEligiblePlayersInPeriod(startDate, endDate);
            
            const excludedCount = allPlayers.length - eligiblePlayers.length;
            
            // This is a simplified count - in a real implementation you'd want to separate leaders vs removed
            return {
                leaders: Math.floor(excludedCount / 2), // Rough estimate
                removed: Math.ceil(excludedCount / 2)   // Rough estimate
            };
        } catch (error) {
            console.error('Error getting excluded players info:', error);
            return { leaders: 0, removed: 0 };
        }
    }

    async updateRecentKudosList() {
        const kudosList = document.getElementById('recentKudosList');
        if (!kudosList) return;

        try {
            const recentKudos = await this.seasonRankingManager.getRecentKudos(10);
            
            if (recentKudos.length === 0) {
                kudosList.innerHTML = '<p class="no-kudos">No kudos awarded yet</p>';
                return;
            }

            const kudosHTML = recentKudos.map(kudos => `
                <div class="kudos-item">
                    <div class="kudos-info">
                        <span class="kudos-player">${kudos.player_name}</span>
                        <span class="kudos-details">
                            ${kudos.reason ? kudos.reason : 'No reason provided'} • 
                            Awarded by ${kudos.awarded_by} on ${kudos.date_awarded}
                        </span>
                    </div>
                    <div class="kudos-actions">
                        <span class="kudos-points">${kudos.points}</span>
                        <button class="delete-kudos-btn" data-kudos-id="${kudos.id}" title="Delete kudos">🗑️</button>
                    </div>
                </div>
            `).join('');

            kudosList.innerHTML = kudosHTML;
            
            // Add event listeners for delete buttons
            const deleteButtons = kudosList.querySelectorAll('.delete-kudos-btn');
            deleteButtons.forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const kudosId = button.getAttribute('data-kudos-id');
                    if (confirm('Are you sure you want to delete this kudos entry?')) {
                        try {
                            await this.seasonRankingManager.deleteKudos(kudosId);
                            this.uiManager.showSuccess('Kudos deleted successfully');
                            this.updateRecentKudosList(); // Refresh the list
                        } catch (error) {
                            console.error('Error deleting kudos:', error);
                            this.uiManager.showError('Error deleting kudos: ' + error.message);
                        }
                    }
                });
            });
            
        } catch (error) {
            console.error('Error updating recent kudos list:', error);
            kudosList.innerHTML = '<p class="loading-kudos">Error loading kudos</p>';
        }
    }

    setupKudosPlayerAutocomplete() {
        const kudosPlayerInput = document.getElementById('kudosPlayerName');
        const kudosAutocomplete = document.getElementById('kudosPlayerAutocomplete');
        
        if (!kudosPlayerInput || !kudosAutocomplete) return;

        kudosPlayerInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                kudosAutocomplete.style.display = 'none';
                return;
            }

            try {
                const suggestions = await this.autocompleteService.getPlayerSuggestions(query);
                
                if (suggestions.length === 0) {
                    kudosAutocomplete.style.display = 'none';
                    return;
                }

                const suggestionsHTML = suggestions.map(player => `
                    <div class="autocomplete-item" data-player="${player}">${player}</div>
                `).join('');

                kudosAutocomplete.innerHTML = suggestionsHTML;
                kudosAutocomplete.style.display = 'block';

                // Add click handlers
                kudosAutocomplete.querySelectorAll('.autocomplete-item').forEach(item => {
                    item.addEventListener('click', () => {
                        kudosPlayerInput.value = item.dataset.player;
                        kudosAutocomplete.style.display = 'none';
                    });
                });

            } catch (error) {
                console.error('Error getting kudos player suggestions:', error);
                kudosAutocomplete.style.display = 'none';
            }
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!kudosPlayerInput.contains(e.target) && !kudosAutocomplete.contains(e.target)) {
                kudosAutocomplete.style.display = 'none';
            }
        });
    }

    setupEventDataTabs() {
        // Setup tab switching for event data input
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                const targetTab = e.target.dataset.tab;
                
                // Remove active class from all tabs and content
                document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                e.target.classList.add('active');
                const targetContent = document.getElementById(`${targetTab}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            }
        });
    }

    async addAllianceLeader() {
        const newLeaderInput = document.getElementById('newLeaderName');
        if (!newLeaderInput) {
            console.error('New leader input not found - admin content not loaded');
            this.uiManager.showError('Admin interface not ready. Please try again.');
            return;
        }
        
        const leaderName = newLeaderInput.value.trim();
        
        if (!leaderName) {
            this.uiManager.showError('Please enter a leader name');
            return;
        }
        
        try {
            await this.leaderVIPManager.addAllianceLeader(leaderName);
            this.uiManager.showSuccess(`Successfully added "${leaderName}" as an alliance leader`);
            
            // Clear form
            newLeaderInput.value = '';
            
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
        const removeLeaderSelect = document.getElementById('removeLeaderName');
        if (!removeLeaderSelect) {
            console.error('Remove leader select not found - admin content not loaded');
            this.uiManager.showError('Admin interface not ready. Please try again.');
            return;
        }
        
        const leaderName = removeLeaderSelect.value;
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
        const vipDateInput = document.getElementById('vipDate');
        const vipPlayerInput = document.getElementById('vipPlayer');
        const vipNotesInput = document.getElementById('vipNotes');
        
        if (!vipDateInput || !vipPlayerInput || !vipNotesInput) {
            console.error('VIP form elements not found - admin content not loaded');
            this.uiManager.showError('Admin interface not ready. Please try again.');
            return;
        }
        
        const date = vipDateInput.value;
        const vipPlayer = vipPlayerInput.value.trim();
        const notes = vipNotesInput.value.trim();
        
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
            vipDateInput.value = '';
            vipPlayerInput.value = '';
            vipNotesInput.value = '';
            
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
            for (const event of specialEvents) {
                try {
                    const startDate = new Date(event.startDate);
                    const endDate = new Date(event.endDate);
                    
                    // Validate dates
                    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                        console.error('Invalid date in special event:', event);
                        continue; // Skip this event
                    }
                    
                    const startDateStr = startDate.toLocaleDateString();
                    const endDateStr = endDate.toLocaleDateString();
                    
                    // Get row count for this special event
                    const eventRankings = await this.rankingManager.getRankingsForSpecialEvent(event.key);
                    const rowCount = eventRankings ? eventRankings.length : 0;
                
                html += `
                    <div class="event-entry ${event.pinned ? 'pinned-event' : ''}" data-event-key="${this.escapeHTML(event.key)}" data-event-name="${this.escapeHTML(event.name)}" data-start-date="${event.startDate}" data-end-date="${event.endDate}" data-event-weight="${event.event_weight || 10.0}">
                        <div class="event-info">
                            <div class="event-name">${this.escapeHTML(event.name)} ${event.pinned ? '📌' : ''}</div>
                            <div class="event-dates">${startDateStr} - ${endDateStr}</div>
                            <div class="event-key">Key: ${this.escapeHTML(event.key)}</div>
                            <div class="event-row-count">📊 ${rowCount} rankings</div>
                            ${event.pinned ? '<div class="pinned-indicator">📌 Pinned Event</div>' : ''}
                        </div>
                        <div class="event-actions">
                            <button class="event-btn pin" data-action="pin" data-pinned="${event.pinned}">
                                ${event.pinned ? '📌 Unpin' : '📌 Pin'}
                            </button>
                            <button class="event-btn edit" data-action="edit">✏️ Edit</button>
                            <button class="event-btn delete" data-action="delete">🗑️ Delete</button>
                        </div>
                    </div>
                `;
                } catch (error) {
                    console.error('Error processing special event:', event, error);
                    // Skip this event and continue with the next one
                }
            }
            
            eventsListContainer.innerHTML = html;
            
            // Setup event delegation for edit/delete buttons
            this.setupSpecialEventListeners();
            
            // Setup cleanup button listener
            const cleanupBtn = document.getElementById('cleanupInvalidEventsBtn');
            if (cleanupBtn) {
                cleanupBtn.addEventListener('click', () => this.cleanupInvalidSpecialEvents());
            }
            
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
                const eventWeight = eventEntry.dataset.eventWeight;
                
                if (e.target.dataset.action === 'edit') {
                    this.editSpecialEvent(eventKey, eventName, startDate, endDate, eventWeight);
                } else if (e.target.dataset.action === 'delete') {
                    this.deleteSpecialEvent(eventKey);
                } else if (e.target.dataset.action === 'pin') {
                    const currentPinned = e.target.dataset.pinned === 'true';
                    this.toggleSpecialEventPinned(eventKey, !currentPinned);
                }
            }
        });
    }

    // Edit special event
    editSpecialEvent(eventKey, eventName, startDate, endDate, eventWeight) {
        try {
            console.log('Editing special event:', { eventKey, eventName, startDate, endDate, eventWeight });
            
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
            const editEventWeight = document.getElementById('editEventWeight');
            
            if (editEventKey) editEventKey.value = eventKey;
            if (editEventName) editEventName.value = eventName;
            if (editEventStartDate) editEventStartDate.value = startDate;
            if (editEventEndDate) editEventEndDate.value = endDate;
            if (editEventWeight) editEventWeight.value = eventWeight || 10.0;
            
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

    // Get consistently struggling players for the week
    async getConsistentlyStrugglingPlayers(weekDateKeys) {
        try {
            console.log('Finding consistently struggling players for week:', weekDateKeys);
            
            // Get all rankings for the week
            const weeklyRankings = {};
            const playerAppearances = {};
            const top10Players = new Set();
            const lower20Players = new Set();
            
            // Process each day's rankings
            for (const dateKey of weekDateKeys) {
                const rankings = await this.rankingManager.getRankingsForDate(dateKey);
                if (!rankings || rankings.length === 0) continue;
                
                weeklyRankings[dateKey] = rankings;
                
                // Track top 10 players (to exclude them)
                const top10 = rankings.slice(0, 10);
                top10.forEach(r => top10Players.add(r.commander));
                
                // Track lower 20 players
                const lower20 = rankings.slice(-20);
                lower20.forEach(r => lower20Players.add(r.commander));
                
                // Count appearances for each player
                rankings.forEach(r => {
                    if (!playerAppearances[r.commander]) {
                        playerAppearances[r.commander] = 0;
                    }
                    playerAppearances[r.commander]++;
                });
            }
            
            console.log('Top 10 players found:', Array.from(top10Players));
            console.log('Lower 20 players found:', Array.from(lower20Players));
            console.log('Player appearances:', playerAppearances);
            
            // Filter players who meet our criteria and collect their daily rank data
            const strugglingPlayers = Object.entries(playerAppearances)
                .filter(([name, frequency]) => {
                    // Must not appear in top 10 on any day
                    const neverInTop10 = !top10Players.has(name);
                    // Must appear in lower 20 at least once
                    const inLower20AtLeastOnce = lower20Players.has(name);
                    // Must have appeared at least twice to show consistency
                    const hasMultipleAppearances = frequency >= 2;
                    
                    return neverInTop10 && inLower20AtLeastOnce && hasMultipleAppearances;
                })
                .map(([name, frequency]) => {
                    // Collect daily rank data for this player
                    const dailyRanks = [];
                    for (const dateKey of weekDateKeys) {
                        const rankings = weeklyRankings[dateKey];
                        if (rankings) {
                            const playerRanking = rankings.find(r => r.commander === name);
                            if (playerRanking) {
                                const actualRank = playerRanking.ranking; // Use actual ranking from database
                                const totalPlayers = rankings.length;
                                dailyRanks.push({ date: dateKey, rank: actualRank, totalPlayers });
                            }
                        }
                    }
                    
                    return { name, frequency, dailyRanks };
                })
                .sort((a, b) => b.frequency - a.frequency) // Sort by frequency (highest first)
                .slice(0, 3); // Take top 3
            
            console.log('Consistently struggling players:', strugglingPlayers);
            return strugglingPlayers;
            
        } catch (error) {
            console.error('Error finding consistently struggling players:', error);
            return [];
        }
    }

    // Cleanup invalid special events
    async cleanupInvalidSpecialEvents() {
        try {
            console.log('Starting cleanup of invalid special events...');
            
            const specialEvents = await this.rankingManager.getSpecialEvents();
            let invalidEvents = [];
            
            // Find events with invalid dates
            for (const event of specialEvents) {
                try {
                    const startDate = new Date(event.startDate + 'T00:00:00');
                    const endDate = new Date(event.endDate + 'T23:59:59');
                    
                    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                        invalidEvents.push(event);
                    }
                } catch (error) {
                    console.warn('Error validating event dates:', event, error);
                    invalidEvents.push(event);
                }
            }
            
            if (invalidEvents.length === 0) {
                this.uiManager.showInfo('No invalid events found. All special events have valid dates.');
                return;
            }
            
            if (confirm(`Found ${invalidEvents.length} invalid special events. Would you like to delete them? This will also remove all associated rankings.`)) {
                let deletedCount = 0;
                
                for (const event of invalidEvents) {
                    try {
                        await this.rankingManager.deleteSpecialEvent(event.key);
                        deletedCount++;
                        console.log('Deleted invalid event:', event.key);
                    } catch (error) {
                        console.error('Error deleting invalid event:', event.key, error);
                    }
                }
                
                this.uiManager.showSuccess(`Successfully deleted ${deletedCount} invalid special events.`);
                
                // Refresh the events list and weekly tabs
                this.updateSpecialEventsList();
                await this.updateWeeklyTabs();
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
            this.uiManager.showError(`Error during cleanup: ${error.message}`);
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
            
            // Setup tab switching for edit modal data input
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('tab-btn')) {
                    const targetTab = e.target.dataset.tab;
                    
                    // Remove active class from all tabs and content
                    modal.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                    modal.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                    
                    // Add active class to clicked tab and corresponding content
                    e.target.classList.add('active');
                    const targetContent = modal.querySelector(`#${targetTab}-tab`);
                    if (targetContent) {
                        targetContent.classList.add('active');
                    }
                }
            });
            
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
            const eventWeight = parseFloat(document.getElementById('editEventWeight')?.value) || 10.0;
            
            // Get data upload inputs
            const csvFile = document.getElementById('editEventCSVFile')?.files[0];
            const rawData = document.getElementById('editEventRawData')?.value?.trim();
            
            if (!eventKey || !eventName || !startDate || !endDate) {
                this.uiManager.showError('Please fill in all fields');
                return;
            }
            
            if (eventWeight < 0 || eventWeight > 100) {
                this.uiManager.showError('Event weight must be between 0 and 100 percent');
                return;
            }
            
            // Validate date format (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
                this.uiManager.showError('Invalid date format. Please use YYYY-MM-DD format.');
                return;
            }
            
            // Validate date logic and prevent future dates
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
            
            // Prevent future dates
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset time to start of day
            
            if (startDateObj > today || endDateObj > today) {
                this.uiManager.showError('Cannot update special events with future dates. Please use today or past dates only.');
                return;
            }
            
            // Update the special event
            await this.rankingManager.updateSpecialEvent(eventKey, {
                name: eventName,
                startDate: startDate,
                endDate: endDate,
                event_weight: eventWeight
            });
            
            // Process data if provided
            if (csvFile || rawData) {
                try {
                    let csvContent = '';
                    
                    if (csvFile) {
                        csvContent = await this.readFileAsText(csvFile);
                    } else if (rawData) {
                        csvContent = rawData;
                    }

                    if (csvContent) {
                        // Process the CSV data for the special event
                        await this.processSpecialEventData(csvContent, eventName, startDate, endDate);
                        
                        // Clear the form fields
                        this.clearEditEventForm();
                    }
                } catch (dataError) {
                    console.error('Error processing event data:', dataError);
                    this.uiManager.showError(`Event updated but failed to process data: ${dataError.message}`);
                }
            }
            
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
    async updateVIPFrequencyDisplay(inputId, playerName) {
        console.log(`updateVIPFrequencyDisplay called for ${inputId} with player: "${playerName}"`);
        
        const frequencyInfoElement = document.getElementById(inputId === 'vipPlayer' ? 'vipFrequencyInfo' : 'editVipFrequencyInfo');
        if (!frequencyInfoElement) {
            console.error(`Frequency info element not found for ${inputId}`);
            return;
        }
        
        const daysAgoBadge = frequencyInfoElement.querySelector('.days-ago');
        const count30DaysBadge = frequencyInfoElement.querySelector('.count-30-days');
        
        if (!daysAgoBadge || !count30DaysBadge) {
            console.error(`Badge elements not found for ${inputId}`);
            return;
        }
        
        if (!playerName || playerName.trim() === '') {
            console.log(`Hiding frequency info for ${inputId} - no player name`);
            frequencyInfoElement.style.display = 'none';
            return;
        }
        
        console.log(`Getting VIP frequency info for: ${playerName}`);
        
        // Refresh VIP data to ensure we have the latest information
        await this.leaderVIPManager.refreshVIPData();
        
        const frequencyData = this.leaderVIPManager.getVIPFrequencyInfo(playerName);
        console.log('Frequency data:', frequencyData);
        
        if (frequencyData.lastSelectedDays === null) {
            // Player has never been VIP
            console.log(`Player ${playerName} has never been VIP`);
            daysAgoBadge.textContent = 'Never VIP';
            count30DaysBadge.textContent = '0 times (30d)';
        } else {
            console.log(`Player ${playerName} was VIP ${frequencyData.lastSelectedDays} days ago, ${frequencyData.frequency30Days} times in 30d`);
            daysAgoBadge.textContent = `${frequencyData.lastSelectedDays} days ago`;
            count30DaysBadge.textContent = `${frequencyData.frequency30Days} times (30d)`;
        }
        
        frequencyInfoElement.style.display = 'flex';
        console.log(`Frequency info displayed for ${inputId}`);
    }



    updateLeaderDropdowns() {
        const removeDropdown = document.getElementById('removeLeaderName');
        if (!removeDropdown) {
            console.log('Remove leader dropdown not found - admin content not loaded yet');
            return;
        }
        
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
        
        if (!currentLeadersContainer || !leaderCountElement) {
            console.log('Leader display elements not found - admin content not loaded yet');
            return;
        }
        
        // Debug: Log all leaders and their status
        console.log('All alliance leaders:', this.leaderVIPManager.allianceLeaders);
        
        // Only show active leaders
        const currentLeaders = this.leaderVIPManager.allianceLeaders.filter(leader => leader.is_active);
        
        console.log('Active alliance leaders:', currentLeaders);
        
        // Update the count in the heading
        leaderCountElement.textContent = currentLeaders.length;
        
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

    updateRecentVIPsList() {
        const recentVIPsContainer = document.getElementById('recentVIPsList');
        if (!recentVIPsContainer) {
            console.log('Recent VIPs container not found - admin content not loaded yet');
            return;
        }
        
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
                    const analysis = await this.generateDailyAnalysis(rankings, currentDateKey, top10Occurrences, cumulativeScores, weekDateKeys);
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

    async generateDailyAnalysis(rankings, dateKey, top10Occurrences, cumulativeScores, weekDateKeys) {
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
        
        // Find lowest performers today
        const bottom3Today = rankings.slice(-3).reverse();
        const bottom3TodayNames = bottom3Today.map(r => r.commander).join(', ');
        
        // Find consistently struggling players this week
        // Players who: never in top 10, appear in lower 20 at least once, sorted by frequency
        const strugglingPlayers = await this.getConsistentlyStrugglingPlayers(weekDateKeys);
        
        let analysis = `
            <p><span class="analysis-highlight">${dayName} Analysis:</span> ${totalPlayers} players competed today ${pointsAnalysis}.</p>
            <div class="analysis-stat">
                <strong>Top 3 Today:</strong> ${top3Names}
            </div>
            <div class="analysis-stat bottom-performers">
                <strong>Bottom 3 Today:</strong> ${bottom3TodayNames}
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
        
        if (strugglingPlayers.length > 0) {
            const strugglingPlayersText = strugglingPlayers
                .map(player => {
                    const rankInfo = player.dailyRanks
                        .map(rank => `${this.formatSimpleDayName(new Date(rank.date + 'T00:00:00'))}: rank ${rank.rank}`)
                        .join(', ');
                    return `${player.name} (appeared ${player.frequency}x - ${rankInfo})`;
                })
                .join('<br>');
            analysis += `
                <div class="analysis-stat bottom-performers">
                    <strong>Consistently Struggling This Week:</strong><br>
                    ${strugglingPlayersText}
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
                // Show/hide player name filter based on report type
                const playerNameFilter = document.getElementById('playerNameFilter');
                if (playerNameFilter) {
                    if (reportType.value === 'player-performance') {
                        playerNameFilter.style.display = 'block';
                    } else {
                        playerNameFilter.style.display = 'none';
                    }
                }
                
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
        
        // Set up player name change handler with autocomplete
        const playerName = document.getElementById('playerName');
        if (playerName) {
            playerName.addEventListener('input', () => {
                if (reportType.value === 'player-performance') {
                    this.handlePlayerNameInput();
                }
            });
            
            // Add autocomplete event listeners
            playerName.addEventListener('focus', () => this.showPlayerSuggestions());
            playerName.addEventListener('blur', () => {
                // Delay hiding suggestions to allow clicking on them
                setTimeout(() => this.hidePlayerSuggestions(), 200);
            });
            
            // Add keyboard navigation
            playerName.addEventListener('keydown', (e) => this.handlePlayerNameKeydown(e));
        }
    }

    showAdminTab() {
        // Ensure admin content is loaded before proceeding
        if (!document.querySelector('#adminTab .admin-sections')) {
            console.log('Admin content not loaded, loading now...');
            this.loadAdminContent();
            // Give a small delay for content to load
            setTimeout(() => {
                this.showAdminTab();
            }, 100);
            return;
        }
        
        console.log('Admin tab shown, setting up functionality...');
        
        // Set current date for VIP form
        const today = new Date();
        const vipDateInput = document.getElementById('vipDate');
        if (vipDateInput) {
            vipDateInput.value = this.formatDateForInput(today);
        }
        
        // Update leader dropdowns and current leaders list
        this.updateLeaderDropdowns();
        
        // Update recent VIPs list
        this.updateRecentVIPsList();
        
        // Update recent kudos list
        this.updateRecentKudosList();
        
        // Setup train conductor rotation management
        this.setupRotationManagement();
        


        // Setup VIP frequency display event listeners
        this.setupVIPFrequencyListeners();
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

    setupRemovedPlayerAutocomplete() {
        const removedPlayerInput = document.getElementById('removedPlayerName');
        const autocompleteDropdown = document.getElementById('removedPlayerAutocomplete');
        
        if (!removedPlayerInput || !autocompleteDropdown) {
            console.error('Removed player autocomplete elements not found');
            return;
        }
        
        removedPlayerInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                autocompleteDropdown.innerHTML = '';
                autocompleteDropdown.style.display = 'none';
                return;
            }
            
            try {
                const suggestions = await this.autocompleteService.getPlayerSuggestions(query);
                
                if (suggestions.length === 0) {
                    autocompleteDropdown.innerHTML = '';
                    autocompleteDropdown.style.display = 'none';
                    return;
                }
                
                autocompleteDropdown.innerHTML = suggestions.map(player => 
                    `<div class="autocomplete-suggestion" data-value="${player}">${player}</div>`
                ).join('');
                
                autocompleteDropdown.style.display = 'block';
                
                // Add click event listeners
                autocompleteDropdown.querySelectorAll('.autocomplete-suggestion').forEach(suggestion => {
                    suggestion.addEventListener('click', (e) => {
                        removedPlayerInput.value = e.target.dataset.value;
                        autocompleteDropdown.style.display = 'none';
                    });
                });
                
            } catch (error) {
                console.error('Error getting player suggestions for removed player:', error);
            }
        });
        
        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!removedPlayerInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
                autocompleteDropdown.style.display = 'none';
            }
        });
    }

    setupAutocomplete() {
        console.log('Setting up autocomplete for admin fields...');
        
        // Setup autocomplete for leader selection
        const leaderInput = document.getElementById('newLeaderName');
        const leaderDropdown = document.getElementById('leaderAutocomplete');
        if (leaderInput && leaderDropdown) {
            console.log('Setting up leader autocomplete');
            this.autocompleteService.setupAutocomplete(
                leaderInput,
                leaderDropdown,
                (selectedName) => {
                    leaderInput.value = selectedName;
                    console.log('Leader selected:', selectedName);
                }
            );
        } else {
            console.warn('Leader autocomplete elements not found');
        }
        
        // Setup autocomplete for VIP selection
        const vipInput = document.getElementById('vipPlayer');
        const vipDropdown = document.getElementById('vipAutocomplete');
        if (vipInput && vipDropdown) {
            console.log('Setting up VIP autocomplete');
            this.autocompleteService.setupAutocomplete(
                vipInput,
                vipDropdown,
                (selectedName) => {
                    vipInput.value = selectedName;
                    console.log('VIP selected:', selectedName);
                    // Update VIP frequency info
                    this.updateVIPFrequencyDisplay('vipPlayer', selectedName);
                },
                true // Exclude leaders
            );
        } else {
            console.warn('VIP autocomplete elements not found');
        }
        
        // Setup autocomplete for old player name
        const oldPlayerInput = document.getElementById('oldPlayerName');
        const oldPlayerDropdown = document.getElementById('oldPlayerAutocomplete');
        if (oldPlayerInput && oldPlayerDropdown) {
            console.log('Setting up old player autocomplete');
            this.autocompleteService.setupAutocomplete(
                oldPlayerInput,
                oldPlayerDropdown,
                (selectedName) => {
                    oldPlayerInput.value = selectedName;
                    console.log('Old player selected:', selectedName);
                }
            );
        } else {
            console.warn('Old player autocomplete elements not found');
        }
        
        // Setup autocomplete for edit VIP player
        const editVipInput = document.getElementById('editVipPlayer');
        const editVipDropdown = document.getElementById('editVipAutocomplete');
        if (editVipInput && editVipDropdown) {
            console.log('Setting up edit VIP autocomplete');
            this.autocompleteService.setupAutocomplete(
                editVipInput,
                editVipDropdown,
                (selectedName) => {
                    editVipInput.value = selectedName;
                    console.log('Edit VIP selected:', selectedName);
                    // Update VIP frequency info
                    this.updateVIPFrequencyDisplay('editVipPlayer', selectedName);
                },
                true // Exclude leaders
            );
        } else {
            console.warn('Edit VIP autocomplete elements not found');
        }
        
        // Setup autocomplete for edit VIP conductor
        const editVipConductorInput = document.getElementById('editVipConductor');
        const editVipConductorDropdown = document.getElementById('editVipConductorAutocomplete');
        if (editVipConductorInput && editVipConductorDropdown) {
            console.log('Setting up edit VIP conductor autocomplete');
            this.autocompleteService.setupAutocomplete(
                editVipConductorInput,
                editVipConductorDropdown,
                (selectedName) => {
                    editVipConductorInput.value = selectedName;
                    console.log('Edit VIP conductor selected:', selectedName);
                }
            );
        } else {
            console.warn('Edit VIP conductor autocomplete elements not found');
        }
        
        console.log('Autocomplete setup completed');
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
                case 'player-performance':
                    const playerName = document.getElementById('playerName').value?.trim();
                    if (!playerName) {
                        throw new Error('Please enter a player name for the performance analysis');
                    }
                    reportData = await this.generatePlayerPerformanceReport(playerName, dateRange);
                    reportTitle = `👤 ${playerName} - Performance Analysis`;
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
        
        // Check if this is a player performance report
        if (data.length > 0 && data[0].player && title.includes('Performance Analysis')) {
            this.displayPlayerPerformanceReport(title, data[0]);
            return;
        }
        
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

    // Display player performance report in a special format
    displayPlayerPerformanceReport(title, performance) {
        const content = document.getElementById('reportContent');
        if (!content) return;
        
        const html = `
            <div class="report-header">
                <h3>${title}</h3>
                <div class="report-meta">
                    <span class="meta-item">⏰ Generated: ${new Date().toLocaleString()}</span>
                </div>
            </div>
            
            <div class="player-performance-report">
                <div class="performance-overview">
                    <div class="performance-card primary">
                        <h4>📊 Overall Performance</h4>
                        <div class="metric-grid">
                            <div class="metric">
                                <span class="metric-label">Total Appearances</span>
                                <span class="metric-value">${performance.totalAppearances}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Average Ranking</span>
                                <span class="metric-value">${performance.averageRanking}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Best Ranking</span>
                                <span class="metric-value">🏆 ${performance.bestRanking}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Worst Ranking</span>
                                <span class="metric-value">📉 ${performance.worstRanking}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="performance-card">
                        <h4>💰 Points Analysis</h4>
                        <div class="metric-grid">
                            <div class="metric">
                                <span class="metric-label">Total Points</span>
                                <span class="metric-value">${performance.totalPoints.toLocaleString()}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Average Points</span>
                                <span class="metric-value">${performance.averagePoints}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Highest Score</span>
                                <span class="metric-value">🏆 ${performance.highestScore.toLocaleString()}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Lowest Score</span>
                                <span class="metric-value">📉 ${performance.lowestScore.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="performance-details">
                    <div class="performance-card">
                        <h4>📈 Performance Distribution</h4>
                        <div class="metric-grid">
                            <div class="metric">
                                <span class="metric-label">Top 10 Finishes</span>
                                <span class="metric-value">${performance.top10Count}x (${performance.top10Percentage}%)</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Bottom 20 Finishes</span>
                                <span class="metric-value">${performance.bottom20Count}x</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Top 25 Finishes</span>
                                <span class="metric-value">${performance.top25Percentage}%</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Consistency</span>
                                <span class="metric-value">${performance.consistency}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="performance-card">
                        <h4>🔄 Recent & Trend Analysis</h4>
                        <div class="metric-grid">
                            <div class="metric">
                                <span class="metric-label">Recent Performance (Last 5)</span>
                                <span class="metric-value">${performance.recentPerformance}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Performance Trend</span>
                                <span class="metric-value">${performance.trendIndicator} ${performance.performanceTrend}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Special Events</span>
                                <span class="metric-value">${performance.specialEventAppearances}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${performance.specialEventsAnalysis && performance.specialEventsAnalysis.totalEvents > 0 && performance.specialEventsAnalysis.allianceEvents && performance.specialEventsAnalysis.nonAllianceEvents ? `
                <div class="special-events-analysis">
                    <div class="performance-card">
                        <h4>🎯 Special Events Analysis</h4>
                        <div class="metric-grid">
                            <div class="metric">
                                <span class="metric-label">Total Events</span>
                                <span class="metric-value">${performance.specialEventsAnalysis.totalEvents}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Average Ranking</span>
                                <span class="metric-value">${performance.specialEventsAnalysis.averageRanking}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Best Event Ranking</span>
                                <span class="metric-value">🏆 ${performance.specialEventsAnalysis.bestRanking}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Performance Level</span>
                                <span class="metric-value">${this.getPerformanceLevelEmoji(performance.specialEventsAnalysis.performanceLevel)} ${performance.specialEventsAnalysis.performanceLevel}</span>
                            </div>
                        </div>
                        
                        <div class="metric-grid">
                            <div class="metric">
                                <span class="metric-label">Top 10 Events</span>
                                <span class="metric-value">${performance.specialEventsAnalysis.top10Events} (${performance.specialEventsAnalysis.top10Percentage}%)</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Top 25 Events</span>
                                <span class="metric-value">${performance.specialEventsAnalysis.top25Events} (${performance.specialEventsAnalysis.top25Percentage}%)</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Alliance Events</span>
                                <span class="metric-value">${performance.specialEventsAnalysis.allianceEvents.count} (Avg: ${performance.specialEventsAnalysis.allianceEvents.averageRanking})</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Non-Alliance Events</span>
                                <span class="metric-value">${performance.specialEventsAnalysis.nonAllianceEvents.count} (Avg: ${performance.specialEventsAnalysis.nonAllianceEvents.averageRanking})</span>
                            </div>
                        </div>
                        
                        <div class="event-details">
                            <h5>📋 Recent Event Details</h5>
                            <div class="event-list">
                                ${performance.specialEventsAnalysis.eventDetails.slice(0, 5).map(event => `
                                    <div class="event-item">
                                        <span class="event-name">${event.eventName}</span>
                                        <span class="event-date">${this.formatDateDisplay(new Date(event.eventDate))}</span>
                                        <span class="event-ranking">#${event.ranking}</span>
                                        <span class="event-type">${event.isAllianceEvent ? '🏛️ Alliance' : '🎯 Regular'}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <div class="performance-timeline">
                    <div class="performance-card">
                        <h4>📅 Participation Timeline</h4>
                        <div class="metric-grid">
                            <div class="metric">
                                <span class="metric-label">First Appearance</span>
                                <span class="metric-value">${performance.firstAppearance ? this.formatDateDisplay(new Date(performance.firstAppearance + 'T00:00:00')) : 'Unknown'}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Last Appearance</span>
                                <span class="metric-value">${performance.lastAppearance ? this.formatDateDisplay(new Date(performance.lastAppearance + 'T00:00:00')) : 'Unknown'}</span>
                            </div>
                        </div>
                    </div>
                </div>
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

    // Generate comprehensive player performance report
    async generatePlayerPerformanceReport(playerName, dateRange) {
        try {
            console.log(`Generating performance report for player: ${playerName}`);
            
            const allRankings = await this.rankingManager.getAllRankings();
            
            if (!Array.isArray(allRankings)) {
                throw new Error('Failed to retrieve rankings data');
            }
            
            const filteredRankings = this.filterRankingsByDateRange(allRankings, dateRange);
            
            // Filter rankings for the specific player
            const playerRankings = filteredRankings.filter(r => 
                r.commander.toLowerCase() === playerName.toLowerCase()
            );
            
            if (playerRankings.length === 0) {
                throw new Error(`No data found for player "${playerName}" in the selected date range`);
            }
            
            // Calculate comprehensive performance metrics
            const performance = await this.calculatePlayerPerformanceMetrics(playerRankings, playerName);
            
            return [performance]; // Return as array for consistency with other reports
        } catch (error) {
            console.error('Error in generatePlayerPerformanceReport:', error);
            throw new Error(`Failed to generate player performance report: ${error.message}`);
        }
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

    // Calculate comprehensive performance metrics for a specific player
    async calculatePlayerPerformanceMetrics(rankings, playerName) {
        try {
            // Sort rankings by date (newest first)
            const sortedRankings = [...rankings].sort((a, b) => {
                const dateA = new Date(a.day + 'T00:00:00');
                const dateB = new Date(b.day + 'T00:00:00');
                return dateB - dateA;
            });
            
            // Basic metrics
            const totalAppearances = rankings.length;
            const totalPoints = rankings.reduce((sum, r) => sum + (parseFloat(r.points) || 0), 0);
            const avgPoints = totalPoints / totalAppearances;
            
            // Points range
            const validPoints = rankings.filter(r => r.points && !isNaN(parseFloat(r.points)));
            const highestScore = validPoints.length > 0 ? Math.max(...validPoints.map(r => parseFloat(r.points))) : 0;
            const lowestScore = validPoints.length > 0 ? Math.min(...validPoints.map(r => parseFloat(r.points))) : 0;
            
            // Ranking metrics
            const rankings_only = rankings.filter(r => r.ranking && !isNaN(r.ranking));
            const avgRanking = rankings_only.length > 0 ? 
                rankings_only.reduce((sum, r) => sum + r.ranking, 0) / rankings_only.length : 0;
            
            const bestRanking = Math.min(...rankings_only.map(r => r.ranking));
            const worstRanking = Math.max(...rankings_only.map(r => r.ranking));
            
            // Performance distribution
            const top10Count = rankings.filter(r => r.ranking <= 10).length;
            const top25Count = rankings.filter(r => r.ranking <= 25).length;
            
            // Calculate bottom 20 appearances correctly
            // We need to check if the player was in the bottom 20 players by ranking score
            let bottom20Count = 0;
            
            // Get all rankings to find the true lowest scoring player for each day
            const allRankings = await this.rankingManager.getAllRankings();
            if (!Array.isArray(allRankings)) {
                console.error('Failed to get all rankings for bottom 20 calculation');
                bottom20Count = 0;
            } else {
                // Group ALL rankings by day to get complete field data
                const allDayRankings = {};
                allRankings.forEach(r => {
                    if (!allDayRankings[r.day]) {
                        allDayRankings[r.day] = [];
                    }
                    allDayRankings[r.day].push(r);
                });
                
                // For each day the player participated, check if they were in bottom 20
                rankings.forEach(playerRanking => {
                    if (playerRanking.ranking) {
                        const dayKey = playerRanking.day;
                        const allRankingsForDay = allDayRankings[dayKey];
                        
                        if (allRankingsForDay && allRankingsForDay.length > 0) {
                            // Find the true lowest scoring player (highest ranking number) for this day
                            const lowestScoringPlayer = allRankingsForDay.reduce((lowest, current) => {
                                return (current.ranking > lowest.ranking) ? current : lowest;
                            });
                            
                            // Check if player was in bottom 20 players by ranking score
                            if (playerRanking.ranking >= (lowestScoringPlayer.ranking - 20)) {
                                console.log('Player was in bottom 20 players by ranking score:', playerName, playerRanking.ranking, lowestScoringPlayer.ranking, 'Day:', dayKey);
                                bottom20Count++;
                            }
                        }
                    }
                });
            }
            
            // Recent performance (last 5 appearances)
            const recentRankings = sortedRankings.slice(0, 5);
            const recentAvgRanking = recentRankings.length > 0 ? 
                recentRankings.reduce((sum, r) => sum + (r.ranking || 0), 0) / recentRankings.length : 0;
            
            // Special events participation - enhanced analysis
            const specialEventRankings = rankings.filter(r => r.day.startsWith('event_'));
            const specialEventCount = specialEventRankings.length;
            
            // Get detailed special events analysis
            let specialEventsAnalysis;
            try {
                specialEventsAnalysis = await this.analyzePlayerSpecialEvents(playerName, specialEventRankings);
            } catch (error) {
                console.error('Error in special events analysis, using fallback:', error);
                specialEventsAnalysis = {
                    totalEvents: specialEventRankings.length,
                    averageRanking: 0,
                    bestRanking: 0,
                    worstRanking: 0,
                    top10Events: 0,
                    top25Events: 0,
                    top10Percentage: 0,
                    top25Percentage: 0,
                    performanceLevel: 'Unknown',
                    allianceEvents: { count: 0, averageRanking: 0 },
                    nonAllianceEvents: { count: 0, averageRanking: 0 },
                    eventDetails: []
                };
            }
            
            // Performance trends
            const firstHalf = rankings.slice(0, Math.ceil(rankings.length / 2));
            const secondHalf = rankings.slice(Math.ceil(rankings.length / 2));
            
            const firstHalfAvg = firstHalf.length > 0 ? 
                firstHalf.reduce((sum, r) => sum + (r.ranking || 0), 0) / firstHalf.length : 0;
            const secondHalfAvg = secondHalf.length > 0 ? 
                secondHalf.reduce((sum, r) => sum + (r.ranking || 0), 0) / secondHalf.length : 0;
            
            const isImproving = secondHalfAvg < firstHalfAvg;
            
            // Create performance summary
            const performance = {
                player: playerName,
                totalAppearances: totalAppearances,
                totalPoints: Math.round(totalPoints),
                averagePoints: Math.round(avgPoints * 100) / 100,
                highestScore: highestScore,
                lowestScore: lowestScore,
                averageRanking: Math.round(avgRanking * 100) / 100,
                bestRanking: bestRanking,
                worstRanking: worstRanking,
                top10Count: top10Count,
                top10Percentage: Math.round((top10Count / totalAppearances) * 100),
                bottom20Count: bottom20Count,
                top25Percentage: Math.round((top25Count / totalAppearances) * 100),
                recentPerformance: Math.round(recentAvgRanking * 100) / 100,
                specialEventAppearances: specialEventCount,
                specialEventsAnalysis: specialEventsAnalysis,
                performanceTrend: isImproving ? 'Improving' : 'Declining',
                trendIndicator: isImproving ? '📈' : '📉',
                consistency: this.calculateConsistencyScore(rankings),
                lastAppearance: sortedRankings[0]?.day || null,
                firstAppearance: sortedRankings[sortedRankings.length - 1]?.day || null
            };
            
            console.log('Player performance metrics calculated:', performance);
            return performance;
            
        } catch (error) {
            console.error('Error calculating player performance metrics:', error);
            throw new Error(`Failed to calculate performance metrics: ${error.message}`);
        }
    }

    // Analyze player's performance in special events
    async analyzePlayerSpecialEvents(playerName, specialEventRankings) {
        try {
            if (specialEventRankings.length === 0) {
                return {
                    totalEvents: 0,
                    averageRanking: 0,
                    bestRanking: 0,
                    worstRanking: 0,
                    top10Events: 0,
                    top25Events: 0,
                    eventDetails: [],
                    performanceLevel: 'No Events'
                };
            }

            // Get special events details from the database
            const eventKeys = specialEventRankings.map(r => r.day);
            const { data: specialEvents, error } = await this.supabase
                .from('special_events')
                .select('*')
                .in('key', eventKeys);

            if (error) {
                console.error('Error fetching special events details:', error);
                return {
                    totalEvents: specialEventRankings.length,
                    averageRanking: 0,
                    bestRanking: 0,
                    worstRanking: 0,
                    top10Events: 0,
                    top25Events: 0,
                    eventDetails: [],
                    performanceLevel: 'Unknown'
                };
            }

            // Create event details with rankings
            const eventDetails = specialEventRankings.map(ranking => {
                const event = specialEvents.find(e => e.key === ranking.day);
                return {
                    eventName: event ? event.name : ranking.day,
                    eventDate: event ? event.start_date : 'Unknown',
                    ranking: ranking.ranking,
                    points: ranking.points,
                    isAllianceEvent: event ? event.name.toLowerCase().includes('alliance') || event.name.toLowerCase().includes('contribution') : false
                };
            });

            // Calculate metrics
            const rankings = specialEventRankings.map(r => r.ranking);
            const averageRanking = rankings.reduce((sum, r) => sum + r, 0) / rankings.length;
            const bestRanking = Math.min(...rankings);
            const worstRanking = Math.max(...rankings);
            const top10Events = rankings.filter(r => r <= 10).length;
            const top25Events = rankings.filter(r => r <= 25).length;

            // Determine performance level
            let performanceLevel = 'Average';
            if (averageRanking <= 10) {
                performanceLevel = 'Excellent';
            } else if (averageRanking <= 20) {
                performanceLevel = 'Good';
            } else if (averageRanking <= 35) {
                performanceLevel = 'Average';
            } else {
                performanceLevel = 'Needs Improvement';
            }

            // Separate alliance vs non-alliance events
            const allianceEvents = eventDetails.filter(e => e.isAllianceEvent);
            const nonAllianceEvents = eventDetails.filter(e => !e.isAllianceEvent);

            const result = {
                totalEvents: specialEventRankings.length,
                averageRanking: Math.round(averageRanking * 100) / 100,
                bestRanking: bestRanking,
                worstRanking: worstRanking,
                top10Events: top10Events,
                top25Events: top25Events,
                top10Percentage: Math.round((top10Events / specialEventRankings.length) * 100),
                top25Percentage: Math.round((top25Events / specialEventRankings.length) * 100),
                performanceLevel: performanceLevel,
                allianceEvents: {
                    count: allianceEvents.length,
                    averageRanking: allianceEvents.length > 0 ? 
                        Math.round((allianceEvents.reduce((sum, e) => sum + e.ranking, 0) / allianceEvents.length) * 100) / 100 : 0
                },
                nonAllianceEvents: {
                    count: nonAllianceEvents.length,
                    averageRanking: nonAllianceEvents.length > 0 ? 
                        Math.round((nonAllianceEvents.reduce((sum, e) => sum + e.ranking, 0) / nonAllianceEvents.length) * 100) / 100 : 0
                },
                eventDetails: eventDetails.sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate))
            };

            console.log('Special events analysis result:', result);
            return result;
        } catch (error) {
            console.error('Error analyzing special events:', error);
            return {
                totalEvents: specialEventRankings.length,
                averageRanking: 0,
                bestRanking: 0,
                worstRanking: 0,
                top10Events: 0,
                top25Events: 0,
                eventDetails: [],
                performanceLevel: 'Error'
            };
        }
    }

    // Get emoji for performance level
    getPerformanceLevelEmoji(level) {
        switch (level) {
            case 'Excellent': return '🌟';
            case 'Good': return '👍';
            case 'Average': return '📊';
            case 'Needs Improvement': return '📈';
            case 'No Events': return '❌';
            default: return '❓';
        }
    }

    // Handle player name input with autocomplete
    async handlePlayerNameInput() {
        const playerName = document.getElementById('playerName');
        if (!playerName) return;
        
        const inputValue = playerName.value.trim();
        
        // Show suggestions if there's input
        if (inputValue.length > 0) {
            await this.updatePlayerSuggestions(inputValue);
        } else {
            this.hidePlayerSuggestions();
        }
        
        // Generate report if there's a valid name
        if (inputValue.length >= 2) {
            this.generateReport();
        }
    }

    // Show player name suggestions
    showPlayerSuggestions() {
        const suggestions = document.getElementById('playerNameSuggestions');
        if (suggestions) {
            suggestions.style.display = 'block';
        }
    }

    // Hide player name suggestions
    hidePlayerSuggestions() {
        const suggestions = document.getElementById('playerNameSuggestions');
        if (suggestions) {
            suggestions.style.display = 'none';
        }
    }

    // Handle keyboard navigation for player name autocomplete
    handlePlayerNameKeydown(e) {
        const suggestions = document.getElementById('playerNameSuggestions');
        if (!suggestions || suggestions.style.display === 'none') return;
        
        const suggestionElements = suggestions.querySelectorAll('.autocomplete-suggestion');
        if (suggestionElements.length === 0) return;
        
        const currentSelected = suggestions.querySelector('.autocomplete-suggestion.selected');
        let nextSelected = null;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (!currentSelected) {
                    nextSelected = suggestionElements[0];
                } else {
                    const currentIndex = Array.from(suggestionElements).indexOf(currentSelected);
                    nextSelected = suggestionElements[(currentIndex + 1) % suggestionElements.length];
                }
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                if (!currentSelected) {
                    nextSelected = suggestionElements[suggestionElements.length - 1];
                } else {
                    const currentIndex = Array.from(suggestionElements).indexOf(currentSelected);
                    nextSelected = suggestionElements[currentIndex === 0 ? suggestionElements.length - 1 : currentIndex - 1];
                }
                break;
                
            case 'Enter':
                e.preventDefault();
                if (currentSelected) {
                    const playerNameInput = document.getElementById('playerName');
                    if (playerNameInput) {
                        playerNameInput.value = currentSelected.dataset.value;
                        this.hidePlayerSuggestions();
                        this.generateReport();
                    }
                }
                return;
                
            case 'Escape':
                e.preventDefault();
                this.hidePlayerSuggestions();
                return;
        }
        
        // Update selection
        if (currentSelected) {
            currentSelected.classList.remove('selected');
        }
        if (nextSelected) {
            nextSelected.classList.add('selected');
        }
    }

    // Update player name suggestions based on input
    async updatePlayerSuggestions(inputValue) {
        try {
            const suggestions = document.getElementById('playerNameSuggestions');
            if (!suggestions) return;
            
            // Get all unique player names from rankings
            const allRankings = await this.rankingManager.getAllRankings();
            if (!Array.isArray(allRankings)) return;
            
            // Extract unique player names and filter by input
            const uniquePlayers = [...new Set(allRankings.map(r => r.commander))];
            const filteredPlayers = uniquePlayers
                .filter(name => name.toLowerCase().includes(inputValue.toLowerCase()))
                .sort((a, b) => {
                    // Prioritize exact matches and names that start with input
                    const aStartsWith = a.toLowerCase().startsWith(inputValue.toLowerCase());
                    const bStartsWith = b.toLowerCase().startsWith(inputValue.toLowerCase());
                    
                    if (aStartsWith && !bStartsWith) return -1;
                    if (!aStartsWith && bStartsWith) return 1;
                    
                    // Then sort alphabetically
                    return a.toLowerCase().localeCompare(b.toLowerCase());
                })
                .slice(0, 10); // Limit to 10 suggestions
            
            // Update suggestions
            if (filteredPlayers.length > 0) {
                suggestions.innerHTML = filteredPlayers
                    .map(name => `<div class="autocomplete-suggestion" data-value="${name}">${name}</div>`)
                    .join('');
                
                // Add click event listeners to suggestions
                suggestions.querySelectorAll('.autocomplete-suggestion').forEach(suggestion => {
                    suggestion.addEventListener('click', () => {
                        const playerNameInput = document.getElementById('playerName');
                        if (playerNameInput) {
                            playerNameInput.value = suggestion.dataset.value;
                            this.hidePlayerSuggestions();
                            this.generateReport();
                        }
                    });
                });
                
                suggestions.style.display = 'block';
            } else {
                suggestions.innerHTML = '<div class="autocomplete-suggestion">No players found</div>';
                suggestions.style.display = 'block';
            }
            
        } catch (error) {
            console.error('Error updating player suggestions:', error);
        }
    }

    // Calculate consistency score based on ranking variance
    calculateConsistencyScore(rankings) {
        try {
            const validRankings = rankings.filter(r => r.ranking && !isNaN(r.ranking));
            if (validRankings.length < 2) return 'Insufficient Data';
            
            const avgRanking = validRankings.reduce((sum, r) => sum + r.ranking, 0) / validRankings.length;
            const variance = validRankings.reduce((sum, r) => sum + Math.pow(r.ranking - avgRanking, 2), 0) / validRankings.length;
            const stdDev = Math.sqrt(variance);
            
            // Lower standard deviation = more consistent
            if (stdDev <= 5) return 'Very Consistent';
            if (stdDev <= 10) return 'Consistent';
            if (stdDev <= 15) return 'Moderate';
            if (stdDev <= 20) return 'Variable';
            return 'Highly Variable';
        } catch (error) {
            console.error('Error calculating consistency score:', error);
            return 'Unknown';
        }
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

    clearEditEventForm() {
        const fields = [
            'editEventName',
            'editEventStartDate', 
            'editEventEndDate',
            'editEventCSVFile',
            'editEventRawData'
        ];
        
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = '';
            }
        });
        
        // Reset tab to CSV upload
        const modal = document.getElementById('eventEditModal');
        if (modal) {
            const csvTab = modal.querySelector('.tab-btn[data-tab="edit-csv-upload"]');
            const rawTab = modal.querySelector('.tab-btn[data-tab="edit-raw-data"]');
            const csvContent = modal.querySelector('#edit-csv-upload-tab');
            const rawContent = modal.querySelector('#edit-raw-data-tab');
            
            if (csvTab && rawTab && csvContent && rawContent) {
                csvTab.classList.add('active');
                rawTab.classList.remove('active');
                csvContent.classList.add('active');
                rawContent.classList.remove('active');
            }
        }
    }
}

// Initialize the application when the page loads
window.addEventListener('load', () => {
    window.dailyRankingsApp = new DailyRankingsApp();
});