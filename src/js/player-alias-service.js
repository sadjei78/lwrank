/**
 * PlayerAliasService - Manages player name variations and aliases
 * 
 * This service handles:
 * - Creating and managing player aliases
 * - Resolving aliases to primary names
 * - Finding all variations of a player name
 * - Integration with existing player management systems
 */

import { supabase } from './supabase-client.js';

export class PlayerAliasService {
    constructor() {
        this.aliasesCache = new Map(); // Cache for alias lookups
        this.isOnline = true;
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.lastCacheUpdate = 0;
    }

    /**
     * Initialize the service by loading aliases from database
     */
    async initialize() {
        try {
            await this.loadAliasesFromDatabase();
            console.log('PlayerAliasService initialized successfully');
        } catch (error) {
            console.error('Failed to initialize PlayerAliasService:', error);
            this.isOnline = false;
        }
    }

    /**
     * Load all active aliases from database
     */
    async loadAliasesFromDatabase() {
        if (!this.isOnline) return;

        try {
            const { data, error } = await supabase
                .from('player_aliases')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading player aliases:', error);
                return;
            }

            // Clear existing cache
            this.aliasesCache.clear();

            // Build cache: alias -> primary name mapping
            data.forEach(alias => {
                const aliasKey = alias.alias_name.toLowerCase().trim();
                const primaryKey = alias.primary_name.toLowerCase().trim();
                
                // Store both directions for efficient lookup
                this.aliasesCache.set(aliasKey, {
                    primaryName: alias.primary_name,
                    aliasName: alias.alias_name,
                    createdBy: alias.created_by,
                    createdAt: alias.created_at
                });

                // Also store primary name as its own entry for consistency
                if (!this.aliasesCache.has(primaryKey)) {
                    this.aliasesCache.set(primaryKey, {
                        primaryName: alias.primary_name,
                        aliasName: alias.primary_name,
                        createdBy: alias.created_by,
                        createdAt: alias.created_at
                    });
                }
            });

            this.lastCacheUpdate = Date.now();
            console.log(`Loaded ${data.length} player aliases into cache`);

        } catch (error) {
            console.error('Database error loading player aliases:', error);
            this.isOnline = false;
        }
    }

    /**
     * Resolve a player name to its primary/canonical name
     * @param {string} playerName - The name to resolve
     * @returns {string} The primary name for this player
     */
    resolvePlayerName(playerName) {
        if (!playerName || typeof playerName !== 'string') {
            return playerName;
        }

        const normalizedName = playerName.toLowerCase().trim();
        const aliasData = this.aliasesCache.get(normalizedName);
        
        if (aliasData) {
            return aliasData.primaryName;
        }

        return playerName; // Return original if no alias found
    }

    /**
     * Get all known variations (aliases) for a player name
     * @param {string} playerName - The player name to get variations for
     * @returns {Array} Array of all known name variations
     */
    getAllPlayerVariations(playerName) {
        if (!playerName || typeof playerName !== 'string') {
            return [playerName];
        }

        const primaryName = this.resolvePlayerName(playerName);
        const variations = new Set([primaryName]);

        // Find all aliases that point to this primary name
        for (const [aliasKey, aliasData] of this.aliasesCache) {
            if (aliasData.primaryName.toLowerCase() === primaryName.toLowerCase()) {
                variations.add(aliasData.aliasName);
            }
        }

        return Array.from(variations);
    }

    /**
     * Check if a name is an alias for another player
     * @param {string} playerName - The name to check
     * @returns {boolean} True if this is an alias
     */
    isAlias(playerName) {
        if (!playerName || typeof playerName !== 'string') {
            return false;
        }

        const normalizedName = playerName.toLowerCase().trim();
        const aliasData = this.aliasesCache.get(normalizedName);
        
        return aliasData && aliasData.aliasName !== aliasData.primaryName;
    }

    /**
     * Create a new player alias
     * @param {string} primaryName - The canonical/primary name
     * @param {string} aliasName - The alias/variation name
     * @param {string} createdBy - Who is creating this alias
     * @returns {Promise<boolean>} Success status
     */
    async createAlias(primaryName, aliasName, createdBy) {
        if (!primaryName || !aliasName || !createdBy) {
            console.error('Missing required parameters for createAlias');
            return false;
        }

        if (primaryName.toLowerCase().trim() === aliasName.toLowerCase().trim()) {
            console.error('Primary name and alias name cannot be the same');
            return false;
        }

        try {
            const { error } = await supabase
                .from('player_aliases')
                .insert({
                    primary_name: primaryName.trim(),
                    alias_name: aliasName.trim(),
                    created_by: createdBy.trim(),
                    is_active: true
                });

            if (error) {
                console.error('Error creating player alias:', error);
                return false;
            }

            // Refresh cache
            await this.loadAliasesFromDatabase();
            
            console.log(`Created alias: ${aliasName} -> ${primaryName}`);
            return true;

        } catch (error) {
            console.error('Database error creating player alias:', error);
            return false;
        }
    }

    /**
     * Deactivate a player alias
     * @param {string} primaryName - The primary name
     * @param {string} aliasName - The alias to deactivate
     * @returns {Promise<boolean>} Success status
     */
    async deactivateAlias(primaryName, aliasName) {
        try {
            const { error } = await supabase
                .from('player_aliases')
                .update({ is_active: false })
                .eq('primary_name', primaryName.trim())
                .eq('alias_name', aliasName.trim());

            if (error) {
                console.error('Error deactivating player alias:', error);
                return false;
            }

            // Refresh cache
            await this.loadAliasesFromDatabase();
            
            console.log(`Deactivated alias: ${aliasName} -> ${primaryName}`);
            return true;

        } catch (error) {
            console.error('Database error deactivating player alias:', error);
            return false;
        }
    }

    /**
     * Get all aliases for a specific primary name
     * @param {string} primaryName - The primary name to get aliases for
     * @returns {Array} Array of alias objects
     */
    async getAliasesForPlayer(primaryName) {
        try {
            const { data, error } = await supabase
                .from('player_aliases')
                .select('*')
                .eq('primary_name', primaryName.trim())
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error getting aliases for player:', error);
                return [];
            }

            return data || [];

        } catch (error) {
            console.error('Database error getting aliases for player:', error);
            return [];
        }
    }

    /**
     * Find potential aliases by searching for similar names
     * @param {string} playerName - The name to find similar names for
     * @param {Array} allPlayerNames - Array of all existing player names
     * @returns {Array} Array of potential matches with similarity scores
     */
    findPotentialAliases(playerName, allPlayerNames) {
        if (!playerName || !allPlayerNames || !Array.isArray(allPlayerNames)) {
            return [];
        }

        const similarities = allPlayerNames
            .filter(name => name.toLowerCase() !== playerName.toLowerCase())
            .map(name => ({
                name: name,
                similarity: this.calculateSimilarity(playerName.toLowerCase(), name.toLowerCase())
            }))
            .filter(sim => sim.similarity > 0.3) // Only return reasonably similar names
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 10); // Return top 10 matches

        return similarities;
    }

    /**
     * Calculate string similarity using Levenshtein distance
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Similarity score between 0 and 1
     */
    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;

        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 1;

        const distance = this.levenshteinDistance(str1, str2);
        return 1 - (distance / maxLength);
    }

    /**
     * Calculate Levenshtein distance between two strings
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Edit distance
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Check if cache needs refresh
     */
    needsCacheRefresh() {
        return Date.now() - this.lastCacheUpdate > this.cacheExpiry;
    }

    /**
     * Refresh cache if needed
     */
    async refreshCacheIfNeeded() {
        if (this.needsCacheRefresh()) {
            await this.loadAliasesFromDatabase();
        }
    }

    /**
     * Get cache statistics for debugging
     */
    getCacheStats() {
        return {
            cacheSize: this.aliasesCache.size,
            lastUpdate: new Date(this.lastCacheUpdate).toISOString(),
            isOnline: this.isOnline,
            needsRefresh: this.needsCacheRefresh()
        };
    }
}
