const fs = require("fs");
const path = require("path");

function parseCsvLine(line) {
  const values = [];
  let currentVal = "";
  let inQuotes = false;

  for (let c = 0; c < line.length; c++) {
    const char = line[c];
    if (char === '"') {
      if (inQuotes && line[c + 1] === '"') {
        currentVal += '"';
        c++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(currentVal.trim());
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  values.push(currentVal.trim());
  return values;
}

function testParseCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf-8");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rawHeaders = parseCsvLine(lines[0]);
  const cleanHeader = (h) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
  const headers = rawHeaders.map(cleanHeader);

  const findIndex = (aliases) => {
    return headers.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));
  };

  let deptIdx = findIndex(["departmentcode", "deptcode", "department", "dept", "scope"]);
  let promptIdx = findIndex(["questionprompt", "prompt", "question", "questiontext", "text"]);
  let optAIdx = findIndex(["optiona", "opta"]);
  let optBIdx = findIndex(["optionb", "optb"]);
  let optCIdx = findIndex(["optionc", "optc"]);
  let optDIdx = findIndex(["optiond", "optd"]);
  let correctIdx = findIndex(["correctoption", "correctanswer", "correctkey", "correct", "answer", "key", "answerkey"]);

  const clean = (val) => (val || "").replace(/^"|"$/g, "").trim();

  let validCount = 0;
  let invalidCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const dept = clean(values[deptIdx]);
    const prompt = clean(values[promptIdx]);
    const optA = clean(values[optAIdx]);
    const optB = clean(values[optBIdx]);
    const optC = clean(values[optCIdx]);
    const optD = clean(values[optDIdx]);
    const key = clean(values[correctIdx]);

    if (dept && prompt && optA && optB && optC && optD && key) {
      validCount++;
    } else {
      invalidCount++;
      console.log(`Row ${i} INVALID:`, { dept, prompt: prompt.slice(0, 30), optA, optB, optC, optD, key });
    }
  }

  console.log(`${path.basename(filePath)}: Total rows: ${lines.length - 1}, Valid: ${validCount}, Invalid: ${invalidCount}`);
}

const dir = path.resolve(__dirname, "../.data/questions");
["AERO.csv", "Research_Methodology.csv", "Research_Methodology_Tamil.csv", "TAMIL.csv"].forEach((f) => {
  testParseCsv(path.join(dir, f));
});
