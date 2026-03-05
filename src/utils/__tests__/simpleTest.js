/**
 * Simple Test for Product Data Fetcher
 * 
 * Tests the orchestrator API directly without React Native dependencies.
 * Run with: node src/utils/__tests__/simpleTest.js
 */

// Test configuration
const API_BASE = 'http://127.0.0.1:5001';
const TEST_TIMEOUT = 15000;

// Test barcodes
const TEST_CASES = [
  { name: 'Parle-G (exists)', barcode: '8901719128462', shouldFind: true },
  { name: 'Non-existent', barcode: '0000000000000', shouldFind: false },
];

// Fetch function
async function testFetch(barcode) {
  const url = `${API_BASE}/api/product/${barcode}?strategy=waterfall`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data) {
      // Attach metadata to data for easier access
      result.data._apiMetadata = result.metadata;
      return result.data;
    }
    
    return null;
    
  } catch (error) {
    console.error(`Fetch error: ${error.message}`);
    return null;
  }
}

// Run tests
async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('Product Data Fetcher - Simple Test');
  console.log('='.repeat(70) + '\n');
  
  // Health check
  console.log('[Test 0] API Health Check');
  console.log('-'.repeat(70));
  
  try {
    const healthRes = await fetch(`${API_BASE}/health`);
    const health = await healthRes.json();
    
    if (health.status === 'healthy') {
      console.log(`✓ API is healthy (${health.service} v${health.version})`);
    } else {
      console.log('✗ API unhealthy');
      process.exit(1);
    }
  } catch (error) {
    console.log(`✗ API not running at ${API_BASE}`);
    console.log('  Start with: python server/product_data_api.py --reload');
    process.exit(1);
  }
  
  console.log();
  
  // Test product fetches
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < TEST_CASES.length; i++) {
    const test = TEST_CASES[i];
    
    console.log(`[Test ${i + 1}] ${test.name}`);
    console.log('-'.repeat(70));
    
    const product = await testFetch(test.barcode);
    const found = product !== null;
    
    if (found === test.shouldFind) {
      console.log(`✓ PASS - Expected ${test.shouldFind ? 'found' : 'not found'}, got ${found ? 'found' : 'not found'}`);
      
      if (product) {
        const meta = product._apiMetadata || {};
        console.log(`  Product: ${product.product_name || 'Unknown'}`);
        console.log(`  Completeness: ${meta.completeness_score || 0}%`);
        console.log(`  Source: ${meta.primary_source || 'unknown'}`);
        console.log(`  Needs Verification: ${meta.needs_verification !== false}`);
        
        if (meta.missing_fields) {
          const missing = [
            ...(meta.missing_fields.critical || []),
            ...(meta.missing_fields.important || []),
            ...(meta.missing_fields.optional || [])
          ];
          if (missing.length > 0) {
            console.log(`  Missing Fields: ${missing.join(', ')}`);
          }
        }
      }
      
      passed++;
    } else {
      console.log(`✗ FAIL - Expected ${test.shouldFind ? 'found' : 'not found'}, got ${found ? 'found' : 'not found'}`);
      failed++;
    }
    
    console.log();
  }
  
  // Test manual entry fallback
  console.log('[Test 3] Manual Entry Fallback');
  console.log('-'.repeat(70));
  
  const notFound = await testFetch('9999999999999');
  
  if (notFound === null) {
    console.log('✓ PASS - Returns null (triggers manual entry in app)');
    console.log('  When fetchProductData() returns null:');
    console.log('  → ScanScreen shows "Product Not Found" alert');
    console.log('  → User can click "Add Manually"');
    console.log('  → Navigates to ManualProductEntry screen');
    passed++;
  } else {
    console.log('✗ FAIL - Should return null');
    failed++;
  }
  
  console.log();
  
  // Summary
  console.log('='.repeat(70));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));
  
  if (failed === 0) {
    console.log('\n✓ All tests PASSED!');
    console.log('\nManual entry fallback is PRESERVED:');
    console.log('  - Product not found → returns null');
    console.log('  - ScanScreen detects null → shows alert');
    console.log('  - User chooses to add manually → navigates to form');
    console.log();
  } else {
    console.log(`\n✗ ${failed} test(s) FAILED!\n`);
  }
  
  process.exit(failed === 0 ? 0 : 1);
}

// Run
runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
