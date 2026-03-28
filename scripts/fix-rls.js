const SUPABASE_URL = "https://epwajdkvhoflyjodemnk.supabase.co";
const KEY = process.argv[2];

if (!KEY) { console.error("Usage: node fix-rls.js <service_role_key>"); process.exit(1); }

const statements = [
  `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE farmers ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE agri_records ENABLE ROW LEVEL SECURITY`,

  // Drop all existing policies
  `DROP POLICY IF EXISTS "Users can read all profiles" ON profiles`,
  `DROP POLICY IF EXISTS "Users can update own profile" ON profiles`,
  `DROP POLICY IF EXISTS "Allow all authenticated reads on profiles" ON profiles`,
  `DROP POLICY IF EXISTS "Allow all authenticated reads on farmers" ON farmers`,
  `DROP POLICY IF EXISTS "Allow all authenticated writes on farmers" ON farmers`,
  `DROP POLICY IF EXISTS "Allow all authenticated updates on farmers" ON farmers`,
  `DROP POLICY IF EXISTS "Allow all authenticated deletes on farmers" ON farmers`,
  `DROP POLICY IF EXISTS "Allow all authenticated reads on records" ON agri_records`,
  `DROP POLICY IF EXISTS "Allow all authenticated writes on records" ON agri_records`,
  `DROP POLICY IF EXISTS "Allow all authenticated updates on records" ON agri_records`,
  `DROP POLICY IF EXISTS "Allow all authenticated deletes on records" ON agri_records`,
  `DROP POLICY IF EXISTS "Admins can read all farmers" ON farmers`,
  `DROP POLICY IF EXISTS "Barangay users read own farmers" ON farmers`,
  `DROP POLICY IF EXISTS "Authenticated can insert farmers" ON farmers`,
  `DROP POLICY IF EXISTS "Authenticated can update farmers" ON farmers`,
  `DROP POLICY IF EXISTS "Authenticated can delete farmers" ON farmers`,
  `DROP POLICY IF EXISTS "Admins can read all records" ON agri_records`,
  `DROP POLICY IF EXISTS "Barangay users read own records" ON agri_records`,
  `DROP POLICY IF EXISTS "Authenticated can insert records" ON agri_records`,
  `DROP POLICY IF EXISTS "Authenticated can update records" ON agri_records`,
  `DROP POLICY IF EXISTS "Authenticated can delete records" ON agri_records`,

  // PROFILES
  `CREATE POLICY "Allow all authenticated reads on profiles" ON profiles FOR SELECT TO authenticated USING (true)`,
  `CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id)`,

  // FARMERS
  `CREATE POLICY "Allow all authenticated reads on farmers" ON farmers FOR SELECT TO authenticated USING (true)`,
  `CREATE POLICY "Allow all authenticated writes on farmers" ON farmers FOR INSERT TO authenticated WITH CHECK (true)`,
  `CREATE POLICY "Allow all authenticated updates on farmers" ON farmers FOR UPDATE TO authenticated USING (true)`,
  `CREATE POLICY "Allow all authenticated deletes on farmers" ON farmers FOR DELETE TO authenticated USING (true)`,

  // AGRI_RECORDS
  `CREATE POLICY "Allow all authenticated reads on records" ON agri_records FOR SELECT TO authenticated USING (true)`,
  `CREATE POLICY "Allow all authenticated writes on records" ON agri_records FOR INSERT TO authenticated WITH CHECK (true)`,
  `CREATE POLICY "Allow all authenticated updates on records" ON agri_records FOR UPDATE TO authenticated USING (true)`,
  `CREATE POLICY "Allow all authenticated deletes on records" ON agri_records FOR DELETE TO authenticated USING (true)`,
];

async function run() {
  let ok = 0, fail = 0;
  for (const sql of statements) {
    try {
      const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/", {
        method: "POST",
        headers: {
          apikey: KEY,
          Authorization: "Bearer " + KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
    } catch {}
  }

  // Use the Supabase Management API to run SQL
  const projectRef = "epwajdkvhoflyjodemnk";
  const allSql = statements.join(";\n") + ";";

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: allSql }),
  });

  if (res.ok) {
    const data = await res.json();
    console.log("All RLS policies applied successfully!");
    console.log(JSON.stringify(data).substring(0, 500));
  } else {
    const text = await res.text();
    console.log("Management API response:", res.status, text.substring(0, 500));

    // Fallback: try individual SQL via pg-meta
    console.log("\nTrying individual statements via REST...");
    for (const sql of statements) {
      try {
        const r2 = await fetch(SUPABASE_URL + "/rest/v1/rpc/exec_sql", {
          method: "POST",
          headers: {
            apikey: KEY,
            Authorization: "Bearer " + KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: sql }),
        });
        if (r2.ok) {
          ok++;
        } else {
          const t = await r2.text();
          if (t.includes("does not exist")) {
            console.log("RPC exec_sql not available. You need to run SQL manually in Supabase Dashboard.");
            console.log("\nCopy this SQL and paste it in Supabase Dashboard > SQL Editor > New query:\n");
            console.log(allSql);
            return;
          }
          fail++;
        }
      } catch { fail++; }
    }
    console.log(`Done: ${ok} ok, ${fail} failed`);
  }
}

run().catch(console.error);
