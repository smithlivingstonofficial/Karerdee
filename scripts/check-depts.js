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

async function checkDepts() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/departments?select=*&order=code.asc`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    const data = await res.json();
    console.log("Departments in DB:", data);
  } catch (e) {
    console.error("Exception:", e);
  }
}

checkDepts();
