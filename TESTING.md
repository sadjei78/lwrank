# OCR Rankings Testing with Playwright

This directory contains Playwright tests for the OCR Rankings Management functionality.

## Setup

1. **Install Playwright dependencies:**
   ```bash
   npm install
   npx playwright install
   ```

2. **Add your test screenshots:**
   Place your ranking screenshots in the `test-screenshots/` directory:
   ```
   test-screenshots/
   ├── sample-ranking.png      # Your actual ranking screenshot
   ├── empty-image.png        # Empty image for testing manual entry
   └── other-test-images.png  # Additional test images
   ```

## Running Tests

### Run all tests:
```bash
npm run test
```

### Run tests with UI (interactive):
```bash
npm run test:ui
```

### Run tests in headed mode (see browser):
```bash
npm run test:headed
```

### Run specific test file:
```bash
npx playwright test tests/ocr-rankings.spec.js
```

## Test Screenshots

### Where to put your screenshot files:

1. **Main test screenshot** - `test-screenshots/sample-ranking.png`
   - This should be your actual ranking screenshot
   - The test will upload this file and test the OCR processing
   - If OCR fails, it will test the manual entry fallback

2. **Empty image** - `test-screenshots/empty-image.png`
   - Already created (1x1 pixel PNG)
   - Used to test manual entry functionality
   - Triggers the "no data extracted" flow

### Adding your own test images:

1. **Copy your ranking screenshot:**
   ```bash
   cp /path/to/your/ranking-screenshot.png test-screenshots/sample-ranking.png
   ```

2. **Or rename your file:**
   ```bash
   mv your-screenshot.png test-screenshots/sample-ranking.png
   ```

## Test Coverage

The tests cover:

- ✅ **Interface Loading** - Verifies all UI elements are present
- ✅ **File Upload** - Tests drag & drop and file selection
- ✅ **OCR Processing** - Tests image processing workflow
- ✅ **Manual Entry** - Tests fallback when OCR fails
- ✅ **Data Entry** - Tests manual data input functionality
- ✅ **Player Search** - Tests search functionality
- ✅ **Performance View** - Tests dropdown functionality

## Test Results

Tests will generate:
- **HTML Report** - `playwright-report/index.html`
- **Screenshots** - On test failures
- **Videos** - On test failures
- **Traces** - For debugging failed tests

## Debugging

If tests fail:

1. **Check the HTML report:**
   ```bash
   npx playwright show-report
   ```

2. **Run in headed mode to see what's happening:**
   ```bash
   npm run test:headed
   ```

3. **Use the UI mode for interactive debugging:**
   ```bash
   npm run test:ui
   ```

## File Structure

```
tests/
├── ocr-rankings.spec.js     # Main test file
test-screenshots/
├── sample-ranking.png        # Your ranking screenshot (add this)
├── empty-image.png          # Empty test image (already created)
playwright.config.js         # Playwright configuration
```

## Notes

- The tests expect the development server to be running on `http://localhost:5173`
- Tests will automatically start the dev server if it's not running
- The OCR service currently returns empty data (for testing manual entry)
- Database errors are expected in offline mode and are handled gracefully
