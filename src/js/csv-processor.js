export class CSVProcessor {
    processFile(file, callback) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const csv = e.target.result.trim();
            
            if (!csv) {
                alert('CSV file is empty.');
                return;
            }
            
            const rankings = this.parseCSV(csv);
            callback(rankings);
        };
        
        reader.onerror = () => {
            alert('Error reading CSV file.');
        };
        
        reader.readAsText(file);
    }

    processCSVText(csvText) {
        if (!csvText || csvText.trim().length === 0) {
            throw new Error('CSV text is empty.');
        }
        
        return this.parseCSV(csvText);
    }

    parseCSV(csvContent) {
        const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
        const rankings = [];
        let hasHeader = false;

        // Detect header
        if (lines.length > 0 && lines[0].toLowerCase().includes('ranking') && lines[0].toLowerCase().includes('commander')) {
            hasHeader = true;
        }

        const startIndex = hasHeader ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            
            // Split by comma, but handle quoted fields
            const parts = line.match(/("[^"]*"|[^,]+)/g);
            
            if (!parts || parts.length < 3) {
                continue;
            }

            const ranking = this.extractNumber(parts[0]);
            
            // Clean commander name and remove faction tags
            let commander = this.cleanQuotedString(parts[1]);
            commander = this.removeFactionTags(commander);
            
            // Skip if commander name is empty (was a faction entry)
            if (!commander || commander.trim() === '') {
                continue;
            }

            // Always use the last column for points, regardless of format
            // This excludes faction/clan columns that might be in the middle
            let points;
            if (parts.length >= 3) {
                // Use the last column for points (excludes faction/clan)
                const rawPoints = parts[parts.length - 1];
                points = this.extractNumber(rawPoints);
                
                // Debug: Log the original points value
                if (points > 1000000) {
                    console.log(`Original points value: "${rawPoints}" -> parsed as: ${points}`);
                }
            } else {
                continue; // Skip if not enough columns
            }

            if (ranking > 0 && commander && points) {
                rankings.push({
                    ranking: ranking,
                    commander: commander,
                    points: parseInt(points) // Ensure points is stored as integer
                });
            }
        }

        return rankings;
    }

    extractNumber(str) {
        if (!str) return 0;
        
        // Remove quotes and trim
        let cleaned = str.replace(/(^"|"$)/g, '').trim();
        
        // Handle comma-separated numbers (e.g., "87,264,360" -> 87264360)
        if (cleaned.includes(',')) {
            cleaned = cleaned.replace(/,/g, '');
        }
        
        // Handle period-separated numbers (e.g., "87.264.360" -> 87264360)
        if (cleaned.includes('.') && !cleaned.includes('e') && !cleaned.includes('E')) {
            cleaned = cleaned.replace(/\./g, '');
        }
        
        // Extract only digits
        const digits = cleaned.replace(/[^\d]/g, '');
        
        // Convert to integer, but limit to reasonable size
        const result = digits ? parseInt(digits) : 0;
        
        // Log if we're getting unusually large numbers
        if (result > 1000000) {
            console.warn(`Large number detected: ${str} -> ${result}`);
        }
        
        return result;
    }

    cleanQuotedString(str) {
        if (!str) return '';
        return str.replace(/(^"|"$)/g, '').trim();
    }

    removeFactionTags(commanderName) {
        if (!commanderName) return '';
        
        const original = commanderName;
        
        // Check if this is a pure faction entry (contains faction tags)
        const hasFactionTags = /\[[^\]]*\]/.test(original);
        
        if (hasFactionTags) {
            console.log(`Removed entire faction entry: "${original}"`);
            return ''; // Return empty to filter out this entry
        }
        
        // For regular commander names, remove any faction tags that might be present
        let cleaned = commanderName.replace(/\[[^\]]*\]/g, '');
        cleaned = cleaned.replace(/\([^)]*\)/g, ''); // Remove parentheses content
        cleaned = cleaned.replace(/<[^>]*>/g, ''); // Remove angle brackets content
        
        // Clean up extra spaces that might be left
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        // Log if faction tags were removed
        if (original !== cleaned) {
            console.log(`Removed faction tags: "${original}" → "${cleaned}"`);
        }
        
        return cleaned;
    }

    validateCSVFormat(csvContent) {
        const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
        
        if (lines.length === 0) {
            return { valid: false, error: 'CSV file is empty' };
        }

        // Check if first line looks like a header
        const firstLine = lines[0].toLowerCase();
        const hasValidHeader = firstLine.includes('ranking') || firstLine.includes('rank');

        // Check if we have at least one data line
        const dataStartIndex = hasValidHeader ? 1 : 0;
        if (lines.length <= dataStartIndex) {
            return { valid: false, error: 'No data rows found in CSV' };
        }

        // Validate format of first data row
        const firstDataLine = lines[dataStartIndex];
        const parts = firstDataLine.match(/("[^"]*"|[^,]+)/g);
        
        if (!parts || parts.length < 3) {
            return { 
                valid: false, 
                error: 'Invalid CSV format. Expected at least 3 columns: ranking, commander, points (faction/clan columns will be ignored)' 
            };
        }

        return { valid: true };
    }
}