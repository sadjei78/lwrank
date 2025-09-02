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
                return 0;
            }

            // Use the most recent kudos points (unique value per player)
            const mostRecentKudos = kudosData.sort((a, b) => new Date(b.date_awarded) - new Date(a.date_awarded))[0];
            
            // Convert to percentage (0-100) from 1-10 scale
            return (mostRecentKudos.points / 10) * 100;
        } catch (error) {
            console.error('Error calculating kudos score:', error);
            return 0;
        }
    }

    async calculateVSPerformanceScore(playerName, startDate, endDate) {
        try {
            // Get all unique days with data in the period
            const { data: allDaysData, error: daysError } = await supabase
                .from('rankings')
                .select('date')
                .gte('date', startDate)
                .lte('date', endDate);

            if (daysError) {
                console.error('Error fetching days data:', daysError);
                throw daysError;
            }

            // Get unique days with actual data
            const uniqueDays = [...new Set(allDaysData.map(d => d.date))];
            const totalRecordedDays = uniqueDays.length;

            if (totalRecordedDays === 0) {
                return 0;
            }

            // Get player's rankings for those days
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
                return 0;
            }

            // Count top 10 appearances
            const top10Count = playerData.filter(ranking => ranking.ranking <= 10).length;
            
            // Calculate percentage of days in top 10 out of total recorded days
            return (top10Count / totalRecordedDays) * 100;
        } catch (error) {
            console.error('Error calculating VS performance score:', error);
            return 0;
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
                return 0;
            }

            if (specialEvents.length === 0) {
                return 0;
            }

            // Filter out alliance contribution events
            const nonAllianceEvents = specialEvents.filter(event => 
                !event.name.toLowerCase().includes('alliance') &&
                !event.name.toLowerCase().includes('contribution')
            );

            if (nonAllianceEvents.length === 0) {
                return 0;
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
                return 0;
            }

            if (rankings.length === 0) {
                return 0;
            }

            // Calculate weighted score for each event
            let totalWeightedScore = 0;
            let totalWeight = 0;

            for (const ranking of rankings) {
                // Find the corresponding event to get its weight
                const event = nonAllianceEvents.find(e => e.key === ranking.day);
                if (!event) continue;

                const eventWeight = event.event_weight || 10.0; // Default to 10% if not set
                
                // Convert ranking to percentage (lower ranking = higher percentage)
                // Assuming max 50 participants, 1st place = 100%, 50th place = 2%
                const maxParticipants = 50;
                const rankingPercentage = Math.max(0, ((maxParticipants - ranking.ranking + 1) / maxParticipants) * 100);
                
                // Weight this event's contribution
                const weightedEventScore = (rankingPercentage * eventWeight) / 100;
                totalWeightedScore += weightedEventScore;
                totalWeight += eventWeight;
            }

            // Return the total weighted score (sum of weighted scores, not normalized)
            return Math.round(totalWeightedScore * 100) / 100;
        } catch (error) {
            console.error('Error calculating special events score:', error);
            return 0;
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
                return 0;
            }

            if (specialEvents.length === 0) {
                return 0;
            }

            // Filter for alliance contribution events only
            const allianceEvents = specialEvents.filter(event => 
                event.name.toLowerCase().includes('alliance') ||
                event.name.toLowerCase().includes('contribution')
            );

            if (allianceEvents.length === 0) {
                return 0;
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
                return 0;
            }

            if (rankings.length === 0) {
                return 0;
            }

            // Calculate weighted score for each alliance contribution event
            let totalWeightedScore = 0;

            for (const ranking of rankings) {
                // Find the corresponding event to get its weight
                const event = allianceEvents.find(e => e.key === ranking.day);
                if (!event) continue;

                const eventWeight = event.event_weight || 10.0; // Default to 10% if not set
                
                // Convert ranking to percentage (lower ranking = higher percentage)
                // Assuming max 50 participants, 1st place = 100%, 50th place = 2%
                const maxParticipants = 50;
                const rankingPercentage = Math.max(0, ((maxParticipants - ranking.ranking + 1) / maxParticipants) * 100);
                
                // Weight this event's contribution
                const weightedEventScore = (rankingPercentage * eventWeight) / 100;
                totalWeightedScore += weightedEventScore;
            }

            // Return the total weighted score (sum of weighted scores, not normalized)
            return Math.round(totalWeightedScore * 100) / 100;
        } catch (error) {
            console.error('Error calculating alliance contribution score:', error);
            return 0;
        }
    }

    // Season Ranking Generation
    async generateSeasonRankings(seasonName, startDate, endDate, weights) {
        try {
            const eligiblePlayers = await this.getEligiblePlayersInPeriod(startDate, endDate);
            const rankings = [];

            for (const playerName of eligiblePlayers) {
                const kudosScore = await this.calculateKudosScore(playerName, startDate, endDate);
                const vsScore = await this.calculateVSPerformanceScore(playerName, startDate, endDate);
                const specialEventsScore = await this.calculateSpecialEventsScore(playerName, startDate, endDate);
                const allianceScore = await this.calculateAllianceContributionScore(playerName, startDate, endDate);

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
                    totalWeightedScore: Math.round(totalScore * 100) / 100
                });
            }

            // Sort by total score (descending)
            rankings.sort((a, b) => b.totalWeightedScore - a.totalWeightedScore);

            // Add final ranks
            rankings.forEach((ranking, index) => {
                ranking.finalRank = index + 1;
            });

            return rankings;
        } catch (error) {
            console.error('Error generating season rankings:', error);
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
}
