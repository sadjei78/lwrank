export class AutocompleteService {
    constructor(rankingManager, leaderVIPManager, playerAliasService = null) {
        this.rankingManager = rankingManager;
        this.leaderVIPManager = leaderVIPManager;
        this.playerAliasService = playerAliasService;
        this.allPlayerNames = new Set();
        this.filteredNames = [];
        this.selectedIndex = -1;
        this.isOpen = false;
    }

    async initialize() {
        // Get all unique player names from the ranking system
        await this.loadAllPlayerNames();
    }

    async loadAllPlayerNames() {
        try {
            // Get all rankings data to extract unique player names
            const allRankings = await this.rankingManager.getAllRankings();
            this.allPlayerNames.clear();
            
            if (allRankings && Array.isArray(allRankings)) {
                allRankings.forEach(ranking => {
                    if (ranking.commander) {
                        this.allPlayerNames.add(ranking.commander);
                    }
                });
                
                console.log(`Loaded ${this.allPlayerNames.size} unique player names for autocomplete from database`);
            } else {
                console.warn('No rankings data available for autocomplete');
            }
        } catch (error) {
            console.error('Error loading player names for autocomplete:', error);
        }
    }

    setupAutocomplete(inputElement, dropdownElement, onSelect, excludeLeaders = false, excludeRemoved = false, excludeInactive = false) {
        let debounceTimer;
        
        // Input event handler
        inputElement.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.handleInput(e.target.value, dropdownElement, onSelect, excludeLeaders, excludeRemoved, excludeInactive);
            }, 150); // Debounce for better performance
        });

        // Focus event handler
        inputElement.addEventListener('focus', () => {
            if (inputElement.value.trim()) {
                this.handleInput(inputElement.value, dropdownElement, onSelect, excludeLeaders, excludeRemoved, excludeInactive);
            }
        });

        // Blur event handler (close dropdown after a short delay)
        inputElement.addEventListener('blur', () => {
            setTimeout(() => {
                this.closeDropdown(dropdownElement);
            }, 200);
        });

        // Keydown event handler for navigation
        inputElement.addEventListener('keydown', (e) => {
            this.handleKeydown(e, dropdownElement, onSelect);
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!inputElement.contains(e.target) && !dropdownElement.contains(e.target)) {
                this.closeDropdown(dropdownElement);
            }
        });

        // Touch outside to close (mobile support)
        document.addEventListener('touchend', (e) => {
            if (!inputElement.contains(e.target) && !dropdownElement.contains(e.target)) {
                this.closeDropdown(dropdownElement);
            }
        });
    }

    async handleInput(value, dropdownElement, onSelect, excludeLeaders = false, excludeRemoved = false, excludeInactive = false) {
        const query = value.trim().toLowerCase();
        
        console.log('Autocomplete handleInput called:', { value, query, excludeLeaders, excludeRemoved, excludeInactive });
        console.log('All player names count:', this.allPlayerNames.size);
        console.log('Dropdown element:', dropdownElement);
        
        if (query.length === 0) {
            this.closeDropdown(dropdownElement);
            return;
        }

        // Get player names, optionally excluding leaders, removed players, and inactive players
        let availableNames = Array.from(this.allPlayerNames);
        console.log('Available names before filtering:', availableNames.length);
        
        if (excludeLeaders && this.leaderVIPManager) {
            availableNames = availableNames.filter(name => 
                !this.leaderVIPManager.isAllianceLeader(name)
            );
        }

        if (excludeRemoved && this.rankingManager) {
            availableNames = availableNames.filter(name => 
                !this.rankingManager.isPlayerRemoved(name)
            );
        }

        if (excludeInactive && this.rankingManager) {
            // Get inactive players and filter them out
            const inactivePlayers = await this.rankingManager.getInactivePlayers();
            const inactivePlayerNames = new Set(
                inactivePlayers.map(p => {
                    const name = p.player_name || p.playerName;
                    return this.playerAliasService ? 
                        this.playerAliasService.resolvePlayerName(name).toLowerCase() : 
                        name.toLowerCase();
                })
            );
            
            availableNames = availableNames.filter(name => {
                const resolvedName = this.playerAliasService ? 
                    this.playerAliasService.resolvePlayerName(name) : name;
                return !inactivePlayerNames.has(resolvedName.toLowerCase());
            });
        }

        // Create enhanced results that include aliases
        const enhancedResults = [];
        
        // Add all primary names and their aliases
        availableNames.forEach(name => {
            const primaryName = this.playerAliasService ? 
                this.playerAliasService.resolvePlayerName(name) : name;
            
            // Add the primary name
            enhancedResults.push({
                name: primaryName,
                displayName: primaryName,
                isAlias: false,
                originalName: name
            });
            
            // Add aliases if they match the query
            if (this.playerAliasService) {
                const variations = this.playerAliasService.getAllPlayerVariations(primaryName);
                variations.forEach(variation => {
                    if (variation.toLowerCase() !== primaryName.toLowerCase() && 
                        variation.toLowerCase().includes(query)) {
                        enhancedResults.push({
                            name: primaryName, // Use primary name as the actual value
                            displayName: `${variation} (alias for ${primaryName})`,
                            isAlias: true,
                            originalName: variation
                        });
                    }
                });
            }
        });

        // Filter and sort results
        this.filteredNames = enhancedResults
            .filter(result => {
                const nameToCheck = result.originalName.toLowerCase();
                return nameToCheck.includes(query);
            })
            .sort((a, b) => {
                // Prioritize exact matches
                const aExact = a.originalName.toLowerCase() === query;
                const bExact = b.originalName.toLowerCase() === query;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                
                // Then prioritize names that start with the query
                const aStartsWith = a.originalName.toLowerCase().startsWith(query);
                const bStartsWith = b.originalName.toLowerCase().startsWith(query);
                
                if (aStartsWith && !bStartsWith) return -1;
                if (!aStartsWith && bStartsWith) return 1;
                
                // Prioritize primary names over aliases
                if (!a.isAlias && b.isAlias) return -1;
                if (a.isAlias && !b.isAlias) return 1;
                
                // Then sort alphabetically
                return a.originalName.localeCompare(b.originalName);
            })
            .slice(0, 10); // Limit to 10 results

        this.showDropdown(dropdownElement, this.filteredNames, onSelect);
    }

    // Special method for removed players form - shows all players except already removed ones
    handleRemovedPlayerInput(value, dropdownElement, onSelect) {
        const query = value.trim().toLowerCase();
        
        if (query.length === 0) {
            this.closeDropdown(dropdownElement);
            return;
        }

        // Get all player names and filter out already removed players
        let availableNames = Array.from(this.allPlayerNames);
        
        // Exclude already removed players
        if (this.rankingManager) {
            availableNames = availableNames.filter(name => 
                !this.rankingManager.isPlayerRemoved(name)
            );
        }

        // Filter player names based on input
        this.filteredNames = availableNames
            .filter(name => name.toLowerCase().includes(query))
            .sort((a, b) => {
                // Prioritize names that start with the query
                const aStartsWith = a.toLowerCase().startsWith(query);
                const bStartsWith = b.toLowerCase().startsWith(query);
                
                if (aStartsWith && !bStartsWith) return -1;
                if (!aStartsWith && bStartsWith) return 1;
                
                // Then sort alphabetically
                return a.localeCompare(b);
            })
            .slice(0, 10); // Limit to 10 results

        this.showDropdown(dropdownElement, this.filteredNames, onSelect);
    }

    showDropdown(dropdownElement, names, onSelect) {
        console.log('showDropdown called:', { namesCount: names.length, dropdownElement });
        
        if (names.length === 0) {
            console.log('No names to show, displaying no results message');
            dropdownElement.innerHTML = '<div class="autocomplete-no-results">No matching players found</div>';
        } else {
            console.log('Showing dropdown with names:', names);
            let html = '';
            names.forEach((item, index) => {
                // Handle both old format (string) and new format (object)
                const name = typeof item === 'string' ? item : item.name;
                const displayName = typeof item === 'string' ? item : item.displayName;
                const isAlias = typeof item === 'object' ? item.isAlias : false;
                
                const cssClass = isAlias ? 'autocomplete-item autocomplete-alias' : 'autocomplete-item';
                html += `<div class="${cssClass}" data-index="${index}" data-value="${name}">${displayName}</div>`;
            });
            dropdownElement.innerHTML = html;
        }
        
        // Make sure the dropdown is visible
        dropdownElement.classList.add('show');
        console.log('Dropdown classes after show:', dropdownElement.className);
        console.log('Dropdown computed style display:', window.getComputedStyle(dropdownElement).display);
        console.log('Dropdown computed style position:', window.getComputedStyle(dropdownElement).position);
        console.log('Dropdown computed style z-index:', window.getComputedStyle(dropdownElement).zIndex);

        // Add click handlers to items
        dropdownElement.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const value = item.getAttribute('data-value');
                onSelect(value);
                this.closeDropdown(dropdownElement);
            });
            
            // Add touch support for mobile devices
            item.addEventListener('touchend', (e) => {
                e.preventDefault(); // Prevent double-firing with click
                const value = item.getAttribute('data-value');
                onSelect(value);
                this.closeDropdown(dropdownElement);
            });
        });

        dropdownElement.classList.add('show');
        this.isOpen = true;
        this.selectedIndex = -1;
    }

    closeDropdown(dropdownElement) {
        dropdownElement.classList.remove('show');
        this.isOpen = false;
        this.selectedIndex = -1;
    }

    handleKeydown(e, dropdownElement, onSelect) {
        if (!this.isOpen) return;

        const items = dropdownElement.querySelectorAll('.autocomplete-item');
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
                this.highlightItem(items);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.highlightItem(items);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0 && this.selectedIndex < items.length) {
                    const value = items[this.selectedIndex].getAttribute('data-value');
                    onSelect(value);
                    this.closeDropdown(dropdownElement);
                }
                break;
                
            case 'Escape':
                this.closeDropdown(dropdownElement);
                break;
        }
    }

    highlightItem(items) {
        items.forEach((item, index) => {
            item.classList.remove('highlighted');
            if (index === this.selectedIndex) {
                item.classList.add('highlighted');
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    // Method to refresh player names (useful when new data is loaded)
    async refreshPlayerNames() {
        await this.loadAllPlayerNames();
    }

    // Method to get player suggestions for removed player autocomplete
    async getPlayerSuggestions(query) {
        const trimmedQuery = query.trim().toLowerCase();
        
        if (trimmedQuery.length < 2) {
            return [];
        }

        // Filter player names based on input
        const suggestions = Array.from(this.allPlayerNames)
            .filter(name => name.toLowerCase().includes(trimmedQuery))
            .sort((a, b) => {
                // Prioritize names that start with the query
                const aStartsWith = a.toLowerCase().startsWith(trimmedQuery);
                const bStartsWith = b.toLowerCase().startsWith(trimmedQuery);
                
                if (aStartsWith && !bStartsWith) return -1;
                if (!aStartsWith && bStartsWith) return 1;
                
                // Then sort alphabetically
                return a.localeCompare(b);
            })
            .slice(0, 10); // Limit to 10 results

        return suggestions;
    }
}
