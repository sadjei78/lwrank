// Test script to check for JavaScript errors
// This will help identify loading issues

console.log('Testing application loading...');

// Test if main modules can be imported
async function testImports() {
    try {
        console.log('Testing OCR Service import...');
        const { OCRService } = await import('./src/js/ocr-service.js');
        console.log('✅ OCR Service imported successfully');
        
        const ocrService = new OCRService();
        console.log('✅ OCR Service instantiated successfully');
        
        console.log('Testing Rankings Manager import...');
        const { OCRRankingsManager } = await import('./src/js/rankings-manager.js');
        console.log('✅ OCR Rankings Manager imported successfully');
        
        // Don't instantiate RankingsManager here as it needs DOM elements
        console.log('✅ All imports successful');
        
    } catch (error) {
        console.error('❌ Import error:', error);
    }
}

// Test DOM elements
function testDOMElements() {
    console.log('Testing DOM elements...');
    
    const rankingsTab = document.getElementById('rankingsTab');
    if (rankingsTab) {
        console.log('✅ Rankings tab element found');
    } else {
        console.error('❌ Rankings tab element not found');
    }
    
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
        console.log('✅ Messages container found');
    } else {
        console.error('❌ Messages container not found');
    }
    
    const tabsContainer = document.getElementById('tabs');
    if (tabsContainer) {
        console.log('✅ Tabs container found');
    } else {
        console.error('❌ Tabs container not found');
    }
}

// Test Supabase connection
async function testSupabase() {
    try {
        console.log('Testing Supabase connection...');
        const { supabase } = await import('./src/js/supabase-client.js');
        
        const { data, error } = await supabase
            .from('rankings')
            .select('commander')
            .limit(1);
            
        if (error) {
            console.warn('⚠️ Supabase query error:', error.message);
        } else {
            console.log('✅ Supabase connection successful');
        }
    } catch (error) {
        console.error('❌ Supabase test error:', error);
    }
}

// Run all tests
async function runTests() {
    console.log('🧪 Starting application tests...');
    
    await testImports();
    testDOMElements();
    await testSupabase();
    
    console.log('🏁 Tests completed');
}

// Run tests when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runTests);
} else {
    runTests();
}
