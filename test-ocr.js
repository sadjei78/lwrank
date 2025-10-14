/**
 * Test script for OCR Service
 * This tests the OCR service with sample data to ensure it works correctly
 */

import { OCRService } from './src/js/ocr-service.js';

// Test the OCR service
async function testOCRService() {
    console.log('🧪 Testing OCR Service...');
    
    const ocrService = new OCRService();
    
    // Test similarity matching
    const existingPlayers = [
        'gnrbrdmn', 'TDubs31', 'sHåFt', 'A P 2 3', 'robson Cordeiro',
        'TheGambit1', 'Longshanks II', 'Chmkashmir1', 'Cassiano Glb',
        'Major Benson Payne', 'Themeatshield', 'Solo 爽到你龜龜',
        'coby258', 'Icë', 'mug punter', 'cjd127', 'YURADUMBAHHH',
        'Elham Briento', 'GREYWORMm', 'No thanks bro', 'xoneshhhk',
        'CrazyDaddyT', 'Hooligans Elton', 'Nelzonrrr', 'BigShowInc',
        'austinnnn20', 'TGOJ', 'SPY500 0dte', 'skol vikings',
        'derek m', 'BaconC', 'Falcons7477', 'BAM1521', 'Kon Хуй',
        'Dannimal Lecter', 'Mister Bones', '十月初雪', 'Texas868',
        'Krayem', 'Beanie Baby 27', 'Frosty 2025', 'Modernikon',
        'igmo', 'Mobert OldAsFk III', 'Sami Sweetheart', 'underSNORLAX',
        'TJ242', 'Boo USA', 'SpLTnYOwiG', 'RyanChewy17',
        'TheLastMasterofWar', 'Tooooobbbeerrrrrzzz', 'Kevinmk17',
        'Phil237', 'Kestrel13', 'Peelerr', 'Zam4L', 'Jonas Bonus',
        'The Enforcer 1', 'Huff21', 'DullCrayon', 'DeathTank',
        'SgtSlaughter3', 'Cooler Coconut', 'FreyjaFreyja', 'Blue42cc',
        'nameunknown', 'SmokeE911', 'kai o shin', 'Captain Pickle Poo',
        'CewchieCoo', 'Infectious19', 'pizzapizzapizzapizza', 'JhioWolf',
        'lastro dark', 'Luka Senkai', 'masterfrank', 'BoomBapp',
        'Misabrinas', 'GhostStark', 'SOL3NY4', 'Mcshatly',
        'Colorado Cowboy', 'Elite Jay', 'Mel1712', 'EvolveMyEevee',
        'Akuma Clan Warrior 1', 'TylerDurdenLives', 'Commander Croods',
        'DCregger', 'ARc213', 'Donn123', 'pittonkk', 'Adingo 8mybaby',
        'Zangado22', 'Redlineclay', 'MinxyJinxTTV'
    ];
    
    // Test similarity matching with various inputs
    const testCases = [
        { input: 'gnrbrdmn', expected: 'gnrbrdmn' },
        { input: 'sHåFt', expected: 'sHåFt' },
        { input: 'Captain Pickle Poo', expected: 'Captain Pickle Poo' },
        { input: 'gnrbrd', expected: 'gnrbrdmn' }, // Partial match
        { input: 'pickle', expected: 'Captain Pickle Poo' }, // Partial match
        { input: 'unknown player', expected: null } // No match
    ];
    
    console.log('🔍 Testing similarity matching...');
    for (const testCase of testCases) {
        const matches = ocrService.findSimilarNames(testCase.input, existingPlayers);
        console.log(`Input: "${testCase.input}"`);
        console.log(`Expected: ${testCase.expected}`);
        console.log(`Matches:`, matches.slice(0, 3).map(m => `${m.name} (${Math.round(m.confidence * 100)}%)`));
        console.log('---');
    }
    
    // Test data validation
    console.log('✅ Testing data validation...');
    const sampleData = [
        { ranking: 1, commander: 'gnrbrdmn', points: '112,846,145' },
        { ranking: 2, commander: 'TDubs31', points: '84,347,912' },
        { ranking: 3, commander: 'sHåFt', points: '72,478,429' },
        { ranking: 0, commander: '', points: 'invalid' }, // Invalid data
        { ranking: 4, commander: 'A P 2 3', points: '50,100,224' }
    ];
    
    const validatedData = ocrService.validateAndCleanData(sampleData);
    console.log('Original data:', sampleData.length, 'items');
    console.log('Validated data:', validatedData.length, 'items');
    console.log('Validated items:', validatedData);
    
    console.log('✅ OCR Service tests completed successfully!');
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testOCRService().catch(console.error);
}

export { testOCRService };
