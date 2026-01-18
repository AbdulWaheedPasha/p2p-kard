/**
 * OFAC Sanctions Provider Test Script
 *
 * Run with: npx tsx src/test-ofac.ts
 *
 * Tests the sanctions screening against:
 * 1. Known sanctioned individual (should match)
 * 2. Misspelled name (tests fuzzy matching)
 * 3. Regular name (should be clear)
 */

import { OfacProvider } from './providers/OfacProvider.js';

const provider = new OfacProvider();

async function main() {
  console.log('\n🔍 OFAC Sanctions Provider Test\n');
  console.log('='.repeat(60));

  // Test 1: Known sanctioned individual
  console.log('\n📋 Test 1: Known sanctioned name (Vladimir Putin)');
  console.log('-'.repeat(60));
  try {
    const result1 = await provider.checkSanctions('Vladimir Putin');
    console.log(`Clear: ${result1.clear}`);
    console.log(`Matches: ${result1.matches.length}`);
    if (result1.matches.length > 0) {
      console.log('Match details:');
      result1.matches.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.matchedName}`);
        console.log(`     List: ${m.listName}, Score: ${m.matchScore}, Type: ${m.matchType}`);
      });
    }
    console.log(`✅ Expected: Match found = ${!result1.clear ? 'PASS' : 'FAIL'}`);
  } catch (err) {
    console.error(`❌ Error: ${(err as Error).message}`);
  }

  // Test 2: Misspelled name (fuzzy matching test)
  console.log('\n📋 Test 2: Misspelled name (Vladmir Putn)');
  console.log('-'.repeat(60));
  try {
    const result2 = await provider.checkSanctions('Vladmir Putn');
    console.log(`Clear: ${result2.clear}`);
    console.log(`Matches: ${result2.matches.length}`);
    if (result2.matches.length > 0) {
      console.log('Match details:');
      result2.matches.slice(0, 3).forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.matchedName}`);
        console.log(`     List: ${m.listName}, Score: ${m.matchScore}, Type: ${m.matchType}`);
      });
    }
    console.log(`ℹ️  Fuzzy matching: ${!result2.clear ? 'Found matches' : 'No matches'}`);
  } catch (err) {
    console.error(`❌ Error: ${(err as Error).message}`);
  }

  // Test 3: Regular name (should be clear)
  console.log('\n📋 Test 3: Regular name (John Smith)');
  console.log('-'.repeat(60));
  try {
    const result3 = await provider.checkSanctions('John Smith');
    console.log(`Clear: ${result3.clear}`);
    console.log(`Matches: ${result3.matches.length}`);
    if (result3.matches.length > 0) {
      console.log('⚠️  Unexpected matches:');
      result3.matches.slice(0, 3).forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.matchedName} (${m.listName})`);
      });
    }
    console.log(`✅ Expected: Clear = ${result3.clear ? 'PASS' : 'FAIL (false positive)'}`);
  } catch (err) {
    console.error(`❌ Error: ${(err as Error).message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete\n');
}

main().catch(console.error);
