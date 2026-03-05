/**
 * Test Script for Product Data Fetcher
 * 
 * Tests the orchestrator API integration from React Native perspective.
 * Run this with: node src/utils/__tests__/testProductFetcher.js
 * 
 * OR import and use in your React Native app for debugging.
 */

// Mock Platform for Node.js testing
global.Platform = {
  OS: 'web'
};

// Import the fetcher
const {
  fetchProductData,
  checkOrchestratorHealth,
  getOrchestratorConfig
} = require('../productDataFetcher');

// Test cases
const TEST_CASES = [
  {
    name: 'Indian Product (Parle-G)',
    barcode: '8901719128462',
    expectedFound: true
  },
  {
    name: 'International Product (Nutella)',
    barcode: '4008400404127',
    expectedFound: true
  },
  {
    name: 'Non-existent Product',
    barcode: '0000000000000',
    expectedFound: false
  },
  {
    name: 'Invalid Barcode (empty)',
    barcode: '',
    expectedFound: false
  }
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Main test runner
async function runTests() {
  console.log('\n' + '='.repeat(70));
  log('cyan', 'Product Data Fetcher - Integration Tests');
  console.log('='.repeat(70) + '\n');
  
  // Step 1: Check API health
  log('yellow', '[Test 0] API Health Check');
  console.log('-'.repeat(70));
  
  const isHealthy = await checkOrchestratorHealth();
  
  if (!isHealthy) {
    log('red', '✗ API is NOT healthy or not running!');
    log('gray', '  Make sure the server is running:');
    log('gray', '  python server/product_data_api.py --reload');
    console.log();
    process.exit(1);
  }
  
  log('green', '✓ API is healthy and running');
  
  const config = getOrchestratorConfig();
  log('gray', `  Base URL: ${config.baseUrl}`);
  log('gray', `  Platform: ${config.platform}`);
  log('gray', `  Timeout: ${config.timeout}ms`);
  console.log();
  
  // Step 2: Run product fetch tests
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    
    log('yellow', `[Test ${i + 1}] ${testCase.name}`);
    console.log('-'.repeat(70));
    
    try {
      const product = await fetchProductData(testCase.barcode);
      
      const found = product !== null;
      const shouldBeFound = testCase.expectedFound;
      
      if (found === shouldBeFound) {
        log('green', `✓ PASS - Expected: ${shouldBeFound ? 'found' : 'not found'}, Got: ${found ? 'found' : 'not found'}`);
        
        if (product) {
          log('gray', `  Product: ${product.product_name || 'Unknown'}`);
          log('gray', `  Brands: ${product.brands || 'N/A'}`);
          log('gray', `  Completeness: ${product.metadata.completeness_score}%`);
          log('gray', `  Confidence: ${product.metadata.confidence}`);
          log('gray', `  Needs Verification: ${product.metadata.needs_verification}`);
          log('gray', `  Source: ${product.metadata.primary_source}`);
          
          if (product.metadata.missing_fields.length > 0) {
            log('gray', `  Missing: ${product.metadata.missing_fields.join(', ')}`);
          }
        }
        
        passed++;
      } else {
        log('red', `✗ FAIL - Expected: ${shouldBeFound ? 'found' : 'not found'}, Got: ${found ? 'found' : 'not found'}`);
        failed++;
      }
      
    } catch (error) {
      log('red', `✗ ERROR - ${error.message}`);
      failed++;
    }
    
    console.log();
  }
  
  // Step 3: Test manual entry fallback scenario
  log('yellow', '[Test 5] Manual Entry Fallback');
  console.log('-'.repeat(70));
  
  const notFoundProduct = await fetchProductData('9999999999999');
  
  if (notFoundProduct === null) {
    log('green', '✓ PASS - Returns null for not found product (triggers manual entry)');
    log('gray', '  This will trigger the "Product Not Found" alert in ScanScreen');
    log('gray', '  User will be prompted to add product manually');
    passed++;
  } else {
    log('red', '✗ FAIL - Should return null for not found product');
    failed++;
  }
  
  console.log();
  
  // Summary
  console.log('='.repeat(70));
  log('cyan', 'Test Results');
  console.log('='.repeat(70));
  
  log('green', `✓ Passed: ${passed}`);
  log('red', `✗ Failed: ${failed}`);
  
  console.log();
  
  if (failed === 0) {
    log('green', '✓ All tests PASSED!');
    log('gray', 'The product data fetcher is working correctly.');
    log('gray', 'Manual entry fallback will work as expected.');
  } else {
    log('red', `✗ ${failed} test(s) FAILED!`);
  }
  
  console.log('='.repeat(70) + '\n');
  
  process.exit(failed === 0 ? 0 : 1);
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    log('red', `\n✗ Test runner error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = { runTests };
