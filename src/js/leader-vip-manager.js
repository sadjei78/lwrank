import { supabase } from './supabase-client.js';

export class LeaderVIPManager {
    constructor() {
        this.allianceLeaders = [];
        this.trainConductorRotation = [];
        this.vipSelections = {};
        this.isOnline = true;
    }

    async initializeConnection() {
            try {
            // Test if Supabase is available
            const { data, error } = await supabase.from('alliance_leaders').select('count').limit(1);
            if (error) {
                console.warn('Supabase not available for leader system, falling back to localStorage:', error);
                this.isOnline = false;
                this.loadFromStorage();
            } else {
                console.log('Connected to leader system database');
                this.isOnline = true;
                await this.loadFromDatabase();
            }
        } catch (error) {
            console.warn('Leader system connection failed, using localStorage:', error);
            this.isOnline = false;
            this.loadFromStorage();
        }
    }

    async loadFromDatabase() {
        if (!this.isOnline) {
            this.loadFromStorage();
            return;
        }

        try {
            // Load ALL alliance leaders (both active and inactive for proper management)
            const { data: leaders, error: leadersError } = await supabase
                .from('alliance_leaders')
                .select('*')
                .order('player_name');

            if (leadersError) {
                console.error('Error loading alliance leaders:', leadersError);
                this.loadFromStorage();
                return;
            }

            // Load ALL train conductor rotation entries (both active and inactive for proper management)
            const { data: rotation, error: rotationError } = await supabase
                .from('train_conductor_rotation')
                .select('*')
                .order('rotation_order');

            if (rotationError) {
                console.error('Error loading train conductor rotation:', rotationError);
                this.loadFromStorage();
                return;
            }

            // Load ALL VIP selections for frequency calculations
            const { data: vipData, error: vipError } = await supabase
                .from('vip_selections')
                .select('*')
                .order('date', { ascending: false });

            if (vipError) {
                console.error('Error loading VIP selections:', vipError);
                this.loadFromStorage();
                return;
            }

            // Clear existing data before loading new data
            // Clear existing data before loading from database
            this.allianceLeaders = [];
            this.trainConductorRotation = [];
            this.vipSelections = {};
            
            // Load new data
            this.allianceLeaders = leaders || [];
            this.trainConductorRotation = rotation || [];
            
            // Convert VIP data to date_time-keyed object for multiple trains per day
            (vipData || []).forEach(vip => {
                const key = `${vip.date}_${vip.train_time || '04:00:00'}`;
                this.vipSelections[key] = vip;
            });

            console.log('Loaded leader system data:', {
                leaders: this.allianceLeaders.length,
                rotation: this.trainConductorRotation.length,
                vipSelections: Object.keys(this.vipSelections).length
            });
            


            // Save to localStorage as backup
            this.saveToStorage();
        } catch (error) {
            console.error('Database error, falling back to localStorage:', error);
            this.isOnline = false;
            this.loadFromStorage();
        }
    }

