// Playwright test for OCR Rankings functionality
// This script tests the upload and OCR processing features

import { test, expect } from '@playwright/test';

test.describe('OCR Rankings Management', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application
        await page.goto('http://localhost:5173');
        
        // Wait for the page to load
        await page.waitForLoadState('networkidle');
        
        // Click on the Rankings tab
        await page.getByRole('button', { name: '📷 Rankings' }).click();
        
        // Wait for the rankings page to load
        await page.waitForSelector('#rankingsTab', { state: 'visible' });
    });

    test('should display rankings management interface', async ({ page }) => {
        // Check that the rankings page elements are visible
        await expect(page.getByRole('heading', { name: '📊 Rankings Management' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Upload Ranking Screenshot' })).toBeVisible();
        await expect(page.getByRole('heading', { name: '🔍 Player Search & Performance' })).toBeVisible();
        await expect(page.getByRole('heading', { name: '📈 30-Day Performance View' })).toBeVisible();
        
        // Check that the upload area is present
        await expect(page.locator('#uploadArea')).toBeVisible();
        
        // Check that the date picker is present
        await expect(page.getByLabel('Ranking Date:')).toBeVisible();
        
        // Check that search input is present
        await expect(page.getByPlaceholder('Search for a player...')).toBeVisible();
    });

    test('should handle file upload', async ({ page }) => {
        // Set the ranking date
        await page.getByLabel('Ranking Date:').fill('2025-10-15');
        
        // Create a test image file (you can replace this with your actual screenshot)
        const testImagePath = './test-screenshots/sample-ranking.png';
        
        // Set up file chooser
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.locator('#uploadArea').click();
        const fileChooser = await fileChooserPromise;
        
        // Upload the file
        await fileChooser.setFiles(testImagePath);
        
        // Wait for processing to start
        await expect(page.locator('#processingSection')).toBeVisible();
        
        // Wait for results to appear (or manual entry form)
        await page.waitForSelector('#resultsSection, .manual-entry-section', { timeout: 10000 });
        
        // Check that either results or manual entry form is shown
        const hasResults = await page.locator('#resultsSection').isVisible();
        const hasManualEntry = await page.locator('.manual-entry-section').isVisible();
        
        expect(hasResults || hasManualEntry).toBeTruthy();
    });

    test('should show manual entry form when no data extracted', async ({ page }) => {
        // This test simulates the case where OCR fails to extract data
        // and the manual entry form should appear
        
        // Set the ranking date
        await page.getByLabel('Ranking Date:').fill('2025-10-15');
        
        // Create a simple test image (1x1 pixel PNG)
        const testImagePath = './test-screenshots/empty-image.png';
        
        // Set up file chooser
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.locator('#uploadArea').click();
        const fileChooser = await fileChooserPromise;
        
        // Upload the file
        await fileChooser.setFiles(testImagePath);
        
        // Wait for processing
        await page.waitForSelector('#processingSection', { state: 'visible' });
        
        // Wait for manual entry form to appear
        await page.waitForSelector('.manual-entry-section', { timeout: 10000 });
        
        // Check that manual entry form is visible
        await expect(page.getByText('📝 Manual Data Entry')).toBeVisible();
        await expect(page.getByText('No data was extracted from the image')).toBeVisible();
        await expect(page.getByLabel('Number of Rankings:')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Generate Rows' })).toBeVisible();
    });

    test('should generate manual entry rows', async ({ page }) => {
        // First trigger the manual entry form (using empty image)
        await page.getByLabel('Ranking Date:').fill('2025-10-15');
        
        const testImagePath = './test-screenshots/empty-image.png';
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.locator('#uploadArea').click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(testImagePath);
        
        // Wait for manual entry form
        await page.waitForSelector('.manual-entry-section', { timeout: 10000 });
        
        // Set number of rankings to 5
        await page.getByLabel('Number of Rankings:').fill('5');
        
        // Click generate rows button
        await page.getByRole('button', { name: 'Generate Rows' }).click();
        
        // Check that the data table appears
        await expect(page.locator('#manualDataTable')).toBeVisible();
        
        // Check that 5 rows are generated
        const rows = page.locator('#manualTableBody .table-row');
        await expect(rows).toHaveCount(5);
        
        // Check that each row has the correct structure
        for (let i = 1; i <= 5; i++) {
            await expect(page.locator(`#manualTableBody .table-row:nth-child(${i}) .ranking-number`)).toHaveText(i.toString());
            await expect(page.locator(`#manualTableBody .table-row:nth-child(${i}) .commander-input`)).toBeVisible();
            await expect(page.locator(`#manualTableBody .table-row:nth-child(${i}) .points-input`)).toBeVisible();
        }
    });

    test('should allow manual data entry', async ({ page }) => {
        // Generate manual entry rows first
        await page.getByLabel('Ranking Date:').fill('2025-10-15');
        
        const testImagePath = './test-screenshots/empty-image.png';
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.locator('#uploadArea').click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(testImagePath);
        
        await page.waitForSelector('.manual-entry-section', { timeout: 10000 });
        await page.getByLabel('Number of Rankings:').fill('3');
        await page.getByRole('button', { name: 'Generate Rows' }).click();
        
        // Fill in some test data
        await page.locator('#manualTableBody .table-row:nth-child(1) .commander-input').fill('TestPlayer1');
        await page.locator('#manualTableBody .table-row:nth-child(1) .points-input').fill('1000000');
        
        await page.locator('#manualTableBody .table-row:nth-child(2) .commander-input').fill('TestPlayer2');
        await page.locator('#manualTableBody .table-row:nth-child(2) .points-input').fill('900000');
        
        await page.locator('#manualTableBody .table-row:nth-child(3) .commander-input').fill('TestPlayer3');
        await page.locator('#manualTableBody .table-row:nth-child(3) .points-input').fill('800000');
        
        // Verify the data was entered correctly
        await expect(page.locator('#manualTableBody .table-row:nth-child(1) .commander-input')).toHaveValue('TestPlayer1');
        await expect(page.locator('#manualTableBody .table-row:nth-child(1) .points-input')).toHaveValue('1000000');
        
        await expect(page.locator('#manualTableBody .table-row:nth-child(2) .commander-input')).toHaveValue('TestPlayer2');
        await expect(page.locator('#manualTableBody .table-row:nth-child(2) .points-input')).toHaveValue('900000');
        
        await expect(page.locator('#manualTableBody .table-row:nth-child(3) .commander-input')).toHaveValue('TestPlayer3');
        await expect(page.locator('#manualTableBody .table-row:nth-child(3) .points-input')).toHaveValue('800000');
    });

    test('should handle player search', async ({ page }) => {
        // Test the search functionality
        await page.getByPlaceholder('Search for a player...').fill('test');
        await page.getByRole('button', { name: 'Search' }).click();
        
        // Check that search was triggered (we expect an error in offline mode)
        await expect(page.locator('.message-error')).toBeVisible();
        
        // The error message should contain information about the search
        const errorMessage = await page.locator('.message-error').textContent();
        expect(errorMessage).toContain('Error searching players');
    });

    test('should display performance dropdown', async ({ page }) => {
        // Check that the performance dropdown is present
        await expect(page.locator('#playerPerformanceSelect')).toBeVisible();
        
        // Check that it has the default option
        await expect(page.locator('#playerPerformanceSelect option[value=""]')).toHaveText('Select a player to view performance...');
    });
});
