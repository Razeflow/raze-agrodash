// One-time script: Seeds 13 default user accounts into Supabase Auth + profiles table
// Run schema first via SQL Editor (scripts/full-setup.sql), then: node scripts/setup-supabase.js

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL env var");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  // Use the SQL endpoint directly
  return res;
}

async function execSQL(sql, label) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: sql,
  });
  console.log(`  ${label}: ${res.ok ? "OK" : res.status}`);
}

// Use the pg_net or direct SQL approach via Supabase Management API
async function executeSQLViaManagement(sql, label) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  });
}

// ── Step 1: Create tables via SQL Editor proxy ──
async function setupSchema() {
  console.log("\n📦 Step 1: Creating database schema...\n");

  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  // Run SQL via Supabase's pg endpoint
  const res = await fetch(`${SUPABASE_URL}/pg`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: schema }),
  });

  if (res.ok) {
    console.log("  ✅ Schema created successfully!\n");
  } else {
    // If /pg doesn't work, output the SQL for manual execution
    console.log("  ⚠️  Could not run SQL via API. Please run it manually in the SQL Editor.\n");
    console.log("  Saving SQL to scripts/schema.sql ...\n");
    fs.writeFileSync(schemaPath, schema.trim());
    console.log("  ✅ Saved to scripts/schema.sql — paste this in Supabase Dashboard → SQL Editor → Run\n");
  }
}

// ── Step 2: Seed 13 users ──
async function seedUsers() {
  console.log("👥 Step 2: Seeding 13 user accounts...\n");

  const ACCOUNTS = [
    { username: "superadmin", password: "admin123", role: "SUPER_ADMIN", barangay: null, displayName: "Super Admin" },
    { username: "admin1", password: "admin123", role: "ADMIN", barangay: null, displayName: "Admin 1" },
    { username: "admin2", password: "admin123", role: "ADMIN", barangay: null, displayName: "Admin 2" },
    { username: "supo", password: "user123", role: "BARANGAY_USER", barangay: "Supo", displayName: "Supo Officer" },
    { username: "poblacion", password: "user123", role: "BARANGAY_USER", barangay: "Poblacion", displayName: "Poblacion Officer" },
    { username: "wayangan", password: "user123", role: "BARANGAY_USER", barangay: "Wayangan", displayName: "Wayangan Officer" },
    { username: "kili", password: "user123", role: "BARANGAY_USER", barangay: "Kili", displayName: "Kili Officer" },
    { username: "tiempo", password: "user123", role: "BARANGAY_USER", barangay: "Tiempo", displayName: "Tiempo Officer" },
    { username: "amtuagan", password: "user123", role: "BARANGAY_USER", barangay: "Amtuagan", displayName: "Amtuagan Officer" },
    { username: "tabacda", password: "user123", role: "BARANGAY_USER", barangay: "Tabacda", displayName: "Tabacda Officer" },
    { username: "alangtin", password: "user123", role: "BARANGAY_USER", barangay: "Alangtin", displayName: "Alangtin Officer" },
    { username: "dilong", password: "user123", role: "BARANGAY_USER", barangay: "Dilong", displayName: "Dilong Officer" },
    { username: "tubtuba", password: "user123", role: "BARANGAY_USER", barangay: "Tubtuba", displayName: "Tubtuba Officer" },
  ];

  let created = 0;
  let skipped = 0;

  for (const acct of ACCOUNTS) {
    const email = `${acct.username}@agridash.local`;

    // Create auth user
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password: acct.password,
        email_confirm: true,
        user_metadata: { username: acct.username, display_name: acct.displayName },
      }),
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      if (authData.msg && authData.msg.includes("already been registered")) {
        console.log(`  ⏭️  ${acct.username} — already exists, skipping`);
        skipped++;
        continue;
      }
      console.error(`  ❌ ${acct.username} — auth error: ${authData.msg || authData.message || JSON.stringify(authData)}`);
      continue;
    }

    const userId = authData.id;

    // Create profile row
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        id: userId,
        username: acct.username,
        display_name: acct.displayName,
        role: acct.role,
        barangay: acct.barangay,
      }),
    });

    if (profileRes.ok) {
      console.log(`  ✅ ${acct.username} (${acct.role}${acct.barangay ? ` → ${acct.barangay}` : ""})`);
      created++;
    } else {
      const err = await profileRes.text();
      console.error(`  ❌ ${acct.username} — profile error: ${err}`);
    }
  }

  console.log(`\n  Done: ${created} created, ${skipped} skipped\n`);
}

// ── Main ──
async function main() {
  console.log("🌾 Raze AgroDash — Seed Users\n");
  console.log(`  URL: ${SUPABASE_URL}`);
  console.log(`  Key: ${SERVICE_ROLE_KEY.substring(0, 20)}...`);

  await seedUsers();

  console.log("🎉 Setup complete!\n");
  console.log("  Default logins:");
  console.log("  ─────────────────────────────");
  console.log("  superadmin / admin123  (Super Admin)");
  console.log("  admin1     / admin123  (Admin)");
  console.log("  admin2     / admin123  (Admin)");
  console.log("  supo       / user123   (Barangay User)");
  console.log("  poblacion  / user123   (Barangay User)");
  console.log("  ... and 8 more barangay users");
}

main().catch(console.error);
