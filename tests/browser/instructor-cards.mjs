// Actual React controls with a MOCKED Supabase transport. No live endpoints,
// environment files, Auth accounts, file delivery or provider policy claims.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve(".client-review/node_modules/playwright"));
const server = await createServer({ configFile: false, envFile: false, cacheDir: path.resolve(".client-review/node_modules/.vite-cards"), plugins: [
  { name: "cards-fixture", enforce: "pre", resolveId(source) { if (/(?:^|\/)supabaseClient(?:\.js)?$/.test(source)) return path.resolve("tests/browser/audit-client.js"); } }, react(), tailwind(),
], server: { host: "127.0.0.1", port: 0 } });
const passed = [], errors = [];
let browser;
try {
  await mkdir(".client-review/instructor-cards", { recursive: true }); await server.listen();
  const origin = server.resolvedUrls.local[0];
  const executablePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.on("pageerror", error => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-10-13T02:00:00Z") });
  await page.goto(`${origin}?role=instructor`); await page.getByRole("heading", { name: /Hi,/ }).waitFor({ timeout: 30000 });
  await page.evaluate(() => {
    const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, state = window.__audit.state;
    state.attendance_logs = []; state.documents = [];
    state.profiles = state.profiles.filter(p => p.role !== "intern"); state.interns = [];
    for (let i = 0; i < 65; i++) {
      const owner = id(101 + i), date = "2026-10-12";
      state.profiles.push({ id: owner, full_name: `Intern ${String(i + 1).padStart(3, "0")}`, student_id: `SID-${i + 1}`, role: "intern", status: "Active" });
      state.interns.push({ id: owner, instructor_id: id(2), company_id: id(10), section_id: id(20 + i % 2), required_hours: i < 12 ? 8 : i === 62 ? null : 16 });
      state.attendance_logs.push({ id: id(5000 + i), intern_id: owner, log_date: date, time_in: "08:00:00", time_out: "16:00:00", clocked_in_at: i === 64 ? null : `${date}T00:00:00Z`, clocked_out_at: `${date}T08:00:00Z`, hours: 8, verified: true, verified_by: id(2) });
      ["moa", "endorsement", "consent", "medical"].forEach((doc_type, t) => {
        const docId = id(1000 + i * 10 + t), status = i < 12 ? "Approved" : i < 22 && t === 0 ? "Needs Revision" : "Pending";
        state.documents.push({ id: docId, intern_id: owner, doc_type, name: `Fixture ${doc_type.toUpperCase()}`, status,
          upload_version: 1, review_revision: 1, file_path: `${owner}/${docId}/v1.pdf`, file_name: `${doc_type}.pdf`, reviewed_by: status === "Pending" ? null : id(2), reviewed_at: status === "Pending" ? null : "2026-10-12T09:00:00Z" });
      });
    }
    state.documents.push({ ...state.documents.find(d => d.intern_id === id(164) && d.doc_type === "moa"), id: id(9998) });
    state.profiles.push({ id: id(900), full_name: "Foreign cleared intern", role: "intern", status: "Active" });
    state.interns.push({ id: id(900), instructor_id: id(3), required_hours: 8 });
    state.document_versions = []; state.document_review_events = [];
    state.submissions = []; state.submission_versions = []; state.submission_files = []; state.submission_reviews = [];
    window.__audit.save();
  });
  await page.goto(`${origin}?role=instructor`);
  const card = label => page.getByRole("button", { name: new RegExp(`^${label}:`) });
  const value = async (label, text) => { await card(label).locator(".metric-value").filter({ hasText: new RegExp(`^${text}$`) }).waitFor(); };
  const refresh = async () => { await page.getByRole("button", { name: "Refresh workspace", exact: true }).click(); await page.getByRole("button", { name: "Refresh workspace", exact: true }).waitFor(); };
  const nav = name => page.getByRole("button", { name, exact: true }).first().click();
  await value("Cleared", "12 confirmed"); await value("At Risk", "10 confirmed");
  assert.match(await card("Cleared").innerText(), /Unknown: 3.*incomplete/);
  assert.match(await card("At Risk").getAttribute("title"), /Verified hours below the saved target/);
  assert.equal(await page.getByText("Foreign cleared intern", { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.__audit.calls.some(name => ["document_access", "submission_file_access"].includes(name))), false);
  passed.push("Complete 65-intern roster counts 12 Cleared/10 At Risk with Unknown: 3; foreign intern excluded; no file-access RPCs for calculation.");

  await card("Cleared").focus(); await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Cleared assigned interns", exact: true }).waitFor();
  assert.equal(await page.locator("#class-roster tbody tr").count(), 10);
  await page.locator("#class-roster").getByRole("button", { name: "Next", exact: true }).click();
  assert.equal(await page.locator("#class-roster tbody tr").count(), 2);
  await page.getByLabel("Search name, student ID or company").fill("Intern 011");
  assert.equal(await page.locator("#class-roster tbody tr").count(), 1);
  await value("Cleared", "12 confirmed");
  await page.getByLabel("Search name, student ID or company").fill("");
  await page.getByLabel("Section", { exact: true }).selectOption("00000000-0000-4000-8000-000000000020");
  assert.equal(await page.locator("#class-roster tbody tr").count(), 6);
  await page.getByLabel("Section", { exact: true }).selectOption("");
  passed.push("Keyboard card drill-down, multiple pages, combined search/section filters and page reset; global totals stay unchanged.");

  await card("At Risk").click();
  await page.getByRole("heading", { name: "At Risk assigned interns", exact: true }).waitFor();
  assert.equal(await page.locator("#class-roster tbody tr").count(), 10);
  assert.equal(await page.locator("#class-roster tbody tr").filter({ hasText: "Needs Revision: Fixture MOA" }).count(), 10);
  await page.setViewportSize({ width: 390, height: 600 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await card("At Risk").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".client-review/instructor-cards/mobile-risk.png" }); await page.setViewportSize({ width: 1440, height: 1000 });
  passed.push("At Risk drill-down shows actual revision/shortfall reasons; mobile table remains contained.");

  await page.evaluate(() => sessionStorage.setItem("synthetic-read-failure", "companies")); await refresh();
  await value("Cleared", "12 confirmed"); await value("At Risk", "10 confirmed");
  await page.getByRole("alert").filter({ hasText: "companies unavailable" }).waitFor();
  await page.evaluate(() => sessionStorage.setItem("synthetic-read-failure", "documents")); await refresh();
  await value("Cleared", "0 confirmed"); await value("At Risk", "0 confirmed");
  assert.match(await card("Cleared").innerText(), /Unknown: 65.*incomplete/);
  await page.evaluate(() => sessionStorage.removeItem("synthetic-read-failure"));
  await page.getByRole("alert").filter({ hasText: "Progress evidence unavailable" }).getByRole("button", { name: "Retry", exact: true }).click();
  await value("Cleared", "12 confirmed"); await value("At Risk", "10 confirmed");
  passed.push("Unrelated company failure preserves counts; failed evidence becomes Unknown: 65, not a completed zero; Retry restores counts.");

  await nav("Intern Documents");
  await page.locator("#document-intern").selectOption("00000000-0000-4000-8000-000000000111");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByRole("button", { name: "Refresh workspace", exact: true }).waitFor();
  assert.equal(await page.locator("#document-intern").inputValue(), "00000000-0000-4000-8000-000000000111", "Background refresh must preserve the selected Intern");
  await page.locator("#document-intern").selectOption("00000000-0000-4000-8000-000000000101");
  const requirement = page.locator(".ui-card").filter({ hasText: "Fixture MOA" }).filter({ has: page.getByRole("button", { name: "Revoke", exact: true }) });
  await requirement.getByRole("button", { name: "Revoke", exact: true }).click();
  await page.getByRole("button", { name: "Refresh workspace", exact: true }).waitFor(); await nav("Class Dashboard");
  await value("Cleared", "11 confirmed");
  passed.push("Real document review handler refreshes clearance immediately after a successful fixture revocation.");

  await page.evaluate(() => { const r = window.__audit.state.attendance_logs.find(r => r.intern_id.endsWith("000102")); r.verified = false; r.verified_by = null; window.__audit.save(); window.dispatchEvent(new Event("focus")); });
  await value("Cleared", "10 confirmed");
  await page.evaluate(() => { window.__audit.state.interns.find(r => r.id.endsWith("000103")).required_hours = 16; window.__audit.save(); });
  await page.clock.fastForward(60001); await value("Cleared", "9 confirmed");
  await page.evaluate(() => { Object.assign(window.__audit.state.documents.find(r => r.intern_id.endsWith("000104") && r.doc_type === "moa"), { upload_version: 2, review_revision: 0, status: "Pending", reviewed_by: null, reviewed_at: null }); window.__audit.save(); });
  await refresh(); await value("Cleared", "8 confirmed");
  await page.evaluate(() => { window.__audit.state.interns.find(r => r.id.endsWith("000105")).instructor_id = "00000000-0000-4000-8000-000000000003"; window.__audit.save(); });
  await refresh(); await value("Cleared", "7 confirmed"); await value("At Risk", "10 confirmed");
  passed.push("Focus, visible-minute poll and explicit refresh reflect verification, target, replacement and assignment changes; low progress alone adds no risk.");

  await page.evaluate(() => sessionStorage.setItem("synthetic-read-failure", "profiles")); await refresh();
  await value("Cleared", "Unavailable"); await value("At Risk", "Unavailable");
  assert.match(await page.locator("#class-roster").getByRole("status").innerText(), /Qualifying list unavailable/);
  await page.evaluate(() => { sessionStorage.removeItem("synthetic-read-failure"); window.__audit.state.interns = []; window.__audit.save(); });
  await refresh(); await value("Cleared", "0"); await value("At Risk", "0");
  assert.equal(await card("Cleared").getByText(/Unknown:/).count(), 0);
  passed.push("Unavailable roster membership stays Unavailable; a successfully retrieved empty roster shows confirmed zero.");
  assert.deepEqual(errors, []);
  await writeFile(".client-review/instructor-cards/results.json", JSON.stringify({ transport: "mocked", passed, errors }, null, 2));
  console.log(JSON.stringify({ transport: "mocked", passed, errors }, null, 2));
} finally { await browser?.close(); await server.close(); }
