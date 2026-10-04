import fs from 'fs';
import path from 'path';
import * as mockData from '../src/lib/mockData.js';

console.log('--- 1. Testing mockData.js contents ---');
console.log('INITIAL_PROFILES count:', mockData.INITIAL_PROFILES.length);
if (mockData.INITIAL_PROFILES.length !== 1 || mockData.INITIAL_PROFILES[0].role !== 'manager') {
  console.error('FAIL: INITIAL_PROFILES should contain ONLY 1 manager account.');
  process.exit(1);
}
console.log('Manager profile verified:', mockData.INITIAL_PROFILES[0].email, `(${mockData.INITIAL_PROFILES[0].role})`);

const emptyArrays = [
  'INITIAL_ROUTES',
  'INITIAL_CUSTOMERS',
  'INITIAL_STATIONS',
  'INITIAL_PRODUCTS',
  'INITIAL_STAFF_ROUTE_ASSIGNMENTS',
  'INITIAL_STAFF_STATION_ASSIGNMENTS',
  'INITIAL_DELIVERIES',
  'INITIAL_ADVANCES',
  'INITIAL_TRANSACTIONS',
  'INITIAL_VEHICLES',
  'INITIAL_FACTORY_INTAKES',
  'INITIAL_VEHICLE_CONSUMPTIONS',
  'INITIAL_EVERYDAY_EXPENSES',
  'INITIAL_FOOD_ALLOWANCES',
];

for (const arrName of emptyArrays) {
  const arr = mockData[arrName];
  if (!Array.isArray(arr) || arr.length !== 0) {
    console.error(`FAIL: ${arrName} is not an empty array. Length: ${arr?.length}`);
    process.exit(1);
  }
}
console.log('PASS: All 14 data arrays in mockData.js are completely empty [].');

console.log('\n--- 2. Verifying Codebase for Demo/Mock Tokens ---');
const srcDir = path.resolve('src');

function scanDir(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      files = files.concat(scanDir(full));
    } else if (full.endsWith('.js') || full.endsWith('.jsx')) {
      files.push(full);
    }
  }
  return files;
}

const files = scanDir(srcDir);
const forbiddenPatterns = [
  { name: 'Demo Driver Suresh', regex: /driver\.suresh/i },
  { name: 'Hardcoded Demo Plate MH-46-H-9921', regex: /MH-46-H-9921/ },
  { name: 'Hardcoded Mock Intakes Fallback', regex: /Terminal Refinery Gate #1/ },
  { name: 'Hardcoded Fake UTR Fallback', regex: /UTR-WIRE-449120/ },
  { name: 'Synthetic Staff Auth Bypass', regex: /syntheticStaff/ },
  { name: 'Old Demo Staff usr-stf-1', regex: /usr-stf-1/ },
];

let violations = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pat of forbiddenPatterns) {
    if (pat.regex.test(content)) {
      console.error(`VIOLATION: Found '${pat.name}' in ${path.relative(srcDir, file)}`);
      violations++;
    }
  }
}

if (violations === 0) {
  console.log('PASS: Zero forbidden demo tokens found across all .js and .jsx files.');
} else {
  console.error(`FAIL: ${violations} forbidden pattern matches found.`);
  process.exit(1);
}

console.log('\n--- ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ---');
