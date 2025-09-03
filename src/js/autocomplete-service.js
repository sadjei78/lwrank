export class AutocompleteService {
    constructor(rankingManager, leaderVIPManager) {
        this.rankingManager = rankingManager;
        this.leaderVIPManager = leaderVIPManager;
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

    setupAutocomplete(inputElement, dropdownElement, onSelect, excludeLeaders = false, excludeRemoved = false) {
        let debounceTimer;
        
        // Input event handler
        inputElement.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.handleInput(e.target.value, dropdownElement, onSelect, excludeLeaders, excludeRemoved);
            }, 150); // Debounce for better performance
        });

        // Focus event handler
        inputElement.addEventListener('focus', () => {
            if (inputElement.value.trim()) {
                this.handleInput(inputElement.value, dropdownElement, onSelect, excludeLeaders, excludeRemoved);
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

    handleInput(value, dropdownElement, onSelect, excludeLeaders = false, excludeRemoved = false) {
        const query = value.trim().toLowerCase();
        
        console.log('Autocomplete handleInput called:', { value, query, excludeLeaders, excludeRemoved });
        console.log('All player names count:', this.allPlayerNames.size);
        console.log('Dropdown element:', dropdownElement);
        
        if (query.length === 0) {
            this.closeDropdown(dropdownElement);
            return;
        }

        // Get player names, optionally excluding leaders and removed players
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
            names.forEach((name, index) => {
                html += `<div class="autocomplete-item" data-index="${index}" data-value="${name}">${name}</div>`;
            });
            dropdownElement.innerHTML = html;
        }

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
