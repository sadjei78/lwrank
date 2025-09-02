import { supabase } from './supabase-client.js';

export class RankingManager {
    constructor() {
        this.rankingsData = {};
        this.isOnline = true;
    }

    async initializeConnection() {
        try {
            // Test if Supabase is available
            const { data, error } = await supabase.from('rankings').select('count').limit(1);
            if (error) {
                console.warn('Supabase not available, falling back to localStorage:', error);
                this.isOnline = false;
                this.loadFromStorage();
            } else {
                console.log('Connected to Supabase database');
                this.isOnline = true;
                await this.loadFromDatabase();
            }
        } catch (error) {
            console.warn('Database connection failed, using localStorage:', error);
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
            console.log('Loading data from Supabase...');
            const { data, error } = await supabase
                .from('rankings')
                .select('*')
                .order('day')
                .order('ranking');

            if (error) {
                console.error('Error loading from database:', error);
                this.loadFromStorage();
                return;
            }

            console.log('Raw data from Supabase:', data);

            // Group rankings by day
            this.rankingsData = {};
            data.forEach(ranking => {
                const dateKey = ranking.day; // Use the day column
                console.log('Processing ranking:', ranking, 'dateKey:', dateKey);
                if (!this.rankingsData[dateKey]) {
                    this.rankingsData[dateKey] = [];
                }
                this.rankingsData[dateKey].push({
                    ranking: ranking.ranking,
                    commander: ranking.commander,
                    points: ranking.points
                });
            });

            console.log('Loaded rankings from database:', Object.keys(this.rankingsData).length, 'days', this.rankingsData);
        } catch (error) {
            console.error('Database error, falling back to localStorage:', error);
            this.isOnline = false;
            this.loadFromStorage();
        }
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('dailyRankingsData');
            this.rankingsData = stored ? JSON.parse(stored) : {};
            console.log('Loaded rankings from localStorage');
        } catch (error) {
            console.error('Error loading data from storage:', error);
            this.rankingsData = {};
        }
    }

    async saveToDatabase() {
        if (!this.isOnline) {
            this.saveToStorage();
            return;
        }

        try {
            console.log('Saved rankings to database');
            // Also save to localStorage as backup
            this.saveToStorage();
        } catch (error) {
            console.error('Database save error:', error);
            this.saveToStorage();
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('dailyRankingsData', JSON.stringify(this.rankingsData));
        } catch (error) {
            console.error('Error saving data to storage:', error);
        }
    }

    async getAllRankings() {
        // Convert the nested rankingsData object to a flat array
        const allRankings = [];
        
        for (const dateKey in this.rankingsData) {
            if (this.rankingsData.hasOwnProperty(dateKey)) {
                const dayRankings = this.rankingsData[dateKey];
                if (Array.isArray(dayRankings)) {
                    // Add day information to each ranking
                    dayRankings.forEach(ranking => {
                        allRankings.push({
                            ...ranking,
                            day: dateKey
                        });
                    });
                }
            }
        }
        
        console.log('getAllRankings returning:', allRankings.length, 'rankings');
        return allRankings;
    }

    async getRankingsForDate(dateKey) {
        console.log('Getting rankings for dateKey:', dateKey);
        console.log('Current rankingsData:', this.rankingsData);
        console.log('Available dates:', Object.keys(this.rankingsData));
        
        if (!this.isOnline) {
            console.log('Offline mode, returning from local data');
            return this.rankingsData[dateKey] || [];
        }

        try {
            console.log('Fetching from database for date:', dateKey);
            const { data, error } = await supabase
                .from('rankings')
                .select('*')
                .eq('day', dateKey)
                .order('ranking');

            if (error) {
                console.error('Error loading rankings for date:', error);
                // Fall back to offline mode on database error
                this.isOnline = false;
                return this.rankingsData[dateKey] || [];
            }

            console.log('Database returned for', dateKey, ':', data);
            return data.map(ranking => ({
                ranking: ranking.ranking,
                commander: ranking.commander,
                points: ranking.points
            }));
        } catch (error) {
            console.error('Database error:', error);
            // Switch to offline mode on network/fetch errors
            this.isOnline = false;
            console.log('Switched to offline mode due to network error');
            return this.rankingsData[dateKey] || [];
        }
    }

    async setRankingsForDate(dateKey, rankings) {
        const sortedRankings = [...rankings].sort((a, b) => a.ranking - b.ranking);
        this.rankingsData[dateKey] = sortedRankings;
        
        console.log(`Setting ${sortedRankings.length} rankings for date ${dateKey}`);
        
        // Save to database if online
        if (this.isOnline) {
            try {
                // First, delete existing rankings for this date
                console.log(`Deleting existing rankings for ${dateKey}`);
                const { error: deleteError } = await supabase
                    .from('rankings')
                    .delete()
                    .eq('day', dateKey);

                if (deleteError) {
                    console.error('Error deleting existing rankings:', deleteError);
                    this.isOnline = false;
                    this.saveToStorage();
                    return;
                }

                // Insert new rankings for this date
                const rankingsToInsert = sortedRankings.map(ranking => ({
                    day: dateKey,
                    ranking: ranking.ranking,
                    commander: ranking.commander,
                    points: ranking.points
                }));

                console.log('Inserting rankings:', rankingsToInsert);
                const { error: insertError } = await supabase
                    .from('rankings')
                    .insert(rankingsToInsert);

                if (insertError) {
                    console.error('Error inserting rankings:', insertError);
                    this.isOnline = false;
                } else {
                    console.log(`Successfully saved ${sortedRankings.length} rankings for ${dateKey}`);
                }
            } catch (error) {
                console.error('Database save error:', error);
                this.isOnline = false;
            }
        }
        
        // Always save to localStorage as backup
        this.saveToStorage();
    }

    hasDataForDate(dateKey) {
        return this.rankingsData.hasOwnProperty(dateKey);
    }

    async initializeDate(dateKey) {
        if (!this.hasDataForDate(dateKey)) {
            this.rankingsData[dateKey] = [];
            await this.saveToDatabase();
        }
    }

    removeDuplicateRankings(rankings) {
        const rankMap = new Map();
        
        rankings.forEach(rank => {
            const existing = rankMap.get(rank.ranking);
            if (!existing || parseFloat(rank.points.replace(/,/g, '')) > parseFloat(existing.points.replace(/,/g, ''))) {
                rankMap.set(rank.ranking, rank);
            }
        });
        
        return Array.from(rankMap.values());
    }

    getDatesWithData() {
        return Object.keys(this.rankingsData).filter(dateKey => 
            this.rankingsData[dateKey] && this.rankingsData[dateKey].length > 0
        );
    }

    getTotalRankingsCount() {
        return Object.values(this.rankingsData).reduce((total, dateRankings) => 
            total + (dateRankings ? dateRankings.length : 0), 0
        );
    }

    async clearDate(dateKey) {
        if (this.hasDataForDate(dateKey)) {
            this.rankingsData[dateKey] = [];
            await this.saveToDatabase();
        }
    }

    exportDateAsCSV(dateKey) {
        const rankings = this.rankingsData[dateKey] || [];
        if (rankings.length === 0) {
            return null;
        }

        const headers = ['Ranking', 'Commander', 'Points'];
        const csvContent = [
            headers.join(','),
            ...rankings.map(rank => 
                `${rank.ranking},"${rank.commander}","${rank.points}"`
            )
        ].join('\n');

        return csvContent;
    }

    async clearAllData() {
        this.rankingsData = {};
        await this.saveToDatabase();
    }

    async getConnectionStatus() {
        try {
            // Add a small delay to ensure Supabase is fully initialized
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Test actual Supabase connection
            console.log('Testing Supabase connection in ranking manager...');
            const { data, error } = await supabase.from('rankings').select('count').limit(1);
            
            if (error) {
                console.log('Connection test failed:', error);
                this.isOnline = false;
                return {
                    isOnline: false,
                    status: `Offline (${error.message || 'Connection Failed'})`
                };
            } else {
                console.log('Connection test successful, data:', data);
                this.isOnline = true;
                return {
                    isOnline: true,
                    status: 'Connected'
                };
            }
        } catch (error) {
            console.log('Connection test error:', error);
            this.isOnline = false;
            return {
                isOnline: false,
                status: `Offline (${error.message || 'Error'})`
            };
        }
    }

    // New methods for weekly statistics
    async getWeeklyTop10Occurrences(weekDates) {
        const top10Occurrences = {};
        
        console.log('Calculating weekly top 10 occurrences for dates:', weekDates);
        
        // Count top 10 occurrences for each day in the selected week
        for (const dateKey of weekDates) {
            const dailyRankings = this.rankingsData[dateKey] || [];
            console.log(`Processing ${dateKey}:`, dailyRankings.length, 'rankings');
            
            // Get top 10 for this specific day
            const top10ForDay = dailyRankings.slice(0, 10);
            
            // Count occurrences in top 10 for this day
            top10ForDay.forEach(ranking => {
                const commander = ranking.commander;
                top10Occurrences[commander] = (top10Occurrences[commander] || 0) + 1;
            });
        }
        
        // Include special events if toggle is enabled
        if (this.shouldIncludeSpecialEvents()) {
            console.log('Including special events in top 10 calculations...');
            for (const dateKey of weekDates) {
                const specialEventRankings = await this.getSpecialEventRankingsForDate(dateKey);
                
                // Get top 10 for special events on this day
                const top10SpecialForDay = specialEventRankings.slice(0, 10);
                
                // Count occurrences in top 10 for special events (but only if no daily data for this date)
                top10SpecialForDay.forEach(ranking => {
                    const commander = ranking.commander;
                    // Only count if this player doesn't already have daily data for this date
                    const hasDailyData = this.rankingsData[dateKey]?.some(dailyRank => dailyRank.commander === commander);
                    if (!hasDailyData) {
                        top10Occurrences[commander] = (top10Occurrences[commander] || 0) + 1;
                    }
                });
            }
        } else {
            console.log('Special events excluded from top 10 calculations (toggle is OFF)');
        }
        
        console.log('Top 10 occurrences:', top10Occurrences);
        
        // Only return players who appear 2 or more times
        const filteredTop10Occurrences = {};
        Object.entries(top10Occurrences).forEach(([commander, count]) => {
            if (count >= 2) {
                filteredTop10Occurrences[commander] = count;
            }
        });
        
        console.log('Filtered top 10 occurrences (2+ times):', filteredTop10Occurrences);
        return filteredTop10Occurrences;
    }

    async getWeeklyBottom20Occurrences(weekDates) {
        const bottom20Occurrences = {};
        
        console.log('Calculating weekly bottom 20 occurrences for dates:', weekDates);
        
        // Count bottom 20 occurrences for each day in the selected week
        for (const dateKey of weekDates) {
            const dailyRankings = this.rankingsData[dateKey] || [];
            console.log(`Processing ${dateKey}:`, dailyRankings.length, 'rankings');
            
            // Get bottom 20 for this specific day (ranks 11-30)
            const bottom20ForDay = dailyRankings.filter(ranking => ranking.ranking > 10 && ranking.ranking <= 30);
            
            // Count occurrences in bottom 20 for this day
            bottom20ForDay.forEach(ranking => {
                const commander = ranking.commander;
                bottom20Occurrences[commander] = (bottom20Occurrences[commander] || 0) + 1;
            });
        }
        
        // Include special events if toggle is enabled
        if (this.shouldIncludeSpecialEvents()) {
            console.log('Including special events in bottom 20 calculations...');
            for (const dateKey of weekDates) {
                const specialEventRankings = await this.getSpecialEventRankingsForDate(dateKey);
                
                // Get bottom 20 for special events on this day (ranks 11-30)
                const bottom20SpecialForDay = specialEventRankings.filter(ranking => ranking.ranking > 10 && ranking.ranking <= 30);
                
                // Count occurrences in bottom 20 for special events (but only if no daily data for this date)
                bottom20SpecialForDay.forEach(ranking => {
                    const commander = ranking.commander;
                    // Only count if this player doesn't already have daily data for this date
                    const hasDailyData = this.rankingsData[dateKey]?.some(dailyRank => dailyRank.commander === commander);
                    if (!hasDailyData) {
                        bottom20Occurrences[commander] = (bottom20Occurrences[commander] || 0) + 1;
                    }
                });
            }
        } else {
            console.log('Special events excluded from bottom 20 calculations (toggle is OFF)');
        }
        
        console.log('Bottom 20 occurrences:', bottom20Occurrences);
        
        // Only return players who appear 2 or more times
        const filteredBottom20Occurrences = {};
        Object.entries(bottom20Occurrences).forEach(([commander, count]) => {
            if (count >= 2) {
                filteredBottom20Occurrences[commander] = count;
            }
        });
        
        console.log('Filtered bottom 20 occurrences (2+ times):', filteredBottom20Occurrences);
        return filteredBottom20Occurrences;
    }

    async getWeeklyCumulativeScores(weekDates) {
        const cumulativeScores = {};
        
        console.log('Calculating weekly cumulative scores for dates:', weekDates);
        
        // Calculate cumulative scores from daily data (one score per player per day)
        for (const dateKey of weekDates) {
            const dailyRankings = this.rankingsData[dateKey] || [];
            console.log(`Processing ${dateKey}:`, dailyRankings.length, 'rankings');
            
            // For each day, only count the highest ranking (lowest rank number) for each player
            const playerBestRanking = {};
            dailyRankings.forEach(ranking => {
                const commander = ranking.commander;
                if (!playerBestRanking[commander] || ranking.ranking < playerBestRanking[commander].ranking) {
                    playerBestRanking[commander] = ranking;
                }
            });
            
            // Add the best ranking for each player to cumulative scores
            Object.values(playerBestRanking).forEach(ranking => {
                const commander = ranking.commander;
                const currentScore = cumulativeScores[commander] || 0;
                const pointsToAdd = parseInt(ranking.points) || 0;
                cumulativeScores[commander] = currentScore + pointsToAdd;
                console.log(`  ${commander}: +${pointsToAdd} = ${cumulativeScores[commander]}`);
            });
        }
        
        // Include special events if toggle is enabled
        if (this.shouldIncludeSpecialEvents()) {
            console.log('Including special events in cumulative scores...');
            for (const dateKey of weekDates) {
                const specialEventRankings = await this.getSpecialEventRankingsForDate(dateKey);
                
                // For special events, also only count the best ranking per player per day
                const playerBestSpecialRanking = {};
                specialEventRankings.forEach(ranking => {
                    const commander = ranking.commander;
                    if (!playerBestSpecialRanking[commander] || ranking.ranking < playerBestSpecialRanking[commander].ranking) {
                        playerBestSpecialRanking[commander] = ranking;
                    }
                });
                
                // Add special event scores to cumulative (but daily data takes precedence)
                Object.values(playerBestSpecialRanking).forEach(ranking => {
                    const commander = ranking.commander;
                    // Only add if this player doesn't already have daily data for this date
                    const hasDailyData = this.rankingsData[dateKey]?.some(dailyRank => dailyRank.commander === commander);
                    if (!hasDailyData) {
                        const currentScore = cumulativeScores[commander] || 0;
                        const pointsToAdd = parseInt(ranking.points) || 0;
                        cumulativeScores[commander] = currentScore + pointsToAdd;
                        console.log(`  Special Event ${commander}: +${pointsToAdd} = ${cumulativeScores[commander]}`);
                    }
                });
            }
        } else {
            console.log('Special events excluded from cumulative scores (toggle is OFF)');
        }
        
        // Return only top 5 players by cumulative score
        const top5Players = Object.entries(cumulativeScores)
            .sort(([,a], [,b]) => b - a) // Sort by score descending
            .slice(0, 5) // Take top 5
            .reduce((acc, [commander, score]) => {
                acc[commander] = score;
                return acc;
            }, {});
        
        console.log('Top 5 cumulative scores:', top5Players);
        return top5Players;
    }

    // Add method to refresh data from database
    async refreshDataFromDatabase() {
        if (!this.isOnline) {
            return;
        }

        try {
            console.log('Refreshing data from database...');
            const { data, error } = await supabase
                .from('rankings')
                .select('*')
                .order('day')
                .order('ranking');

            if (error) {
                console.error('Error refreshing from database:', error);
                return;
            }

            // Update in-memory data
            this.rankingsData = {};
            data.forEach(ranking => {
                const dateKey = ranking.day;
                if (!this.rankingsData[dateKey]) {
                    this.rankingsData[dateKey] = [];
                }
                this.rankingsData[dateKey].push({
                    ranking: ranking.ranking,
                    commander: ranking.commander,
                    points: ranking.points
                });
            });

            console.log('Data refreshed from database:', Object.keys(this.rankingsData).length, 'days');
        } catch (error) {
            console.error('Database refresh error:', error);
        }
    }

    formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Special Event Management
    async createSpecialEvent(eventName, startDate, endDate, eventWeight = 10.0) {
        console.log('rankingManager.createSpecialEvent called with:', { eventName, startDate, endDate, eventWeight });
        
        const eventKey = `event_${eventName.replace(/\s+/g, '_').toLowerCase()}_${startDate}_${endDate}`;
        console.log('Generated event key:', eventKey);
        
        // Store event metadata
        const eventData = {
            name: eventName,
            startDate: startDate,
            endDate: endDate,
            key: eventKey,
            created: new Date().toISOString()
        };
        
        // Try to save to database first (primary storage)
        if (this.isOnline) {
            console.log('Online mode - attempting database save');
            try {
                // Convert to database field names (snake_case)
                const dbEventData = {
                    name: eventName,
                    start_date: startDate,
                    end_date: endDate,
                    key: eventKey,
                    pinned: false, // Default to not pinned
                    event_weight: eventWeight // Add the event weight
                    // Note: created field has DEFAULT now() in database, so we don't need to specify it
                };
                
                console.log('Inserting into database:', dbEventData);
                const { data, error } = await supabase
                    .from('special_events')
                    .insert([dbEventData]);
                
                if (error) {
                    console.error('Database error creating event:', error);
                    console.error('Error details:', {
                        message: error.message,
                        details: error.details,
                        hint: error.hint,
                        code: error.code
                    });
                    // Fall back to localStorage
                    const events = JSON.parse(localStorage.getItem('specialEvents') || '[]');
                    events.push(eventData);
                    localStorage.setItem('specialEvents', JSON.stringify(events));
                    console.log('Saved to localStorage as fallback');
                    return false; // Return false on database error
                } else {
                    console.log('Successfully saved to database:', data);
                    // Successfully saved to database, also save to localStorage as backup
                    const events = JSON.parse(localStorage.getItem('specialEvents') || '[]');
                    events.push(eventData);
                    localStorage.setItem('specialEvents', JSON.stringify(events));
                    console.log('Also saved to localStorage as backup');
                    return true;
                }
            } catch (error) {
                console.error('Exception during database save:', error);
                // Fall back to localStorage
                const events = JSON.parse(localStorage.getItem('specialEvents') || '[]');
                events.push(eventData);
                localStorage.setItem('specialEvents', JSON.stringify(events));
                console.log('Saved to localStorage as fallback after exception');
                return false; // Return false on exception
            }
        } else {
            console.log('Offline mode - using localStorage only');
            // Offline mode - use localStorage
            const events = JSON.parse(localStorage.getItem('specialEvents') || '[]');
            events.push(eventData);
            localStorage.setItem('specialEvents', JSON.stringify(events));
            console.log('Saved to localStorage in offline mode');
            return true;
        }
    }

    async getSpecialEvents() {
        // Try to get from database first (primary storage)
        if (this.isOnline) {
            try {
                const { data, error } = await supabase
                    .from('special_events')
                    .select('*')
                    .order('created', { ascending: false });
                
                if (error) {
                    console.warn('Database error fetching events, using localStorage:', error);
                    return JSON.parse(localStorage.getItem('specialEvents') || '[]');
                }
                
                // Successfully got data from database
                if (data && data.length > 0) {
                    // Convert database field names (snake_case) to camelCase for consistency
                    const convertedData = data.map(event => ({
                        name: event.name,
                        startDate: event.start_date,
                        endDate: event.end_date,
                        key: event.key,
                        pinned: event.pinned || false,
                        created: event.created
                    }));
                    
                    // Also update localStorage as backup
                    localStorage.setItem('specialEvents', JSON.stringify(convertedData));
                    return convertedData;
                }
            } catch (error) {
                console.warn('Database error fetching events, using localStorage:', error);
                return JSON.parse(localStorage.getItem('specialEvents') || '[]');
            }
        }
        
        // Fall back to localStorage
        return JSON.parse(localStorage.getItem('specialEvents') || '[]');
    }

    // Player Name Management
    async updatePlayerName(oldName, newName) {
        if (!oldName || !newName || oldName.trim() === '' || newName.trim() === '') {
            return false;
        }
        
        let updatedCount = 0;
        
        // Update in memory
        Object.keys(this.rankingsData).forEach(dateKey => {
            const rankings = this.rankingsData[dateKey];
            rankings.forEach(ranking => {
                if (ranking.commander === oldName) {
                    ranking.commander = newName;
                    updatedCount++;
                }
            });
        });
        
        // Update in database
        if (this.isOnline) {
            try {
                const { error } = await supabase
                    .from('rankings')
                    .update({ commander: newName })
                    .eq('commander', oldName);
                
                if (error) {
                    console.error('Error updating player name in database:', error);
                    return false;
                }
            } catch (error) {
                console.error('Database error updating player name:', error);
                return false;
            }
        }
        
        // Save to localStorage
        this.saveToStorage();
        
        console.log(`Updated ${updatedCount} records for player name change: ${oldName} → ${newName}`);
        return updatedCount > 0;
    }

    // Update player name in special events
    async updatePlayerNameInSpecialEvents(oldName, newName) {
        try {
            // Get all special events
            const events = await this.getSpecialEvents();
            let updatedCount = 0;
            
            // Update player names in special event rankings
            for (const event of events) {
                const eventRankings = await this.getRankingsForSpecialEvent(event.key);
                let eventUpdated = false;
                
                eventRankings.forEach(ranking => {
                    if (ranking.commander === oldName) {
                        ranking.commander = newName;
                        eventUpdated = true;
                        updatedCount++;
                    }
                });
                
                // Save updated event rankings if changes were made
                if (eventUpdated) {
                    await this.setRankingsForSpecialEvent(event.key, eventRankings);
                }
            }
            
            console.log(`Updated ${updatedCount} special event records for player name change: ${oldName} → ${newName}`);
            return updatedCount > 0;
        } catch (error) {
            console.error('Error updating player name in special events:', error);
            return false;
        }
    }

    // Special Event Data Management
    async getRankingsForSpecialEvent(eventKey) {
        try {
            // First try to get from localStorage
            const localData = JSON.parse(localStorage.getItem(`event_${eventKey}`) || '[]');
            
            // If we have local data, return it
            if (localData && localData.length > 0) {
                return localData;
            }
            
            // If no local data and we're online, try to get from database
            if (this.isOnline) {
                const { data, error } = await supabase
                    .from('rankings')
                    .select('*')
                    .eq('day', eventKey)
                    .order('ranking', { ascending: true });
                
                if (error) {
                    console.error('Error fetching special event rankings from database:', error);
                    return [];
                }
                
                // Cache the data in localStorage for future use
                if (data && data.length > 0) {
                    localStorage.setItem(`event_${eventKey}`, JSON.stringify(data));
                }
                
                return data || [];
            }
            
            return [];
        } catch (error) {
            console.error('Error getting special event rankings:', error);
            return [];
        }
    }

    async setRankingsForSpecialEvent(eventKey, rankings) {
        const sortedRankings = [...rankings].sort((a, b) => a.ranking - b.ranking);
        
        // Store in localStorage
        localStorage.setItem(`event_${eventKey}`, JSON.stringify(sortedRankings));
        
        console.log(`Saved ${sortedRankings.length} rankings for special event: ${eventKey}`);
        return true;
    }

    // Get all special events that fall within a date range
    async getSpecialEventsInRange(startDate, endDate) {
        const events = await this.getSpecialEvents();
        return events.filter(event => {
            const eventStart = new Date(event.startDate);
            const eventEnd = new Date(event.endDate);
            const rangeStart = new Date(startDate);
            const rangeEnd = new Date(endDate);
            
            // Check if event overlaps with the date range
            return eventStart <= rangeEnd && eventEnd >= rangeStart;
        });
    }

    // Get all special event rankings for a date range
    async getSpecialEventRankingsInRange(startDate, endDate) {
        const eventsInRange = await this.getSpecialEventsInRange(startDate, endDate);
        const allRankings = [];
        
        for (const event of eventsInRange) {
            const eventRankings = await this.getRankingsForSpecialEvent(event.key);
            allRankings.push(...eventRankings);
        }
        
        return allRankings;
    }

    // Get special event rankings for a specific date (for cumulative calculations)
    async getSpecialEventRankingsForDate(targetDate) {
        const events = await this.getSpecialEvents();
        const allRankings = [];
        
        for (const event of events) {
            const eventStart = new Date(event.startDate);
            const eventEnd = new Date(event.endDate);
            const target = new Date(targetDate);
            
            // Only include if the target date falls within the event period
            if (target >= eventStart && target <= eventEnd) {
                const eventRankings = await this.getRankingsForSpecialEvent(event.key);
                allRankings.push(...eventRankings);
            }
        }
        
        return allRankings;
    }

    // Check if special events should be included in weekly calculations
    shouldIncludeSpecialEvents() {
        const checkbox = document.getElementById('includeSpecialEvents');
        return checkbox ? checkbox.checked : true; // Default to true if checkbox not found
    }

    // Update special event details
    async updateSpecialEvent(eventKey, updates) {
        try {
            if (this.isOnline) {
                // Update in database
                const updateData = {
                    name: updates.name,
                    start_date: updates.start_date,
                    end_date: updates.end_date,
                    updated_at: new Date().toISOString()
                };
                
                // Add event_weight if provided
                if (updates.event_weight !== undefined) {
                    updateData.event_weight = updates.event_weight;
                }
                
                const { error } = await supabase
                    .from('special_events')
                    .update(updateData)
                    .eq('key', eventKey);
                
                if (error) {
                    console.error('Database error updating special event:', error);
                    throw new Error(`Database error: ${error.message}`);
                }
            }
            
            // Update in localStorage as backup
            const events = JSON.parse(localStorage.getItem('specialEvents') || '[]');
            const eventIndex = events.findIndex(e => e.key === eventKey);
            
            if (eventIndex !== -1) {
                events[eventIndex] = {
                    ...events[eventIndex],
                    ...updates,
                    updated_at: new Date().toISOString()
                };
                localStorage.setItem('specialEvents', JSON.stringify(events));
            }
            
            console.log(`Updated special event: ${eventKey}`);
            return true;
            
        } catch (error) {
            console.error('Error updating special event:', error);
            throw error;
        }
    }

    // Delete special event and its rankings
    async deleteSpecialEvent(eventKey) {
        try {
            if (this.isOnline) {
                // First, delete all related ranking records from the database
                const { error: rankingsError } = await supabase
                    .from('rankings')
                    .delete()
                    .eq('day', eventKey);
                
                if (rankingsError) {
                    console.error('Database error deleting special event rankings:', rankingsError);
                    throw new Error(`Database error deleting rankings: ${rankingsError.message}`);
                }
                
                // Then delete the special event record
                const { error: eventError } = await supabase
                    .from('special_events')
                    .delete()
                    .eq('key', eventKey);
                
                if (eventError) {
                    console.error('Database error deleting special event:', eventError);
                    throw new Error(`Database error: ${eventError.message}`);
                }
                
                console.log(`Deleted special event and all related rankings: ${eventKey}`);
            }
            
            // Remove from localStorage
            const events = JSON.parse(localStorage.getItem('specialEvents') || '[]');
            const filteredEvents = events.filter(e => e.key !== eventKey);
            localStorage.setItem('specialEvents', JSON.stringify(filteredEvents));
            
            // Remove event rankings from localStorage
            localStorage.removeItem(`event_${eventKey}`);
            
            // Also remove from rankingsData if it exists
            if (this.rankingsData[eventKey]) {
                delete this.rankingsData[eventKey];
                this.saveToStorage();
            }
            
            console.log(`Deleted special event: ${eventKey}`);
            return true;
            
        } catch (error) {
            console.error('Error deleting special event:', error);
            throw error;
        }
    }

    async saveSpecialEventRankings(rankings) {
        try {
            if (this.isOnline) {
                // For special events, we need to handle upserts (update existing, insert new)
                if (rankings.length > 0) {
                    const eventKey = rankings[0].day; // All rankings should have the same day field
                    
                    console.log(`Processing ${rankings.length} rankings for event: ${eventKey}`);
                    console.log('Sample ranking:', rankings[0]);
                    
                    // Check for duplicate ranking values within the same event
                    const rankingValues = rankings.map(r => r.ranking);
                    const uniqueRankings = [...new Set(rankingValues)];
                    if (uniqueRankings.length !== rankingValues.length) {
                        console.warn('Duplicate ranking values detected:', rankingValues);
                        // Remove duplicates by keeping only the first occurrence
                        const seen = new Set();
                        const deduplicatedRankings = rankings.filter(ranking => {
                            const key = `${ranking.day}_${ranking.ranking}`;
                            if (seen.has(key)) {
                                console.warn(`Removing duplicate ranking: ${ranking.ranking} for ${ranking.commander}`);
                                return false;
                            }
                            seen.add(key);
                            return true;
                        });
                        rankings = deduplicatedRankings;
                        console.log(`After deduplication: ${rankings.length} rankings`);
                    }
                    
                    // Delete existing rankings for this event to avoid conflicts
                    console.log(`Deleting existing rankings for event: ${eventKey}`);
                    const { error: deleteError } = await supabase
                        .from('rankings')
                        .delete()
                        .eq('day', eventKey);
                    
                    if (deleteError) {
                        console.error('Error deleting existing rankings:', deleteError);
                        throw deleteError;
                    }
                    
                    console.log('Successfully deleted existing rankings');
                    
                    // Add a small delay to ensure delete operation completes
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                // Now insert the new rankings
                console.log(`Inserting ${rankings.length} new rankings`);
                const { data, error } = await supabase
                    .from('rankings')
                    .insert(rankings);
                    
                if (error) {
                    console.error('Error inserting rankings:', error);
                    throw error;
                }
                
                // Also save to local storage for immediate use
                rankings.forEach(ranking => {
                    const dateKey = ranking.day || ranking.date; // Use day field for special events, date for regular
                    if (!this.rankingsData[dateKey]) {
                        this.rankingsData[dateKey] = [];
                    }
                    this.rankingsData[dateKey].push(ranking);
                });
                
                this.saveToStorage();
                return data;
            } else {
                // Offline mode - save to localStorage only
                rankings.forEach(ranking => {
                    const dateKey = ranking.day || ranking.date; // Use day field for special events, date for regular
                    if (!this.rankingsData[dateKey]) {
                        this.rankingsData[dateKey] = [];
                    }
                    this.rankingsData[dateKey].push(ranking);
                });
                
                this.saveToStorage();
                return rankings;
            }
        } catch (error) {
            console.error('Error saving special event rankings:', error);
            throw error;
        }
    }

    // Removed Players Management
    async addRemovedPlayer(playerName, removedBy, reason = null) {
        try {
            if (this.isOnline) {
                const { data, error } = await supabase
                    .from('removed_players')
                    .insert([{
                        player_name: playerName,
                        removed_by: removedBy,
                        reason: reason
                    }]);
                
                if (error) {
                    console.error('Database error adding removed player:', error);
                    return false;
                }
                
                // Also save to localStorage as backup
                const removedPlayers = JSON.parse(localStorage.getItem('removedPlayers') || '[]');
                removedPlayers.push({
                    playerName: playerName,
                    removedBy: removedBy,
                    reason: reason,
                    removedDate: new Date().toISOString().split('T')[0]
                });
                localStorage.setItem('removedPlayers', JSON.stringify(removedPlayers));
                
                return true;
            } else {
                // Offline mode - save to localStorage only
                const removedPlayers = JSON.parse(localStorage.getItem('removedPlayers') || '[]');
                removedPlayers.push({
                    playerName: playerName,
                    removedBy: removedBy,
                    reason: reason,
                    removedDate: new Date().toISOString().split('T')[0]
                });
                localStorage.setItem('removedPlayers', JSON.stringify(removedPlayers));
                return true;
            }
        } catch (error) {
            console.error('Error adding removed player:', error);
            return false;
        }
    }

    async getRemovedPlayers() {
        try {
            if (this.isOnline) {
                const { data, error } = await supabase
                    .from('removed_players')
                    .select('*')
                    .order('removed_date', { ascending: false });
                
                if (error) {
                    console.warn('Database error fetching removed players, using localStorage:', error);
                    return JSON.parse(localStorage.getItem('removedPlayers') || '[]');
                }
                
                // Convert database format to consistent format
                const convertedData = data.map(player => ({
                    playerName: player.player_name,
                    removedBy: player.removed_by,
                    reason: player.reason,
                    removedDate: player.removed_date
                }));
                
                // Also update localStorage as backup
                localStorage.setItem('removedPlayers', JSON.stringify(convertedData));
                return convertedData;
            }
            
            // Fall back to localStorage
            return JSON.parse(localStorage.getItem('removedPlayers') || '[]');
        } catch (error) {
            console.error('Error getting removed players:', error);
            return JSON.parse(localStorage.getItem('removedPlayers') || '[]');
        }
    }

    async removePlayerFromRemovedList(playerName) {
        try {
            if (this.isOnline) {
                const { error } = await supabase
                    .from('removed_players')
                    .delete()
                    .eq('player_name', playerName);
                
                if (error) {
                    console.error('Database error removing player from removed list:', error);
                    return false;
                }
            }
            
            // Remove from localStorage
            const removedPlayers = JSON.parse(localStorage.getItem('removedPlayers') || '[]');
            const filteredPlayers = removedPlayers.filter(p => p.playerName !== playerName);
            localStorage.setItem('removedPlayers', JSON.stringify(filteredPlayers));
            
            return true;
        } catch (error) {
            console.error('Error removing player from removed list:', error);
            return false;
        }
    }

    isPlayerRemoved(playerName) {
        const removedPlayers = JSON.parse(localStorage.getItem('removedPlayers') || '[]');
        return removedPlayers.some(p => p.playerName === playerName);
    }

    async toggleSpecialEventPinned(eventKey, pinned) {
        try {
            if (this.isOnline) {
                const { error } = await supabase
                    .from('special_events')
                    .update({ pinned: pinned })
                    .eq('key', eventKey);
                
                if (error) {
                    console.error('Database error toggling event pinned status:', error);
                    return false;
                }
            }
            
            // Update localStorage
            const events = JSON.parse(localStorage.getItem('specialEvents') || '[]');
            const eventIndex = events.findIndex(e => e.key === eventKey);
            if (eventIndex !== -1) {
                events[eventIndex].pinned = pinned;
                localStorage.setItem('specialEvents', JSON.stringify(events));
            }
            
            return true;
        } catch (error) {
            console.error('Error toggling event pinned status:', error);
            return false;
        }
    }

    getPinnedSpecialEvents() {
        const events = JSON.parse(localStorage.getItem('specialEvents') || '[]');
        return events.filter(event => event.pinned);
    }
}