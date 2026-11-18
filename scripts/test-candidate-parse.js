const fs = require("fs");

function parseCandidateCSV(text) {
  const cleanText = text.replace(/^\uFEFF/, "").trim();
  const rawLines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length < 2) {
    return { error: "CSV must contain a header row and at least one student record." };
  }

  const tokenizeRow = (line) => {
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
    return values.map((v) => v.replace(/^"|"$/g, "").trim());
  };

  const headerCells = tokenizeRow(rawLines[0]).map((h) => h.toLowerCase());

  const findColIndex = (aliases, fallbackIdx) => {
    const idx = headerCells.findIndex((cell) =>
      aliases.some((alias) => cell === alias || cell.includes(alias))
    );
    return idx !== -1 ? idx : fallbackIdx;
  };

  const appNumIdx = findColIndex(
    ["application number", "application no", "application_number", "app no", "app number", "roll number", "roll no", "roll_number", "reg no", "register no", "registration number", "candidate id"],
    0
  );
  const nameIdx = findColIndex(
    ["student name", "candidate name", "full name", "fullname", "name", "candidate_name", "student_name"],
    1
  );
  const emailIdx = findColIndex(
    ["institutional email", "candidate email", "student email", "email address", "email", "mail"],
    2
  );
  const deptIdx = findColIndex(
    ["department code", "department", "dept code", "dept", "department_code", "branch", "discipline"],
    3
  );

  const parsed = [];
  for (let i = 1; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    const values = tokenizeRow(line);

    const appNum = (values[appNumIdx] || "").trim().toUpperCase();
    const name = (values[nameIdx] || "").trim();
    const email = (values[emailIdx] || "").trim().toLowerCase();
    const deptCode = (values[deptIdx] || "").trim().toUpperCase();

    const isValid = appNum.length > 0 && name.length > 0 && email.length > 0;
    parsed.push({
      applicationNumber: appNum,
      fullName: name,
      email: email,
      departmentCode: deptCode,
      isValid,
    });
  }
  return { rows: parsed };
}

const testCsv1 = `Application Number,Student Name,Email,Department Code
9921004001,Aravind Swamy,aravind.s@klu.ac.in,MCA
9921004002,Bhavani Ramesh,bhavani.r@klu.ac.in,CSE
9921004003,Chandran Kumar,chandran.k@klu.ac.in,TAMIL
9921004004,Divya Priya,divya.p@klu.ac.in,AERO`;

const testCsv2 = `Candidate Name,Roll No,Department,Email Address
Aravind Swamy,9921004001,MCA,aravind.s@klu.ac.in
Bhavani Ramesh,9921004002,CSE,bhavani.r@klu.ac.in`;

console.log("Test 1 (Standard):", parseCandidateCSV(testCsv1));
console.log("Test 2 (Shuffled Headers):", parseCandidateCSV(testCsv2));
