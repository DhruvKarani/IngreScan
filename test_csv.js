import { importFromCSV } from './csv-import.js';

/**
 * Simple CSV import test
 */
async function testCSVImport() {
  console.log('🧪 Testing CSV Import System');
  console.log('============================\n');
  
  try {
    const results = await importFromCSV('india_products_25plus_simple.csv', {
      getEnhancedDetails: true,
      delayBetweenRequests: 100  // 100ms delay for testing
    });
    
    console.log('\n🎉 Import completed successfully!');
    console.log(`📊 Results: ${results.successful}/${results.totalProducts} successful`);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
  }
}

testCSVImport();