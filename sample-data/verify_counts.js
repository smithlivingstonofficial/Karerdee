const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'questions');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));
console.log('Auditing ' + files.length + ' question CSV files...\n');

let grandTotal = 0;
let allPass = true;

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const count = lines.length - 1;
  grandTotal += count;

  const minRequired = file === 'questions_common.csv' ? 20 : 30;
  const status = count >= minRequired ? 'PASSED' : 'FAILED';
  if (count < minRequired) allPass = false;

  console.log(`${file.padEnd(25)} : ${count} questions (target >= ${minRequired}) [${status}]`);
}

console.log('\n-------------------------------------------------------------');
console.log(`GRAND TOTAL QUESTIONS GENERATED : ${grandTotal}`);
console.log(`ALL CONSTRAINTS SATISFIED       : ${allPass}`);

