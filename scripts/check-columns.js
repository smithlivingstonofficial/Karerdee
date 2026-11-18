const path = require("path");
const fs = require("fs");

const envPath = path.resolve(__dirname, "../admin-web/.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");

const env = {};
envContent.split("\n").forEach((line) => {
  const [key, ...vals] = line.trim().split("=");
  if (key && vals.length > 0) {
    env[key] = vals.join("=").replace(/^"|"$/g, "");
  }
});

const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceKey = env["SUPABASE_SERVICE_ROLE_KEY"];

async function checkColumns() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${serviceKey}`);
    const spec = await res.json();
    const tableDef = spec.definitions?.department_questions;
    console.log("department_questions properties:", Object.keys(tableDef?.properties || {}));
    const examQDef = spec.definitions?.exam_questions;
    console.log("exam_questions properties:", Object.keys(examQDef?.properties || {}));
  } catch (e) {
    console.error("Exception:", e);
  }
}

checkColumns();
