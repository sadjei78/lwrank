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
            const commander = this.cleanQuotedString(parts[1]);
            
            // Handle different CSV formats
            let points;
            if (parts.length >= 4) {
                // Format: ranking, commander, clan, points
                points = this.extractNumber(parts[3]);
            } else {
                // Format: ranking, commander, points
                points = this.extractNumber(parts[2]);
            }

            if (ranking > 0 && commander && points) {
                rankings.push({
                    ranking: ranking,
                    commander: commander,
                    points: points.toString()
                });
            }
        }

        return rankings;
    }

    extractNumber(str) {
        if (!str) return 0;
        const cleaned = str.replace(/[^\d]/g, '');
        return cleaned ? parseInt(cleaned) : 0;
    }

    cleanQuotedString(str) {
        if (!str) return '';
        return str.replace(/(^"|"$)/g, '').trim();
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
                error: 'Invalid CSV format. Expected at least 3 columns: ranking, commander, points' 
            };
        }

        return { valid: true };
    }
}