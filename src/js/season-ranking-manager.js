import { supabase } from './supabase-client.js';

export class SeasonRankingManager {
    constructor(rankingManager, leaderVIPManager) {
        this.rankingManager = rankingManager;
        this.leaderVIPManager = leaderVIPManager;
    }

    // Kudos Points Management
    async awardKudos(playerName, points, reason, awardedBy) {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Use upsert to update existing kudos or insert new one
            const { data, error } = await supabase
                .from('kudos_points')
                .upsert([
                    {
                        player_name: playerName,
                        points: points,
                        reason: reason,
                        awarded_by: awardedBy,
                        date_awarded: today
                    }
                ], { 
                    onConflict: 'player_name,date_awarded',
                    ignoreDuplicates: false 
                })
                .select();

            if (error) {
                console.error('Error awarding kudos:', error);
                throw error;
            }

            return data[0];
        } catch (error) {
            console.error('Error in awardKudos:', error);
            throw error;
        }
    }

    async getRecentKudos(limit = 10) {
        try {
            const { data, error } = await supabase
                .from('kudos_points')
                .select('*')
                .order('date_awarded', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error fetching recent kudos:', error);
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('Error in getRecentKudos:', error);
            throw error;
        }
    }

    async getKudosForPlayerAndDate(playerName, date) {
        try {
            const { data, error } = await supabase
                .from('kudos_points')
                .select('*')
                .eq('player_name', playerName)
                .eq('date_awarded', date);

            if (error) {
                console.error('Error getting kudos for player and date:', error);
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('Error in getKudosForPlayerAndDate:', error);
            throw error;
        }
    }

    async deleteKudos(kudosId) {
        try {
            const { error } = await supabase
                .from('kudos_points')
                .delete()
                .eq('id', kudosId);

            if (error) {
                console.error('Error deleting kudos:', error);
                throw error;
            }

            return true;
        } catch (error) {
            console.error('Error in deleteKudos:', error);
            throw error;
        }
    }

    async getKudosForPlayer(playerName, startDate, endDate) {
        try {
            const { data, error } = await supabase
                .from('kudos_points')
                .select('*')
                .eq('player_name', playerName)
                .gte('date_awarded', startDate)
                .lte('date_awarded', endDate);

            if (error) {
                console.error('Error fetching kudos for player:', error);
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('Error in getKudosForPlayer:', error);
            throw error;
        }
    }

    // Player Eligibility Checking
    isPlayerEligibleForSeasonRanking(playerName) {
        // Check if player is removed
        if (this.rankingManager.isPlayerRemoved && this.rankingManager.isPlayerRemoved(playerName)) {
            return false;
        }
        
        // Check if player is currently an active alliance leader
        if (this.leaderVIPManager.isAllianceLeader && this.leaderVIPManager.isAllianceLeader(playerName)) {
            return false;
        }
        
        return true;
    }

    async getAllPlayersInPeriod(startDate, endDate) {
        try {
            const { data, error } = await supabase
                .from('rankings')
                .select('commander')
                .gte('date', startDate)
                .lte('date', endDate)
                .order('commander');

            if (error) {
                console.error('Error fetching players in period:', error);
                throw error;
            }

            // Get unique player names
            const uniquePlayers = [...new Set(data.map(item => item.commander))];
            return uniquePlayers;
        } catch (error) {
            console.error('Error in getAllPlayersInPeriod:', error);
            throw error;
        }
    }

    async getEligiblePlayersInPeriod(startDate, endDate) {
        try {
            const allPlayers = await this.getAllPlayersInPeriod(startDate, endDate);
            const eligiblePlayers = allPlayers.filter(player => 
                this.isPlayerEligibleForSeasonRanking(player)
            );
            return eligiblePlayers;
        } catch (error) {
            console.error('Error in getEligiblePlayersInPeriod:', error);
            throw error;
        }
    }

    // Scoring Calculations
    async calculateKudosScore(playerName, startDate, endDate) {
        try {
            const kudosData = await this.getKudosForPlayer(playerName, startDate, endDate);
            
            if (kudosData.length === 0) {
                return { score: 0, breakdown: { points: 0, hasKudos: false } };
            }

            // Use the most recent kudos points (unique value per player)
            const mostRecentKudos = kudosData.sort((a, b) => new Date(b.date_awarded) - new Date(a.date_awarded))[0];
            
            // Convert to percentage (0-100) from 1-10 scale
            const score = (mostRecentKudos.points / 10) * 100;
            
            return {
                score,
                breakdown: {
                    points: mostRecentKudos.points,
                    hasKudos: true,
                    dateAwarded: mostRecentKudos.date_awarded
                }
            };
        } catch (error) {
            console.error('Error calculating kudos score:', error);
            return { score: 0, breakdown: { points: 0, hasKudos: false } };
        }
    }

    async calculateVSPerformanceScore(playerName, startDate, endDate) {
        try {
            // Get player's rankings for the period
            const { data: playerData, error: playerError } = await supabase
                .from('rankings')
                .select('*')
                .eq('commander', playerName)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date');

            if (playerError) {
                console.error('Error fetching VS performance data:', playerError);
                throw playerError;
            }

            if (playerData.length === 0) {
                return { score: 0, breakdown: { basePoints: 50, top10Occurrences: 0, bottom20Occurrences: 0, totalDays: 0 } };
            }

            // New VS Points logic: 50 base points + 2 points per top 10 - 1 point per bottom 20
            let vsPoints = 50; // Base points for everyone
            let top10Occurrences = 0;
            let bottom20Occurrences = 0;
            
            for (const ranking of playerData) {
                if (ranking.ranking <= 10) {
                    vsPoints += 2; // +2 points for each top 10 occurrence
                    top10Occurrences++;
                }
                if (ranking.ranking >= 21) { // Assuming bottom 20 means ranks 21+
                    // Check if player was excused on this date
                    const isExcused = await this.isPlayerExcused(playerName, ranking.date);
                    if (!isExcused) {
                        vsPoints -= 1; // -1 point for each bottom 20 occurrence (only if not excused)
                        bottom20Occurrences++;
                    }
                }
            }

            const finalScore = Math.max(0, vsPoints); // Ensure non-negative score
            
            return {
                score: finalScore,
                breakdown: {
                    basePoints: 50,
                    top10Occurrences,
                    bottom20Occurrences,
                    totalDays: playerData.length
                }
            };
        } catch (error) {
            console.error('Error calculating VS performance score:', error);
            return { score: 0, breakdown: { basePoints: 50, top10Occurrences: 0, bottom20Occurrences: 0, totalDays: 0 } };
        }
    }

    async calculateSpecialEventsScore(playerName, startDate, endDate) {
        try {
            // First, get all special events in the date range with their weights
            const { data: specialEvents, error: eventsError } = await supabase
                .from('special_events')
                .select('*')
                .gte('start_date', startDate)
                .lte('end_date', endDate);

            if (eventsError) {
                console.error('Error fetching special events:', eventsError);
                return { score: 0, breakdown: { events: [] } };
            }

            if (specialEvents.length === 0) {
                return { score: 0, breakdown: { events: [] } };
            }

            // Filter out alliance contribution events
            const nonAllianceEvents = specialEvents.filter(event => 
                !event.name.toLowerCase().includes('alliance') &&
                !event.name.toLowerCase().includes('contribution')
            );

            if (nonAllianceEvents.length === 0) {
                return { score: 0, breakdown: { events: [] } };
            }

            // Get player's rankings in these special events
            const eventKeys = nonAllianceEvents.map(event => event.key);
            const { data: rankings, error: rankingsError } = await supabase
                .from('rankings')
                .select('*')
                .eq('commander', playerName)
                .in('day', eventKeys);

            if (rankingsError) {
                console.error('Error fetching special event rankings:', rankingsError);
                return { score: 0, breakdown: { events: [] } };
            }

            if (rankings.length === 0) {
                return { score: 0, breakdown: { events: [] } };
            }

            // New Special Events Points logic: (total participants + 10) - actual rank
            let totalSpecialEventsPoints = 0;
            const eventBreakdown = [];

            for (const ranking of rankings) {
                // Find the corresponding event to get its weight
                const event = nonAllianceEvents.find(e => e.key === ranking.day);
                if (!event) continue;

                // Get total participants for this event (we'll need to count from rankings)
                const { data: eventRankings, error: eventRankingsError } = await supabase
                    .from('rankings')
                    .select('commander')
                    .eq('day', event.key);

                if (eventRankingsError) {
                    console.error('Error fetching event participants:', eventRankingsError);
                    continue;
                }

                const totalParticipants = eventRankings.length;
                const eventPoints = (totalParticipants + 10) - ranking.ranking;
                const finalEventPoints = Math.max(0, eventPoints); // Ensure non-negative
                
                totalSpecialEventsPoints += finalEventPoints;
                
                eventBreakdown.push({
                    eventName: event.name,
                    rank: ranking.ranking,
                    totalParticipants,
                    points: finalEventPoints
                });
            }

            const finalScore = Math.round(totalSpecialEventsPoints * 100) / 100;
            
            return {
                score: finalScore,
                breakdown: { events: eventBreakdown }
            };
        } catch (error) {
            console.error('Error calculating special events score:', error);
            return { score: 0, breakdown: { events: [] } };
        }
    }

    async calculateAllianceContributionScore(playerName, startDate, endDate) {
        try {
            // First, get all special events in the date range with their weights
            const { data: specialEvents, error: eventsError } = await supabase
                .from('special_events')
                .select('*')
                .gte('start_date', startDate)
                .lte('end_date', endDate);

            if (eventsError) {
                console.error('Error fetching special events:', eventsError);
                return { score: 0, breakdown: { events: [] } };
            }

            if (specialEvents.length === 0) {
                return { score: 0, breakdown: { events: [] } };
            }

            // Filter for alliance contribution events only
            const allianceEvents = specialEvents.filter(event => 
                event.name.toLowerCase().includes('alliance') ||
                event.name.toLowerCase().includes('contribution')
            );

            if (allianceEvents.length === 0) {
                return { score: 0, breakdown: { events: [] } };
            }

            // Get player's rankings in these alliance contribution events
            const eventKeys = allianceEvents.map(event => event.key);
            const { data: rankings, error: rankingsError } = await supabase
                .from('rankings')
                .select('*')
                .eq('commander', playerName)
                .in('day', eventKeys);

            if (rankingsError) {
                console.error('Error fetching alliance contribution rankings:', rankingsError);
                return { score: 0, breakdown: { events: [] } };
            }

            if (rankings.length === 0) {
                return { score: 0, breakdown: { events: [] } };
            }

            // New Alliance Contribution Points logic: (total participants + 10) - actual rank (same as special events)
            let totalAlliancePoints = 0;
            const eventBreakdown = [];

            for (const ranking of rankings) {
                // Find the corresponding event to get its weight
                const event = allianceEvents.find(e => e.key === ranking.day);
                if (!event) continue;

                // Get total participants for this event (we'll need to count from rankings)
                const { data: eventRankings, error: eventRankingsError } = await supabase
                    .from('rankings')
                    .select('commander')
                    .eq('day', event.key);

                if (eventRankingsError) {
                    console.error('Error fetching event participants:', eventRankingsError);
                    continue;
                }

                const totalParticipants = eventRankings.length;
                const eventPoints = (totalParticipants + 10) - ranking.ranking;
                const finalEventPoints = Math.max(0, eventPoints); // Ensure non-negative
                
                totalAlliancePoints += finalEventPoints;
                
                eventBreakdown.push({
                    eventName: event.name,
                    rank: ranking.ranking,
                    totalParticipants,
                    points: finalEventPoints
                });
            }

            const finalScore = Math.round(totalAlliancePoints * 100) / 100;
            
            return {
                score: finalScore,
                breakdown: { events: eventBreakdown }
            };
        } catch (error) {
            console.error('Error calculating alliance contribution score:', error);
            return { score: 0, breakdown: { events: [] } };
        }
    }

    // Season Ranking Generation
    async generateSeasonRankings(seasonName, startDate, endDate, weights) {
        try {
            console.log('=== SEASON RANKING MANAGER: generateSeasonRankings called ===');
            console.log('Parameters:', { seasonName, startDate, endDate, weights });
            
            const eligiblePlayers = await this.getEligiblePlayersInPeriod(startDate, endDate);
            console.log('Eligible players found:', eligiblePlayers.length);
            console.log('Eligible players:', eligiblePlayers);
            
            const rankings = [];

            for (const playerName of eligiblePlayers) {
                const kudosResult = await this.calculateKudosScore(playerName, startDate, endDate);
                const vsResult = await this.calculateVSPerformanceScore(playerName, startDate, endDate);
                const specialEventsResult = await this.calculateSpecialEventsScore(playerName, startDate, endDate);
                const allianceResult = await this.calculateAllianceContributionScore(playerName, startDate, endDate);

                // Extract scores from the new return format
                const kudosScore = kudosResult.score;
                const vsScore = vsResult.score;
                const specialEventsScore = specialEventsResult.score;
                const allianceScore = allianceResult.score;

                // Calculate weighted total score (excluding alliance contribution from weights)
                const totalScore = 
                    (kudosScore * weights.kudos / 100) +
                    (vsScore * weights.vsPerformance / 100) +
                    (specialEventsScore * weights.specialEvents / 100) +
                    allianceScore; // Alliance contribution is added directly, not weighted

                rankings.push({
                    playerName,
                    kudosScore: Math.round(kudosScore * 100) / 100,
                    vsPerformanceScore: Math.round(vsScore * 100) / 100,
                    specialEventsScore: Math.round(specialEventsScore * 100) / 100,
                    allianceContributionScore: Math.round(allianceScore * 100) / 100,
                    totalWeightedScore: Math.round(totalScore * 100) / 100,
                    // Store raw scores for ranking calculation
                    rawKudosScore: kudosScore,
                    rawVSScore: vsScore,
                    rawSpecialEventsScore: specialEventsScore,
                    rawAllianceScore: allianceScore,
                    // Store detailed breakdowns
                    kudosBreakdown: kudosResult.breakdown,
                    vsBreakdown: vsResult.breakdown,
                    specialEventsBreakdown: specialEventsResult.breakdown,
                    allianceBreakdown: allianceResult.breakdown
                });
            }

            // Sort by total score (descending)
            rankings.sort((a, b) => b.totalWeightedScore - a.totalWeightedScore);

            // Add final ranks
            rankings.forEach((ranking, index) => {
                ranking.finalRank = index + 1;
            });

            // Calculate individual category ranks
            // Kudos ranks
            const kudosSorted = [...rankings].sort((a, b) => b.rawKudosScore - a.rawKudosScore);
            kudosSorted.forEach((ranking, index) => {
                const originalIndex = rankings.findIndex(r => r.playerName === ranking.playerName);
                rankings[originalIndex].kudosRank = index + 1;
            });

            // VS Performance ranks
            const vsSorted = [...rankings].sort((a, b) => b.rawVSScore - a.rawVSScore);
            vsSorted.forEach((ranking, index) => {
                const originalIndex = rankings.findIndex(r => r.playerName === ranking.playerName);
                rankings[originalIndex].vsRank = index + 1;
            });

            // Special Events ranks
            const specialEventsSorted = [...rankings].sort((a, b) => b.rawSpecialEventsScore - a.rawSpecialEventsScore);
            specialEventsSorted.forEach((ranking, index) => {
                const originalIndex = rankings.findIndex(r => r.playerName === ranking.playerName);
                rankings[originalIndex].specialEventsRank = index + 1;
            });

            // Alliance Contribution ranks
            const allianceSorted = [...rankings].sort((a, b) => b.rawAllianceScore - a.rawAllianceScore);
            allianceSorted.forEach((ranking, index) => {
                const originalIndex = rankings.findIndex(r => r.playerName === ranking.playerName);
                rankings[originalIndex].allianceRank = index + 1;
            });

            console.log('=== SEASON RANKING MANAGER: generateSeasonRankings completed ===');
            console.log('Final rankings count:', rankings.length);
            console.log('Sample final ranking:', rankings[0]);
            return rankings;
        } catch (error) {
            console.error('Error generating season rankings:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    // Save season rankings to database
    async saveSeasonRankings(seasonName, startDate, endDate, rankings) {
        try {
            // First, clear existing rankings for this season
            await supabase
                .from('season_rankings')
                .delete()
                .eq('season_name', seasonName)
                .eq('start_date', startDate)
                .eq('end_date', endDate);

            // Insert new rankings
            const rankingsData = rankings.map(ranking => ({
                season_name: seasonName,
                start_date: startDate,
                end_date: endDate,
                player_name: ranking.playerName,
                is_eligible: true,
                kudos_score: ranking.kudosScore,
                vs_performance_score: ranking.vsPerformanceScore,
                special_events_score: ranking.specialEventsScore,
                alliance_contribution_score: ranking.allianceContributionScore,
                total_weighted_score: ranking.totalWeightedScore,
                final_rank: ranking.finalRank
            }));

            const { data, error } = await supabase
                .from('season_rankings')
                .insert(rankingsData)
                .select();

            if (error) {
                console.error('Error saving season rankings:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error in saveSeasonRankings:', error);
            throw error;
        }
    }

    // Get saved season rankings
    async getSeasonRankings(seasonName, startDate, endDate) {
        try {
            const { data, error } = await supabase
                .from('season_rankings')
                .select('*')
                .eq('season_name', seasonName)
                .eq('start_date', startDate)
                .eq('end_date', endDate)
                .order('final_rank');

            if (error) {
                console.error('Error fetching season rankings:', error);
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('Error in getSeasonRankings:', error);
            throw error;
        }
    }

    // Get all available season reports (unique combinations)
    async getAllAvailableSeasonReports() {
        try {
            const { data, error } = await supabase
                .from('season_rankings')
                .select('season_name, start_date, end_date, created_at')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching available season reports:', error);
                throw error;
            }

            // Group by unique combinations
            const uniqueReports = [];
            const seen = new Set();
            
            for (const record of data || []) {
                const key = `${record.season_name}|${record.start_date}|${record.end_date}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueReports.push({
                        season_name: record.season_name,
                        start_date: record.start_date,
                        end_date: record.end_date,
                        created_at: record.created_at
                    });
                }
            }

            return uniqueReports;
        } catch (error) {
            console.error('Error in getAllAvailableSeasonReports:', error);
            throw error;
        }
    }

    // Clear season data
    async clearSeasonData(seasonName, startDate, endDate) {
        try {
            const { error } = await supabase
                .from('season_rankings')
                .delete()
                .eq('season_name', seasonName)
                .eq('start_date', startDate)
                .eq('end_date', endDate);

            if (error) {
                console.error('Error clearing season data:', error);
                throw error;
            }

            return true;
        } catch (error) {
            console.error('Error in clearSeasonData:', error);
            throw error;
        }
    }

    // Update player name in seasonal rankings
    async updatePlayerNameInSeasonRankings(oldName, newName) {
        try {
            console.log(`Updating player name in seasonal rankings: ${oldName} → ${newName}`);
            
            const { error } = await supabase
                .from('season_rankings')
                .update({ player_name: newName })
                .eq('player_name', oldName);

            if (error) {
                console.error('Error updating player name in seasonal rankings:', error);
                throw error;
            }

            console.log(`Successfully updated player name in seasonal rankings: ${oldName} → ${newName}`);
            return true;
        } catch (error) {
            console.error('Error updating player name in seasonal rankings:', error);
            throw new Error(`Failed to update player name in seasonal rankings: ${error.message}`);
        }
    }

    // Excused Players Management
    async addExcusedPlayer(playerName, reason, approvedBy, dateExcused) {
        try {
            console.log(`Adding excused player: ${playerName}`);
            
            const { data, error } = await supabase
                .from('excused_players')
                .insert({
                    player_name: playerName,
                    reason: reason,
                    approved_by: approvedBy,
                    date_excused: dateExcused
                })
                .select();

            if (error) {
                console.error('Error adding excused player:', error);
                throw error;
            }

            console.log(`Successfully added excused player: ${playerName}`);
            return data[0];
        } catch (error) {
            console.error('Error adding excused player:', error);
            throw new Error(`Failed to add excused player: ${error.message}`);
        }
    }

    async getExcusedPlayers() {
        try {
            const { data, error } = await supabase
                .from('excused_players')
                .select('*')
                .order('date_excused', { ascending: false });

            if (error) {
                console.error('Error fetching excused players:', error);
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('Error fetching excused players:', error);
            throw new Error(`Failed to fetch excused players: ${error.message}`);
        }
    }

    async removeExcusedPlayer(excusedPlayerId) {
        try {
            console.log(`Removing excused player with ID: ${excusedPlayerId}`);
            
            const { error } = await supabase
                .from('excused_players')
                .delete()
                .eq('id', excusedPlayerId);

            if (error) {
                console.error('Error removing excused player:', error);
                throw error;
            }

            console.log(`Successfully removed excused player with ID: ${excusedPlayerId}`);
            return true;
        } catch (error) {
            console.error('Error removing excused player:', error);
            throw new Error(`Failed to remove excused player: ${error.message}`);
        }
    }

    async isPlayerExcused(playerName, date) {
        try {
            const { data, error } = await supabase
                .from('excused_players')
                .select('*')
                .eq('player_name', playerName)
                .lte('date_excused', date)
                .order('date_excused', { ascending: false })
                .limit(1);

            if (error) {
                console.error('Error checking if player is excused:', error);
                return false;
            }

            return data && data.length > 0;
        } catch (error) {
            console.error('Error checking if player is excused:', error);
            return false;
        }
    }
}
