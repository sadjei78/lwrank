/**
 * OCR Service for extracting ranking data from screenshots
 * Handles image processing and text extraction for game leaderboards
 */

export class OCRService {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.initCanvas();
    }

    initCanvas() {
        try {
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d');
            if (!this.ctx) {
                throw new Error('Canvas context not supported');
            }
        } catch (error) {
            console.error('Error initializing canvas:', error);
            // Create fallback canvas
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d');
        }
    }

    /**
     * Process uploaded image and extract ranking data
     * @param {File} imageFile - The uploaded image file
     * @returns {Promise<Array>} Array of extracted ranking data
     */
    async processImage(imageFile) {
        try {
            const imageData = await this.loadImage(imageFile);
            const extractedData = await this.extractRankingData(imageData);
            return this.validateAndCleanData(extractedData);
        } catch (error) {
            console.error('Error processing image:', error);
            throw new Error('Failed to process image. Please ensure it\'s a valid screenshot of the rankings screen.');
        }
    }

    /**
     * Load image file and prepare for processing
     * @param {File} imageFile - The image file
     * @returns {Promise<ImageData>} Image data for processing
     */
    async loadImage(imageFile) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.canvas.width = img.width;
                this.canvas.height = img.height;
                this.ctx.drawImage(img, 0, 0);
                const imageData = this.ctx.getImageData(0, 0, img.width, img.height);
                resolve(imageData);
            };
            img.onerror = () => reject(new Error('Invalid image file'));
            img.src = URL.createObjectURL(imageFile);
        });
    }

    /**
     * Extract ranking data from image using OCR simulation
     * This is a simplified version - in production, you'd use a real OCR service
     * @param {ImageData} imageData - The image data to process
     * @returns {Promise<Array>} Extracted ranking data
     */
    async extractRankingData(imageData) {
        // For now, we'll simulate OCR extraction
        // In a real implementation, you'd integrate with services like:
        // - Google Cloud Vision API
        // - AWS Textract
        // - Azure Computer Vision
        // - Tesseract.js for client-side OCR
        
        return new Promise((resolve) => {
            // Simulate processing time
            setTimeout(() => {
                // Return empty array to indicate no data extracted
                // This will prompt the user to manually enter data or try a different image
                resolve([]);
            }, 1000);
        });
    }

    /**
     * Validate and clean extracted data
     * @param {Array} rawData - Raw extracted data
     * @returns {Array} Cleaned and validated data
     */
    validateAndCleanData(rawData) {
        return rawData.map(item => {
            // Clean ranking - ensure it's a number
            const ranking = parseInt(item.ranking) || 0;
            
            // Clean commander name - remove alliance tags and extra whitespace
            let commander = item.commander || '';
            commander = commander.replace(/\[PDX1\]\s*xParaDoXx/gi, '').trim();
            
            // Clean points - remove commas and ensure it's numeric
            let points = item.points || '0';
            points = points.replace(/,/g, '');
            
            return {
                ranking: ranking,
                commander: commander,
                points: points,
                originalCommander: item.commander, // Keep original for reference
                isValid: ranking > 0 && commander.length > 0 && !isNaN(parseInt(points))
            };
        }).filter(item => item.isValid);
    }

    /**
     * Find similar player names in database
     * @param {string} extractedName - Name extracted from OCR
     * @param {Array} existingPlayers - Array of existing player names
     * @returns {Array} Array of similar names with confidence scores
     */
    findSimilarNames(extractedName, existingPlayers) {
        if (!extractedName || !existingPlayers) return [];
        
        const similarities = existingPlayers.map(player => ({
            name: player,
            confidence: this.calculateSimilarity(extractedName.toLowerCase(), player.toLowerCase())
        }));
        
        return similarities
            .filter(sim => sim.confidence > 0.3) // Only return reasonably similar names
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5); // Return top 5 matches
    }

    /**
     * Calculate string similarity using Levenshtein distance
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Similarity score between 0 and 1
     */
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
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
     * Process image with real OCR service (placeholder for future implementation)
     * @param {File} imageFile - Image file to process
     * @returns {Promise<Array>} Extracted data
     */
    async processWithRealOCR(imageFile) {
        // This would integrate with a real OCR service
        // Example with Google Cloud Vision API:
        /*
        const vision = require('@google-cloud/vision');
        const client = new vision.ImageAnnotatorClient();
        
        const [result] = await client.textDetection({
            image: {
                content: await imageFile.arrayBuffer()
            }
        });
        
        const detections = result.textAnnotations;
        return this.parseOCRResults(detections);
        */
        
        throw new Error('Real OCR service not implemented yet');
    }

    /**
     * Parse OCR results into structured data
     * @param {Array} ocrResults - Raw OCR results
     * @returns {Array} Structured ranking data
     */
    parseOCRResults(ocrResults) {
        // This would parse the OCR results based on the detected text positions
        // and extract ranking, commander names, and points
        // Implementation would depend on the specific OCR service used
        
        return [];
    }
}
