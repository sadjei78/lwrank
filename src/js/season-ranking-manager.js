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

            // Calculate average kudos points (1-10 scale)
            const totalPoints = kudosData.reduce((sum, kudos) => sum + kudos.points, 0);
            const averagePoints = totalPoints / kudosData.length;
            
            // Convert to percentage (0-100)
            return (averagePoints / 10) * 100;
        } catch (error) {
            console.error('Error calculating kudos score:', error);
            return 0;
        }
    }

    async calculateVSPerformanceScore(playerName, startDate, endDate) {
        try {
            const { data, error } = await supabase
                .from('rankings')
                .select('*')
                .eq('commander', playerName)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date');

            if (error) {
                console.error('Error fetching VS performance data:', error);
                throw error;
            }

            if (data.length === 0) {
                return 0;
            }

            // Count top 10 appearances
            const top10Count = data.filter(ranking => ranking.ranking <= 10).length;
            const totalDays = data.length;
            
            // Calculate percentage of days in top 10
            return (top10Count / totalDays) * 100;
        } catch (error) {
            console.error('Error calculating VS performance score:', error);
            return 0;
        }
    }

    async calculateSpecialEventsScore(playerName, startDate, endDate) {
        try {
            // First, get all special events in the date range
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

            // Calculate average rank in special events
            const totalRank = rankings.reduce((sum, ranking) => sum + ranking.ranking, 0);
            const averageRank = totalRank / rankings.length;
            
            // Convert rank to score (lower rank = higher score)
            // Assuming max participants is around 50, adjust as needed
            const maxParticipants = 50;
            const score = ((maxParticipants - averageRank + 1) / maxParticipants) * 100;
            
            return Math.max(0, score);
        } catch (error) {
            console.error('Error calculating special events score:', error);
            return 0;
        }
    }

    async calculateAllianceContributionScore(playerName, startDate, endDate) {
        try {
            // First, get all special events in the date range
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

            // Calculate average rank in alliance contribution events
            const totalRank = rankings.reduce((sum, ranking) => sum + ranking.ranking, 0);
            const averageRank = totalRank / rankings.length;
            
            // Convert rank to score (lower rank = higher score)
            const maxParticipants = 50;
            const score = ((maxParticipants - averageRank + 1) / maxParticipants) * 100;
            
            return Math.max(0, score);
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

                // Calculate weighted total score
                const totalScore = 
                    (kudosScore * weights.kudos / 100) +
                    (vsScore * weights.vsPerformance / 100) +
                    (specialEventsScore * weights.specialEvents / 100) +
                    (allianceScore * weights.allianceContribution / 100);

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
