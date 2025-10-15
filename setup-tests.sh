#!/bin/bash

# Script to help add test screenshots for Playwright testing

echo "🎯 OCR Rankings Test Setup"
echo "========================="
echo ""

# Check if test-screenshots directory exists
if [ ! -d "test-screenshots" ]; then
    echo "❌ test-screenshots directory not found!"
    exit 1
fi

echo "📁 Test screenshots directory: $(pwd)/test-screenshots"
echo ""

# Check for existing files
if [ -f "test-screenshots/sample-ranking.png" ]; then
    echo "✅ sample-ranking.png already exists"
else
    echo "❌ sample-ranking.png not found"
    echo "   Please add your ranking screenshot as 'sample-ranking.png'"
fi

if [ -f "test-screenshots/empty-image.png" ]; then
    echo "✅ empty-image.png exists (for testing manual entry)"
else
    echo "❌ empty-image.png not found"
fi

echo ""
echo "📋 To add your ranking screenshot:"
echo "   1. Copy your screenshot to: test-screenshots/sample-ranking.png"
echo "   2. Or run: cp /path/to/your/screenshot.png test-screenshots/sample-ranking.png"
echo ""
echo "🧪 To run the tests:"
echo "   npm run test          # Run all tests"
echo "   npm run test:ui       # Interactive UI mode"
echo "   npm run test:headed   # See browser while testing"
echo ""
echo "📊 Test results will be in: playwright-report/index.html"