    // Sync local data to database
    async syncLocalDataToDatabase() {
        if (!this.isOnline) {
            console.log('Cannot sync: Supabase not available');
            return;
        }

        console.log('Starting local data sync to database...');
        
        try {
            // Sync alliance leaders
            if (this.allianceLeaders.length > 0) {
                console.log(`Syncing ${this.allianceLeaders.length} alliance leaders...`);
                for (const leader of this.allianceLeaders) {
                    const { error } = await supabase
                        .from('alliance_leaders')
                        .upsert({
                            player_name: leader.player_name,
                            is_active: leader.is_active !== undefined ? leader.is_active : true
                        }, { onConflict: 'player_name' });
                    
                    if (error) {
                        console.error(`Error syncing leader ${leader.player_name}:`, error);
                    } else {
                        console.log(`Successfully synced alliance leader: ${leader.player_name} (is_active: ${leader.is_active})`);
                    }
                }
            }

            // Sync train conductor rotation
            if (this.trainConductorRotation.length > 0) {
                console.log(`Syncing ${this.trainConductorRotation.length} rotation entries...`);
                for (const rotation of this.trainConductorRotation) {
                    const { error } = await supabase
                        .from('train_conductor_rotation')
                        .upsert({
                            player_name: rotation.player_name,
                            rotation_order: rotation.rotation_order,
                            is_active: rotation.is_active || true,
                            conductor_name: rotation.conductor_name || null,
                            train_date: rotation.train_date || null,
                            train_time: rotation.train_time || '04:00:00'
                        }, { onConflict: 'rotation_order' });
                    
                    if (error) {
                        console.error(`Error syncing rotation for ${rotation.player_name}:`, error);
                    }
                }
            }

            // Sync VIP selections
            const vipDates = Object.keys(this.vipSelections);
            if (vipDates.length > 0) {
                console.log(`Syncing ${vipDates.length} VIP selections...`);
                for (const date of vipDates) {
                    const vip = this.vipSelections[date];
                    const { error } = await supabase
                        .from('vip_selections')
                        .upsert({
                            date: vip.date,
                            train_conductor: vip.train_conductor,
                            vip_player: vip.vip_player,
                            notes: vip.notes || '',
                            train_time: vip.train_time || '04:00:00'
                        }, { onConflict: 'date,train_time' });
                    
                    if (error) {
                        console.error(`Error syncing VIP for ${date}:`, error);
                    }
                }
            }

            console.log('Local data sync completed successfully!');
            
            // Reload from database to ensure consistency
            await this.loadFromDatabase();
            
        } catch (error) {
            console.error('Error during local data sync:', error);
        }
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('leaderVIPData');
            if (stored) {
                const data = JSON.parse(stored);
                this.allianceLeaders = data.allianceLeaders || [];
                this.trainConductorRotation = data.trainConductorRotation || [];
                this.vipSelections = data.vipSelections || {};
            }
        } catch (error) {
            console.error('Error loading leader system from storage:', error);
            this.allianceLeaders = [];
            this.trainConductorRotation = [];
            this.vipSelections = {};
        }
    }

    saveToStorage() {
        try {
            const data = {
                allianceLeaders: this.allianceLeaders,
                trainConductorRotation: this.trainConductorRotation,
                vipSelections: this.vipSelections
            };
            localStorage.setItem('leaderVIPData', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving leader system to storage:', error);
        }
    }

    async saveToDatabase() {
        if (!this.isOnline) {
            this.saveToStorage();
            return;
        }

        try {
            console.log('Saving leader system to database...');
            
            // Save alliance leaders
            if (this.allianceLeaders.length > 0) {
                console.log(`Saving ${this.allianceLeaders.length} alliance leaders...`);
                for (const leader of this.allianceLeaders) {
                    const { error } = await supabase
                        .from('alliance_leaders')
                        .upsert({
                            player_name: leader.player_name,
                            is_active: leader.is_active !== undefined ? leader.is_active : true
                        }, { onConflict: 'player_name' });
                    
                    if (error) {
                        console.error(`Error saving alliance leader ${leader.player_name}:`, error);
                    } else {
                        console.log(`Successfully saved alliance leader: ${leader.player_name} (is_active: ${leader.is_active})`);
                    }
                }
            }

            // Save train conductor rotation
            if (this.trainConductorRotation.length > 0) {
                console.log(`Saving ${this.trainConductorRotation.length} rotation entries...`);
                for (const rotation of this.trainConductorRotation) {
                    const { error } = await supabase
                        .from('train_conductor_rotation')
                        .upsert({
                            player_name: rotation.player_name,
                            rotation_order: rotation.rotation_order,
                            is_active: rotation.is_active || true,
                            conductor_name: rotation.conductor_name || null,
                            train_date: rotation.train_date || null,
                            train_time: rotation.train_time || '04:00:00'
                        }, { onConflict: 'rotation_order' });
                    
                    if (error) {
                        console.error(`Error saving rotation for ${rotation.player_name}:`, error);
                    } else {
                        console.log(`Successfully saved rotation entry: ${rotation.player_name} (order: ${rotation.rotation_order})`);
                    }
                }
            }

            // Save VIP selections
            for (const [date, vipData] of Object.entries(this.vipSelections)) {
                const { error } = await supabase
                    .from('vip_selections')
                    .upsert({
                        date: vipData.date,
                        train_conductor: vipData.train_conductor,
                        vip_player: vipData.vip_player,
                        notes: vipData.notes || '',
                        train_time: vipData.train_time || '04:00:00'
                    }, { onConflict: 'date,train_time' });
                
                if (error) {
                    console.error('Error saving VIP selection:', error);
                }
            }

            console.log('Successfully saved all leader system data to database');
            console.log('Final state after save:', {
                allianceLeaders: this.allianceLeaders.length,
                trainConductorRotation: this.trainConductorRotation.length,
                vipSelections: Object.keys(this.vipSelections).length
            });
            this.saveToStorage();
        } catch (error) {
            console.error('Database save error:', error);
            this.saveToStorage();
        }
    }

    // Get current train conductor for a specific date (now returns the leader due for rotation)
    getCurrentTrainConductor(date) {
        // Filter to only active rotation entries
        const activeRotation = this.trainConductorRotation.filter(entry => entry.is_active);
        
        if (activeRotation.length === 0) return null;
        
        // Calculate which leader should be conductor based on date
        const startDate = new Date('2024-01-01'); // You can adjust this start date
        const daysDiff = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
        const rotationIndex = daysDiff % activeRotation.length;
        
        return activeRotation[rotationIndex]?.player_name || null;
    }

    // Get the next leader due in rotation (for manual conductor selection)
    getNextLeaderDue() {
        const activeRotation = this.trainConductorRotation.filter(entry => entry.is_active);
        if (activeRotation.length === 0) return null;
        
        // Find the leader with rotation_order = 1 (front of the line)
        return activeRotation.find(entry => entry.rotation_order === 1)?.player_name || null;
    }

    // Check if rotation is paused (leader due is not selected as conductor or VIP)
    isRotationPaused(date) {
        const leaderDue = this.getNextLeaderDue();
        if (!leaderDue) return false;
        
        const dateString = this.formatDateForStorage(date);
        const vipForDate = this.vipSelections[dateString];
        
        // Check if the leader due is selected as conductor or VIP
        if (vipForDate) {
            return !(vipForDate.train_conductor.toLowerCase() === leaderDue.toLowerCase() ||
                    vipForDate.vip_player.toLowerCase() === leaderDue.toLowerCase());
        }
        
        return true; // No VIP entry for this date means rotation is paused
    }

    // Advance rotation (move current leader to back, next leader to front)
    async advanceRotation() {
        const activeRotation = this.trainConductorRotation.filter(entry => entry.is_active);
        if (activeRotation.length === 0) return;
        
        // Move the first leader to the end
        const firstLeader = activeRotation.find(entry => entry.rotation_order === 1);
        if (firstLeader) {
            firstLeader.rotation_order = activeRotation.length;
            
            // Move all other leaders up by one
            activeRotation.forEach(entry => {
                if (entry.rotation_order > 1) {
                    entry.rotation_order -= 1;
                }
            });
            
            await this.saveToDatabase();
        }
    }

    // Get VIP for a specific date (returns all trains for that date)
    getVIPForDate(date) {
        const dateString = date.toISOString().split('T')[0];
        const trains = [];
        
        // Find all trains for this date
        for (const [key, vipData] of Object.entries(this.vipSelections)) {
            if (vipData.date === dateString) {
                trains.push(vipData);
            }
        }
        
        // Sort by train time
        trains.sort((a, b) => a.train_time.localeCompare(b.train_time));
        
        return trains.length > 0 ? trains : null;
    }

    // Check if a player is an active alliance leader
    isAllianceLeader(playerName) {
        return this.allianceLeaders.some(leader => 
            leader.player_name.toLowerCase() === playerName.toLowerCase() && leader.is_active
        );
    }

    // Check if a player is VIP for the current week
    isVIPForWeek(playerName, date) {
        const weekStart = this.getWeekStart(date);
        const weekEnd = this.getWeekEnd(date);
        
        // Check if any VIP selection exists for this week
        for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
            const vip = this.getVIPForDate(d);
            if (vip && vip.vip_player.toLowerCase() === playerName.toLowerCase()) {
                return true;
            }
        }
        return false;
    }

    // Get week start (Monday)
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        return new Date(d.setDate(diff));
    }

    // Get week end (Sunday)
    getWeekEnd(date) {
        const weekStart = this.getWeekStart(date);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return weekEnd;
    }

    // Set VIP for a specific date with manual conductor selection
    async setVIPForDate(date, conductorName, vipPlayer, trainTime = '04:00:00', notes = '') {
        // Format date as YYYY-MM-DD in local timezone to avoid timezone shift
        const dateString = this.formatDateForStorage(date);
        const timeString = trainTime || '04:00:00';
        const key = `${dateString}_${timeString}`;
        
        this.vipSelections[key] = {
            date: dateString,
            train_conductor: conductorName,
            vip_player: vipPlayer,
            train_time: timeString,
            notes: notes
        };

        await this.saveToDatabase();
        return this.vipSelections[key];
    }

    // Helper function to format date for storage (local timezone)
    formatDateForStorage(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Get the next default date for train assignments (next calendar day from last entry)
    getNextDefaultDate() {
        const vipDates = Object.keys(this.vipSelections);
        if (vipDates.length === 0) {
            // No entries yet, use tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow;
        }
        
        // Find the latest date
        const latestDateString = vipDates.sort((a, b) => b.localeCompare(a))[0];
        const latestDate = this.parseDateString(latestDateString);
        
        // Add one day
        const nextDate = new Date(latestDate);
        nextDate.setDate(latestDate.getDate() + 1);
        
        return nextDate;
    }

    // Get missing dates between last entry and today (for bulk entry)
    getMissingDates() {
        const vipDates = Object.keys(this.vipSelections);
        if (vipDates.length === 0) return [];
        
        const latestDateString = vipDates.sort((a, b) => b.localeCompare(a))[0];
        const latestDate = this.parseDateString(latestDateString);
        const today = new Date();
        
        const missingDates = [];
        const currentDate = new Date(latestDate);
        currentDate.setDate(currentDate.getDate() + 1); // Start from day after latest
        
        while (currentDate <= today) {
            const dateString = this.formatDateForStorage(currentDate);
            // Check if there are any trains for this date
            const hasTrainsForDate = Object.values(this.vipSelections).some(vip => vip.date === dateString);
            if (!hasTrainsForDate) {
                missingDates.push(new Date(currentDate));
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return missingDates;
    }

    // Get recent VIP selections
    getRecentVIPs(limit = 10) {
        return Object.values(this.vipSelections)
            .sort((a, b) => this.compareDates(b.date, a.date))
            .slice(0, limit);
    }



    // Helper function to compare dates without creating Date objects
    compareDates(dateA, dateB) {
        // dateA and dateB are in YYYY-MM-DD format
        // Direct string comparison works for this format
        return dateA.localeCompare(dateB);
    }

    // Add new alliance leader or reactivate existing one
    async addAllianceLeader(playerName) {
        // Check if player is already an active leader
        if (this.isAllianceLeader(playerName)) {
            throw new Error('Player is already an active alliance leader');
        }
        
        // Check if player was previously a leader (inactive)
        const existingInactiveLeader = this.allianceLeaders.find(
            l => l.player_name.toLowerCase() === playerName.toLowerCase() && !l.is_active
        );
        
        if (existingInactiveLeader) {
            // Reactivate existing leader
            existingInactiveLeader.is_active = true;
            
            // Check if they have a rotation entry
            const existingRotationEntry = this.trainConductorRotation.find(
                r => r.player_name.toLowerCase() === playerName.toLowerCase()
            );
            
            if (existingRotationEntry) {
                // Reactivate rotation entry
                existingRotationEntry.is_active = true;
            } else {
                // Add to rotation at the end
                const newRotationEntry = {
                    player_name: playerName,
                    rotation_order: this.trainConductorRotation.length + 1,
                    is_active: true
                };
                this.trainConductorRotation.push(newRotationEntry);
            }
            
            await this.saveToDatabase();
            return existingInactiveLeader;
        } else {
            // Add completely new leader
            const newLeader = {
                player_name: playerName,
                is_active: true
            };

            this.allianceLeaders.push(newLeader);
            
            // Add to rotation at the end
            const newRotationEntry = {
                player_name: playerName,
                rotation_order: this.trainConductorRotation.length + 1,
                is_active: true
            };
            this.trainConductorRotation.push(newRotationEntry);
            
            await this.saveToDatabase();
            return newLeader;
        }
    }

    // Remove alliance leader (soft delete - marks as inactive)
    async removeAllianceLeader(playerName) {
        // Check if this leader has any VIP records as conductor
        const hasVIPRecords = Object.values(this.vipSelections).some(
            vip => vip.train_conductor.toLowerCase() === playerName.toLowerCase()
        );
        
        if (hasVIPRecords) {
            // Soft delete: mark as inactive instead of removing
            const leader = this.allianceLeaders.find(
                l => l.player_name.toLowerCase() === playerName.toLowerCase()
            );
            
            if (leader) {
                leader.is_active = false;
                
                // Also mark rotation entry as inactive
                const rotationEntry = this.trainConductorRotation.find(
                    r => r.player_name.toLowerCase() === playerName.toLowerCase()
                );
                
                if (rotationEntry) {
                    rotationEntry.is_active = false;
                }
                
                await this.saveToDatabase();
                throw new Error(`Cannot remove "${playerName}" - they have VIP records as train conductor. Status marked as inactive instead.`);
            }
        } else {
            // No VIP records, safe to hard delete
            this.allianceLeaders = this.allianceLeaders.filter(
                leader => leader.player_name.toLowerCase() !== playerName.toLowerCase()
            );
            
            // Remove from rotation and reorder
            this.trainConductorRotation = this.trainConductorRotation.filter(
                rotation => rotation.player_name.toLowerCase() !== playerName.toLowerCase()
            );
            
            // Reorder remaining rotation entries
            this.trainConductorRotation.forEach((rotation, index) => {
                rotation.rotation_order = index + 1;
            });
            
            await this.saveToDatabase();
        }
    }

    // Update train conductor rotation
    async updateTrainConductorRotation(rotation) {
        this.trainConductorRotation = rotation;
        await this.saveToDatabase();
    }

    // Remove player from train conductor rotation
    async removeFromTrainConductorRotation(index) {
        if (index < 0 || index >= this.trainConductorRotation.length) {
            throw new Error('Invalid rotation index');
        }
        
        // Remove the player from rotation
        this.trainConductorRotation.splice(index, 1);
        
        // Reorder the remaining rotation entries
        this.trainConductorRotation.forEach((rotation, i) => {
            rotation.rotation_order = i + 1;
        });
        
        await this.saveToDatabase();
    }

    // Delete VIP for a specific date
    async deleteVIPForDate(date, trainTime = null) {
        const dateString = this.formatDateForStorage(date);
        
        if (trainTime) {
            // Delete specific train
            const key = `${dateString}_${trainTime}`;
            if (this.vipSelections[key]) {
                delete this.vipSelections[key];
                await this.saveToDatabase();
            }
        } else {
            // Delete all trains for this date
            const keysToDelete = [];
            for (const [key, vipData] of Object.entries(this.vipSelections)) {
                if (vipData.date === dateString) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => {
                delete this.vipSelections[key];
            });
            
            if (keysToDelete.length > 0) {
                await this.saveToDatabase();
            }
        }
    }

    // Get VIP frequency information for a player (includes both VIP and conductor roles)
    getVIPFrequencyInfo(playerName) {
        
        // Get today's date in YYYY-MM-DD format to avoid timezone issues
        const today = new Date();
        const todayString = today.toISOString().split('T')[0];
        
        // Calculate 30 days ago in YYYY-MM-DD format
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const thirtyDaysAgoString = thirtyDaysAgo.toISOString().split('T')[0];
        
        let lastSelectedDays = null;
        let frequency30Days = 0;
        
        // Get all VIP selections for this player (both as VIP and as conductor)
        const playerRoles = Object.values(this.vipSelections)
            .filter(vip => 
                vip.vip_player.toLowerCase() === playerName.toLowerCase() ||
                vip.train_conductor.toLowerCase() === playerName.toLowerCase()
            )
            .sort((a, b) => this.compareDates(b.date, a.date));
        
        if (playerRoles.length > 0) {
            // Calculate days since last selection using string comparison
            const lastRoleDateString = playerRoles[0].date;
            const daysDiff = this.calculateDaysDifference(lastRoleDateString, todayString);
            lastSelectedDays = daysDiff;
            
            // Count selections in last 30 days using string comparison
            frequency30Days = playerRoles.filter(vip => {
                // Direct string comparison for dates (YYYY-MM-DD format)
                return vip.date >= thirtyDaysAgoString;
            }).length;
        }
        
        return {
            lastSelectedDays,
            frequency30Days
        };
    }

    // Helper function to calculate days difference between two date strings (YYYY-MM-DD format)
    calculateDaysDifference(dateString1, dateString2) {
        // Convert both dates to Date objects for calculation
        const [year1, month1, day1] = dateString1.split('-').map(Number);
        const [year2, month2, day2] = dateString2.split('-').map(Number);
        
        const date1 = new Date(year1, month1 - 1, day1);
        const date2 = new Date(year2, month2 - 1, day2);
        
        // Calculate difference in milliseconds and convert to days
        // date2 is typically "today", date1 is the VIP date
        // We want positive if VIP date is in the past, negative if in the future
        const diffTime = date2.getTime() - date1.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }

    // Refresh VIP data from database
    async refreshVIPData() {
        try {
            console.log('Refreshing VIP data from database...');
            const { data: vipData, error: vipError } = await supabase
                .from('vip_selections')
                .select('*')
                .order('date', { ascending: false });
            
            if (vipError) {
                console.error('Error refreshing VIP data:', vipError);
                return;
            }
            
            // Convert to the expected format with composite keys
            this.vipSelections = {};
            if (vipData) {
                vipData.forEach(vip => {
                    const key = `${vip.date}_${vip.train_time || '04:00:00'}`;
                    this.vipSelections[key] = {
                        vip_player: vip.vip_player,
                        train_conductor: vip.train_conductor,
                        date: vip.date,
                        train_time: vip.train_time || '04:00:00',
                        notes: vip.notes
                    };
                });
            }
            
            console.log(`Refreshed ${Object.keys(this.vipSelections).length} VIP selections`);
        } catch (error) {
            console.error('Error refreshing VIP data:', error);
        }
    }

    // Clear admin-related data to prevent duplication on re-login
    clearAdminData() {
        this.allianceLeaders = [];
        this.trainConductorRotation = [];
        this.vipSelections = {};
    }

    // Helper function to parse date string to Date object
    parseDateString(dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    // Force sync all data to database (useful for debugging)
    async forceSyncToDatabase() {
        console.log('Force syncing all leader system data to database...');
        console.log('Current state before sync:', {
            allianceLeaders: this.allianceLeaders.length,
            trainConductorRotation: this.trainConductorRotation.length,
            vipSelections: Object.keys(this.vipSelections).length
        });
        
        await this.saveToDatabase();
        
        // Also try to reload from database to verify
        console.log('Reloading from database to verify...');
        await this.loadFromDatabase();
        
        console.log('State after reload:', {
            allianceLeaders: this.allianceLeaders.length,
            trainConductorRotation: this.trainConductorRotation.length,
            vipSelections: Object.keys(this.vipSelections).length
        });
    }

    // Update player name across all leader and VIP tables
    async updatePlayerName(oldName, newName) {
        try {
            // 1. Update alliance leaders
            const leader = this.allianceLeaders.find(
                l => l.player_name.toLowerCase() === oldName.toLowerCase()
            );
            if (leader) {
                leader.player_name = newName;
            }

            // 2. Update train conductor rotation
            const rotationEntry = this.trainConductorRotation.find(
                r => r.player_name.toLowerCase() === oldName.toLowerCase()
            );
            if (rotationEntry) {
                rotationEntry.player_name = newName;
            }

            // 3. Update VIP selections where player was conductor
            Object.values(this.vipSelections).forEach(vip => {
                if (vip.train_conductor.toLowerCase() === oldName.toLowerCase()) {
                    vip.train_conductor = newName;
                }
            });

            // 4. Update VIP selections where player was VIP
            Object.values(this.vipSelections).forEach(vip => {
                if (vip.vip_player.toLowerCase() === oldName.toLowerCase()) {
                    vip.vip_player = newName;
                }
            });

            // 5. Save all changes to database
            await this.saveToDatabase();

            return true;
        } catch (error) {
            console.error('Error updating player name in LeaderVIPManager:', error);
            throw new Error(`Failed to update player name in leader and VIP tables: ${error.message}`);
        }
    }
}
