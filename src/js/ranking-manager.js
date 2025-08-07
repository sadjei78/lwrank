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

    getAllRankings() {
        return this.rankingsData;
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

        const headers = ['Ranking', 'Commander', 'Clan', 'Points'];
        const csvContent = [
            headers.join(','),
            ...rankings.map(rank => 
                `${rank.ranking},"${rank.commander}","Unknown","${rank.points}"`
            )
        ].join('\n');

        return csvContent;
    }

    async clearAllData() {
        this.rankingsData = {};
        await this.saveToDatabase();
    }

    getConnectionStatus() {
        return {
            isOnline: this.isOnline,
            status: this.isOnline ? 'Connected' : 'Offline (Local Storage)'
        };
    }

    // New methods for weekly statistics
    getWeeklyTop10Occurrences(weekDates) {
        const top10Players = {};
        
        // Collect all players who appear in top 10 for each day
        weekDates.forEach(date => {
            const dateKey = this.formatDateKey(date);
            const rankings = this.rankingsData[dateKey] || [];
            
            // Get top 10 players for this day
            const top10 = rankings.slice(0, 10);
            top10.forEach(ranking => {
                const commander = ranking.commander;
                if (!top10Players[commander]) {
                    top10Players[commander] = 0;
                }
                top10Players[commander]++;
            });
        });
        
        // Return only players who appear in top 10 more than once
        return Object.entries(top10Players)
            .filter(([_, count]) => count > 1)
            .reduce((acc, [commander, count]) => {
                acc[commander] = count;
                return acc;
            }, {});
    }

    getWeeklyCumulativeScores(weekDates) {
        const cumulativeScores = {};
        
        // Calculate cumulative scores for each player across the week
        weekDates.forEach(date => {
            const dateKey = this.formatDateKey(date);
            const rankings = this.rankingsData[dateKey] || [];
            
            rankings.forEach(ranking => {
                const commander = ranking.commander;
                const points = parseInt(ranking.points) || 0;
                
                if (!cumulativeScores[commander]) {
                    cumulativeScores[commander] = 0;
                }
                cumulativeScores[commander] += points;
            });
        });
        
        // Sort by cumulative score (descending) and return top 5
        return Object.entries(cumulativeScores)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .reduce((acc, [commander, score]) => {
                acc[commander] = score;
                return acc;
            }, {});
    }

    formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}