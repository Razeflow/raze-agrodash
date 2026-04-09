const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const VAULT_DIR = path.resolve(PROJECT_ROOT, "..", "..", "brain", "AgriDash");
const DEVLOG_PATH = path.join(VAULT_DIR, "DevLog.md");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generateChangelog() {
  try {
    const log = execSync(
      'git log --pretty=format:"## %s%n%n- **Commit**: `%h`%n- **Author**: %an%n- **Date**: %ai%n%n---" --no-merges',
      { cwd: PROJECT_ROOT, encoding: "utf-8" }
    );
    const header = [
      "# Raze AgroDash — Changelog",
      "",
      "> Auto-generated from git history.",
      `> Last synced: ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`,
      "",
      "---",
      "",
    ].join("\n");
    return header + log;
  } catch {
    return "# Changelog\n\nNo git history available.\n";
  }
}

function getLatestCommitSummary() {
  try {
    const hash = execSync("git log -1 --format=%h", { cwd: PROJECT_ROOT, encoding: "utf-8" }).trim();
    const subject = execSync("git log -1 --format=%s", { cwd: PROJECT_ROOT, encoding: "utf-8" }).trim();
    const files = execSync("git diff-tree --no-commit-id --name-only -r HEAD", { cwd: PROJECT_ROOT, encoding: "utf-8" }).trim();
    return { hash, subject, files: files.split("\n").filter(Boolean) };
  } catch {
    return null;
  }
}

function appendDevLog(commit) {
  if (!commit) return;

  const timestamp = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const entry = [
    "",
    `### ${timestamp}`,
    "",
    `**${commit.subject}** (\`${commit.hash}\`)`,
    "",
    "Files changed:",
    ...commit.files.map((f) => `- \`${f}\``),
    "",
    "---",
  ].join("\n");

  let existing = "";
  if (fs.existsSync(DEVLOG_PATH)) {
    existing = fs.readFileSync(DEVLOG_PATH, "utf-8");
  } else {
    existing = [
      "# Raze AgroDash — Dev Log",
      "",
      "> Automatically appended after each commit.",
      "> Newest entries at the top.",
      "",
      "---",
    ].join("\n");
  }

  const headerEnd = existing.indexOf("---");
  if (headerEnd !== -1) {
    const header = existing.slice(0, headerEnd + 3);
    const body = existing.slice(headerEnd + 3);
    fs.writeFileSync(DEVLOG_PATH, header + entry + body, "utf-8");
  } else {
    fs.writeFileSync(DEVLOG_PATH, existing + entry, "utf-8");
  }
}

function syncFile(filename) {
  const src = path.join(PROJECT_ROOT, filename);
  const dest = path.join(VAULT_DIR, filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  Synced ${filename}`);
  }
}

// ── Main ──

console.log("Syncing docs to Obsidian vault...");
console.log(`  Vault: ${VAULT_DIR}`);

ensureDir(VAULT_DIR);

syncFile("memory.md");
syncFile("skills.md");
syncFile("README.md");

const changelog = generateChangelog();
fs.writeFileSync(path.join(VAULT_DIR, "CHANGELOG.md"), changelog, "utf-8");
console.log("  Generated CHANGELOG.md");

const commit = getLatestCommitSummary();
appendDevLog(commit);
console.log("  Updated DevLog.md");

console.log("Done.");
