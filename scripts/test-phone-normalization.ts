import { normalizePhone } from '../server/lib/phone-utils';

console.log('🧪 Testing phone normalization...\n');

const testCases = [
  // Correct format (should stay the same)
  { input: '5522997074180', expected: '5522997074180', description: 'Already correct (13 digits)' },
  { input: '5524992504803', expected: '5524992504803', description: 'Already correct (13 digits)' },
  
  // Duplicated "55" prefix (15 digits)
  { input: '555524992630536', expected: '5524992630536', description: 'Remove duplicate 55 (15 -> 13 digits)' },
  { input: '555524988229936', expected: '5524988229936', description: 'Remove duplicate 55 (15 -> 13 digits)' },
  
  // Triple "55" prefix (17 digits)
  { input: '55555524992630536', expected: '5524992630536', description: 'Remove two duplicate 55 (17 -> 13 digits)' },
  
  // Suspicious 13-digit with "555X" DDD pattern (likely duplicated)
  { input: '5551998463086', expected: '5551998463086', description: 'DDD 51 Porto Alegre (valid, keep as-is)' },
  
  // Without country code (should add "55")
  { input: '24992504803', expected: '5524992504803', description: 'Add missing 55 prefix (11 -> 13 digits)' },
  { input: '2499207033', expected: '552499207033', description: 'Add missing 55 prefix (10 -> 12 digits)' },
  
  // Formatted numbers (should clean and normalize)
  { input: '(24) 99920-7033', expected: '5524999207033', description: 'Clean formatting and add 55' },
  { input: '+55 24 99920-7033', expected: '5524999207033', description: 'Remove + and spaces' },
];

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = normalizePhone(test.input);
  const success = result === test.expected;
  
  if (success) {
    console.log(`✅ PASS: ${test.description}`);
    console.log(`   Input: ${test.input} -> ${result}\n`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${test.description}`);
    console.log(`   Input: ${test.input}`);
    console.log(`   Expected: ${test.expected}`);
    console.log(`   Got: ${result}\n`);
    failed++;
  }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
process.exit(failed > 0 ? 1 : 0);
