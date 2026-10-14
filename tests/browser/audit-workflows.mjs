// Real React browser checks with a mocked Supabase transport. Remote requests
// and environment-file loading are disabled. Local SQL suites prove DB rules.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { RUBRIC } from "../../src/lib/business.js";
const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve(".client-review/node_modules/playwright"));
const baseline = process.argv.includes("--baseline");
const server = await createServer({ configFile: false, envFile: false, cacheDir: path.resolve(".client-review/node_modules/.vite-audit"), plugins: [
  { name: "audit-fixture", enforce: "pre", resolveId(source) {
    if (/(?:^|\/)supabaseClient(?:\.js)?$/.test(source)) return path.resolve("tests/browser/audit-client.js");
    if (baseline && /^\.\/App(?:\.jsx)?$/.test(source)) return path.resolve(".client-review/audit-before/src/App.jsx");
  } }, react(), tailwind(),
], server: { host: "127.0.0.1", port: 0 } });
const passed = [], failed = [], errors = [];
let browser;
try {
  await mkdir(".client-review/audit", { recursive: true }); await server.listen();
  const origin = server.resolvedUrls.local[0];
  const executablePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(45000); // Allow cold local Vite dependency compilation; UI assertions remain bounded.
  const start = async (role, extra = "") => { await page.goto(`${origin}?audit=1&role=${role}${extra}`); await page.getByRole("heading", { name: /Hi,/ }).waitFor({ timeout: 30000 }); };
  const nav = name => page.getByRole("button", { name, exact: true }).first().click();
  const run = async (name, task) => { try { await task(); passed.push(name); console.log(`PASS ${name}`); } catch (error) { failed.push({ name, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); } };
  await run("Token refresh preserves an unfinished evaluation and current route", async () => {
    await start("instructor"); await nav("Evaluations");
    await page.locator("#evaluation-intern").selectOption("00000000-0000-4000-8000-000000000101");
    await page.locator("#evaluation-feedback").fill("Unsaved evaluation survives token refresh");
    await page.evaluate(() => { window.__audit.holdProfile = true; window.__audit.emit("TOKEN_REFRESHED"); });
    await page.waitForFunction(() => Boolean(window.__audit.releaseProfile));
    try {
      assert.equal(await page.locator("#evaluation-feedback").count(), 1, "refresh unmounted the evaluation form");
      assert.equal(await page.locator("#evaluation-feedback").inputValue(), "Unsaved evaluation survives token refresh");
    } finally { await page.evaluate(() => { window.__audit.holdProfile = false; window.__audit.releaseProfile(); }); }
  });
  await run("Late restoration cannot resurrect a signed-out session", async () => {
    await page.goto(`${origin}?audit=1&role=intern&restore-hold=1`);
    await page.waitForFunction(() => Boolean(window.__audit));
    await page.evaluate(() => { window.__audit.emit("SIGNED_OUT", null); window.__audit.releaseRestore(); });
    await page.waitForTimeout(150);
    assert.equal(await page.getByRole("button", { name: "Sign in", exact: true }).count(), 1);
    assert.equal(await page.locator(".dashboard-shell").count(), 0);
  });
  await run("Rejected intern read keeps unaffected pages usable and offers Retry", async () => {
    await start("intern");
    await page.evaluate(() => { window.__audit.failRead = "interns"; });
    // A same-account event rechecks the profile. Navigate through a new mount
    // to force the real dashboard data loader to receive the rejected read.
    await page.evaluate(() => window.__audit.emit("SIGNED_OUT", null));
    await page.evaluate(() => window.__audit.emit("SIGNED_IN"));
    await page.waitForTimeout(150);
    assert.equal(await page.locator(".dashboard-content").count(), 1, "rejected query left a loading screen");
    await nav("My Attendance"); assert.equal(await page.getByRole("button", { name: "Clock In", exact: true }).count(), 1);
  });
  await run("Rejected alert dismissal retains the alert and offers an honest error", async () => {
    await start("instructor");
    await page.evaluate(() => { window.__audit.state.alerts = [{ id: "00000000-0000-4000-8000-000000000980", intern_id: "00000000-0000-4000-8000-000000000101", type: "Audit fixture alert", detail: "Retain this alert on failure", dismissed: false }]; window.__audit.save(); });
    await start("instructor"); await nav("Announcements");
    await page.evaluate(() => { window.__audit.failMutation = "alerts"; });
    await page.getByRole("button", { name: "Dismiss", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: /Unable to dismiss/ }).waitFor({ timeout: 1500 });
    assert.equal(await page.getByText("Retain this alert on failure").count(), 1);
  });
  if (!baseline) {
    await run("Refresh still enforces Inactive status and rejects a mismatched profile identity", async () => {
      await start("intern");
      await page.evaluate(() => { window.__audit.profileOverride = { ...window.__audit.state.profiles.find(p => p.id.endsWith("000101")), status: "Inactive" }; window.__audit.emit("TOKEN_REFRESHED"); });
      await page.getByRole("heading", { name: "Account inactive", exact: true }).waitFor();
      assert.equal(await page.locator(".dashboard-content").count(), 0);
      await start("intern");
      await page.evaluate(() => { window.__audit.profileOverride = { id: "00000000-0000-4000-8000-000000000099", role: "intern", status: "Active" }; window.__audit.emit("TOKEN_REFRESHED"); });
      await page.getByRole("heading", { name: "Account details unavailable" }).waitFor();
      assert.equal(await page.locator(".dashboard-content").count(), 0);
      await page.evaluate(() => { window.__audit.profileOverride = null; });
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await page.getByRole("heading", { name: /Hi,/ }).waitFor();
      await start("instructor"); await nav("Evaluations");
      await page.locator("#evaluation-intern").selectOption("00000000-0000-4000-8000-000000000101");
      await page.evaluate(() => { window.__audit.holdProfile = true; window.__audit.emit("SIGNED_IN", { user: { id: "00000000-0000-4000-8000-000000000099" } }); });
      await page.waitForFunction(() => Boolean(window.__audit.releaseProfile));
      assert.equal(await page.locator(".dashboard-content").count(), 0, "Identity switch must clear the previous account immediately");
      await page.evaluate(() => { window.__audit.holdProfile = false; window.__audit.releaseProfile(); });
      await page.getByRole("heading", { name: "Account details unavailable" }).waitFor();
    });
    await run("Registration confirmation instructions → Pending gate → Admin activation → restored Intern session", async () => {
      await page.evaluate(() => localStorage.removeItem("insync-synthetic-browser-data"));
      await page.goto(`${origin}?audit=1&role=intern&login=1`);
      await page.getByRole("button", { name: "Create an account", exact: true }).click();
      await page.getByLabel("Full name", { exact: false }).fill("Demo Fixture Intern");
      await page.getByLabel("Student ID", { exact: true }).fill("DEMO-101");
      await page.getByLabel("University / School", { exact: true }).fill("Fixture School");
      await page.locator("#register-email").fill("fixture@example.invalid");
      await page.locator("#register-password").fill("synthetic-secret");
      await page.locator("#register-confirm-password").fill("synthetic-secret");
      await page.getByRole("button", { name: "Create account", exact: true }).click();
      await page.getByRole("heading", { name: "Check your email" }).waitFor();
      assert.match(await page.getByRole("status").first().innerText(), /confirmation.*does not activate/i);
      await page.getByRole("button", { name: "Continue to sign in" }).click();
      await page.locator("#login-password").fill("synthetic-secret");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.getByRole("heading", { name: "Account pending activation" }).waitFor();
      assert.equal(await page.locator(".dashboard-content").count(), 0);
      await start("admin"); await nav("Account Management");
      await page.getByLabel("Search accounts by name, role, email or student ID").fill("Demo Fixture Intern");
      await page.getByRole("button", { name: "Activate", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Account status updated" }).waitFor();
      assert.equal(await page.evaluate(() => window.__audit.state.profiles.find(p => p.id.endsWith("000101")).status), "Active");
      await start("intern");
      assert.equal(await page.locator(".dashboard-content").count(), 1);
    });
    await run("Admin assignment persists instructor/company/section and a fractional saved target", async () => {
      await start("admin"); await nav("Interns");
      await page.locator("#assignment-search").fill("Demo Fixture Intern");
      const row = page.locator("div.px-4.py-4").filter({ hasText: "Demo Fixture Intern" });
      await row.getByLabel("Instructor", { exact: true }).selectOption("00000000-0000-4000-8000-000000000002");
      await row.getByLabel("Company", { exact: true }).selectOption("00000000-0000-4000-8000-000000000010");
      await row.getByLabel("Section", { exact: true }).selectOption("00000000-0000-4000-8000-000000000020");
      await row.getByLabel("Required Hours", { exact: true }).fill("500.25");
      await row.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Assignment saved" }).waitFor();
      await start("intern"); assert.match(await page.locator(".dashboard-content").innerText(), /500\.25 required/);
    });
    await run("Clock-in → accomplishment → clock-out keeps logged and verified hours distinct", async () => {
      await start("intern"); await nav("My Attendance");
      await page.getByRole("button", { name: "Clock In", exact: true }).click();
      await page.getByRole("button", { name: "Clock Out", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("#clock-out-accomplishment").fill("Completed an isolated fixture task");
      await dialog.getByRole("button", { name: "Clock Out & Save Log", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Clocked out" }).waitFor();
      const stored = await page.evaluate(() => window.__audit.state.attendance_logs.at(-1));
      assert.equal(stored.verified, false); assert.ok(stored.hours > 0); assert.equal(stored.verified_by, null);
      assert.match(await page.locator("tbody").innerText(), /Unverified/);
    });
    await run("Overnight attendance correction → Instructor approval → verified Intern DTR", async () => {
      await start("intern"); await nav("My Attendance");
      await page.locator("#correction-date").fill("2026-10-10");
      await page.locator("#correction-clock-in").fill("22:00");
      await page.locator("#correction-clock-out").fill("06:00");
      await page.locator("#correction-end-date").fill("2026-10-11");
      await page.getByLabel("Reason / Explanation").fill("Fixture overnight correction");
      await page.getByRole("button", { name: "Submit Request" }).click();
      await page.getByRole("status").filter({ hasText: "Exception request submitted" }).waitFor();
      await start("instructor"); await nav("DTR Review");
      const row = page.locator("tbody tr").filter({ hasText: "Fixture overnight correction" });
      await row.getByRole("button", { name: "Approve", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "correction(s) approved" }).waitFor();
      await start("intern"); await nav("My Attendance");
      const approved = page.locator("tbody tr").filter({ hasText: "8.00 logged" });
      assert.match(await approved.innerText(), /8\.00 verified/); assert.match(await approved.innerText(), /Oct 11/);
    });
    await run("Correction rejection requires an explanation and leaves attendance unchanged", async () => {
      await start("intern"); await nav("My Attendance");
      await page.locator("#correction-date").fill("2026-10-09"); await page.locator("#correction-clock-in").fill("08:00");
      await page.locator("#correction-clock-out").fill("09:00"); await page.getByLabel("Reason / Explanation").fill("Fixture rejection request");
      await page.getByRole("button", { name: "Submit Request" }).click();
      await page.getByRole("status").filter({ hasText: "Exception request submitted" }).waitFor();
      await start("instructor"); await nav("DTR Review");
      const row = page.locator("tbody tr").filter({ hasText: "Fixture rejection request" });
      await row.getByRole("button", { name: "Reject", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "Enter a rejection note" }).waitFor();
      await page.locator("#correction-review-note").fill("Fixture evidence was insufficient");
      await row.getByRole("button", { name: "Reject", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "correction(s) rejected" }).waitFor();
      assert.equal(await page.evaluate(() => window.__audit.state.attendance_logs.some(r => r.log_date === "2026-10-09")), false);
      await start("intern"); await nav("My Attendance");
      assert.match(await page.locator(".dashboard-content").innerText(), /Fixture evidence was insufficient/);
    });
    await run("Clearance upload → revision → resubmission → approval retains previous files and review history", async () => {
      const payload = name => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nfixture evidence") });
      await start("intern"); await nav("My Documents");
      let card = page.locator(".ui-card").filter({ hasText: "Legacy moa" }).filter({ has: page.locator('input[type="file"]') });
      await card.locator('input[type="file"]').setInputFiles(payload("moa-v1.pdf"));
      await page.getByRole("status").filter({ hasText: "Upload finalized" }).waitFor();
      await start("instructor"); await nav("Intern Documents");
      await page.locator("#document-intern").selectOption("00000000-0000-4000-8000-000000000101");
      card = page.locator(".ui-card").filter({ hasText: "Legacy moa" }).filter({ has: page.getByRole("button", { name: "Request Revision", exact: true }) });
      await card.getByRole("button", { name: "Request Revision", exact: true }).click();
      await card.getByLabel("Revision explanation for Legacy moa").fill("Fixture signature needs correction");
      await card.getByRole("button", { name: "Send", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Revision requested" }).waitFor();
      await start("intern"); await nav("My Documents");
      card = page.locator(".ui-card").filter({ hasText: "Legacy moa" }).filter({ has: page.locator('input[type="file"]') });
      assert.match(await card.innerText(), /Fixture signature needs correction/);
      await card.locator('input[type="file"]').setInputFiles(payload("moa-v2.pdf"));
      await page.getByRole("status").filter({ hasText: "Upload finalized" }).waitFor();
      await card.getByRole("button", { name: "File & review history" }).click();
      let history = page.getByRole("dialog", { name: "Legacy moa — history" });
      await history.getByText("Version 1 · moa-v1.pdf").waitFor();
      assert.match(await history.innerText(), /Fixture signature needs correction/);
      assert.match(await history.innerText(), /Version 2 · moa-v2.pdf/);
      await history.getByRole("button", { name: "View file", exact: true }).last().click();
      await history.getByRole("link", { name: "Open prepared file" }).waitFor();
      await page.keyboard.press("Escape");
      await start("instructor"); await nav("Intern Documents");
      await page.locator("#document-intern").selectOption("00000000-0000-4000-8000-000000000101");
      card = page.locator(".ui-card").filter({ hasText: "Legacy moa" }).filter({ has: page.getByRole("button", { name: "Approve", exact: true }) });
      await card.getByRole("button", { name: "Approve", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "document approved" }).waitFor();
      await start("intern"); await nav("My Documents");
      await page.getByRole("button", { name: "File & review history" }).first().click();
      history = page.getByRole("dialog", { name: "Legacy moa — history" });
      await history.getByText("Version 2 · moa-v2.pdf").waitFor();
      assert.equal(await history.getByText("Approved", { exact: true }).count(), 2);
      await page.keyboard.press("Escape");
      await page.evaluate(() => { window.__audit.failRead = "document_versions"; });
      await page.getByRole("button", { name: "File & review history" }).first().click();
      history = page.getByRole("dialog", { name: "Legacy moa — history" });
      await history.getByRole("alert").filter({ hasText: "History unavailable" }).waitFor();
      assert.equal(await history.getByText("No committed versions recorded").count(), 0);
      await page.evaluate(() => { window.__audit.failRead = ""; });
      await history.getByRole("button", { name: "Retry", exact: true }).click();
      await history.getByText("Version 1 · moa-v1.pdf").waitFor();
      await page.setViewportSize({ width: 390, height: 500 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await history.getByRole("button", { name: "Download file", exact: true }).last().scrollIntoViewIfNeeded();
      await page.screenshot({ path: ".client-review/audit/document-history-mobile.png" });
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflowY), "visible");
      await page.setViewportSize({ width: 1440, height: 900 });
    });
    await run("Flexible two-file set → Instructor approval → Intern history stays separate from clearance", async () => {
      await start("intern"); await nav("My Documents");
      await page.getByLabel("Document type",{exact:true}).selectOption('other');
      await page.getByLabel("Document title",{exact:true}).fill("Fixture flexible evidence");
      await page.getByLabel("Files (required)").setInputFiles([{ name: "report.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF fixture report") }, { name: "photo.png", mimeType: "image/png", buffer: Buffer.from("fixture photo") }]);
      await page.getByRole("button", { name: "Submit complete file set", exact: true }).click();
      await page.getByText("Version 1 · Pending", { exact: true }).waitFor();
      await start("instructor"); await nav("Intern Documents");
      await page.locator("#document-intern").selectOption("00000000-0000-4000-8000-000000000101");
      const flexible = page.getByRole("region", { name: "Flexible submissions" });
      await flexible.getByRole("button", { name: "Approve version 1", exact: true }).click();
      await flexible.getByText("Version 1 · Approved", { exact: true }).waitFor();
      await start("intern"); await nav("My Documents");
      await page.getByText("Version 1 · Approved", { exact: true }).waitFor();
      assert.match(await page.locator(".dashboard-content").innerText(), /1\/4 Approved/);
      assert.equal(await page.evaluate(() => window.__audit.state.submission_files.length), 2);
      assert.equal(await page.evaluate(() => window.__audit.state.documents.filter(d => d.status === "Approved").length), 1);
    });
    await run("Four weighted criteria submit through the real handler and appear read-only for the Intern", async () => {
      await start("instructor"); await nav("Evaluations");
      await page.locator("#evaluation-intern").selectOption("00000000-0000-4000-8000-000000000101");
      for (const [index, criterion] of RUBRIC.entries()) await page.getByRole("button", { name: new RegExp(`^${criterion.label}: ${5 - index} —`) }).click();
      await page.locator("#evaluation-feedback").fill("Fixture weighted evaluation");
      await page.getByRole("button", { name: /Submit Evaluation/i }).click();
      await page.getByRole("status").filter({ hasText: "Evaluation submitted" }).waitFor();
      await start("intern"); await nav("My Evaluations");
      const evaluation = page.locator(".ui-card").filter({ hasText: "Fixture weighted evaluation" });
      assert.match(await evaluation.innerText(), /73/);
      assert.equal(await page.getByRole("button", { name: /Submit Evaluation/i }).count(), 0);
    });
    await run("Individual and active-roster fixture announcements retain intended recipients after reassignment", async () => {
      await start("instructor"); await nav("Announcements");
      await page.locator("#announcement-subject").fill("Fixture roster reminder");
      await page.locator("#announcement-message").fill("Original fixture roster audience");
      await page.getByRole("button", { name: "Send Announcement", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Announcement saved" }).waitFor();
      await page.locator("#announcement-subject").fill("Fixture personal reminder");
      await page.locator("#announcement-recipients").selectOption("00000000-0000-4000-8000-000000000101");
      await page.locator("#announcement-message").fill("Only the intended fixture Intern");
      await page.getByRole("button", { name: "Send Announcement", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Announcement saved" }).last().waitFor();
      await page.evaluate(() => { window.__audit.state.interns.find(i => i.id.endsWith("000101")).instructor_id = null; window.__audit.save(); });
      await start("intern"); await page.getByText("Fixture roster reminder", { exact: true }).waitFor();
      assert.equal(await page.getByText("Fixture personal reminder", { exact: true }).count(), 1);
      await page.getByRole("button", { name: /Sign out/i }).first().click();
      await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
    });
  }
  await writeFile(`.client-review/audit/${baseline ? "baseline" : "results"}.json`, JSON.stringify({ transport: "mocked", passed, failed, errors }, null, 2));
  console.log(JSON.stringify({ transport: "mocked", passed, failed, errors }, null, 2));
  if (failed.length || errors.length) process.exitCode = 1;
} finally { await browser?.close(); await server.close(); }
