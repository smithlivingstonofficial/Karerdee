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

const { createClient } = require(path.resolve(__dirname, "../admin-web/node_modules/@supabase/supabase-js"));

const supabase = createClient(supabaseUrl, serviceKey);

async function inspectTables() {
  const tables = [
    "submissions",
    "violation_logs",
    "proctor_actions",
    "exam_sessions",
    "question_options",
    "exam_questions",
    "exam_sections",
    "exams",
    "department_question_options",
    "department_questions",
    "students",
    "batches",
    "courses",
    "departments"
  ];

  console.log("=== CURRENT SUPABASE TABLE ROW COUNTS ===");
  for (const t of tables) {
    try {
      const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
      if (error) {
        console.log(`${t}: ERROR (${error.message})`);
      } else {
        console.log(`${t}: ${count} rows`);
      }
    } catch (e) {
      console.log(`${t}: EXCEPTION (${e.message})`);
    }
  }
}

inspectTables();
