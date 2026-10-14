// Complete navigation/layout checks using the existing synthetic transport.
// No environment files, live accounts, or remote requests are used.
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
const fixture = path.resolve("tests/browser/synthetic-client.js");
const server = await createServer({ configFile: false, envFile: false, cacheDir: path.resolve(".client-review/node_modules/.vite-redesign"), plugins: [
  { name: "redesign-fixture", enforce: "pre", resolveId(source) {
    if (/(?:^|\/)supabaseClient(?:\.js)?$/.test(source)) return fixture;
  } }, react(), tailwind(),
], server: { host: "127.0.0.1", port: 0 } });
const destinations = {
  admin: ["Overview", "Account Management", "Interns", "Master Data", "Bulk Import", "Audit Logs", "Backup & Security"],
  intern: ["My Dashboard", "My Attendance", "My Documents", "My Evaluations", "Reports"],
  instructor: ["Class Dashboard", "Progress Tracker", "Evaluations", "DTR Review", "Intern Documents", "Reports", "Announcements"],
};
let browser, currentPage;
const passed = [], errors = [];
try {
  await mkdir(".client-review/redesign", { recursive: true });
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  const executablePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  const page = await context.newPage();
  currentPage = page;
  page.on("pageerror", error => errors.push(error.message));
  const start = async role => {
    await page.goto(`${origin}?role=${role}`);
    await page.getByRole("heading", { name: /Hi,/ }).waitFor();
  };
  const checkWidth = async label => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, label);
  const navigate = async (name, mobile = false) => {
    if (mobile) {
      await page.getByRole("button", { name: "Open navigation", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "More navigation" });
      await dialog.waitFor();
      await dialog.getByRole("button", { name, exact: true }).click();
      assert.equal(await dialog.count(), 0);
    } else await page.getByRole("button", { name, exact: true }).first().click();
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
    assert.match(await page.getByRole("heading", { level: 1 }).innerText(), /Hi,|Overview|Account Management|Interns|Master Data|Bulk Import|Audit Logs|Backup & Security|My Attendance|My Documents|My Evaluations|Reports|Progress Tracker|Evaluations|DTR Review|Intern Documents|Announcements/);
  };
  for (const [role, pages] of Object.entries(destinations)) {
    for (const [width, height] of [[1440, 1000], [1440, 360], [720, 500], [390, 844], [320, 360]]) {
      await page.setViewportSize({ width, height });
      await start(role);
      for (const name of pages) {
        await navigate(name, width < 768);
        await checkWidth(`${role}/${name} at ${width}x${height}`);
        assert.equal(await page.locator(".dashboard-content").evaluate(el => getComputedStyle(el).overflowY), "auto");
        if (width === 1440 || width === 390) {
          await page.screenshot({ path: `.client-review/redesign/${role}-${name.replaceAll(/[^a-z0-9]/gi, "-")}-${width}x${height}.png` });
        }
      }
      passed.push(`${role}: all ${pages.length} destinations at ${width}x${height}, one page heading, scrolling content, no page-wide horizontal overflow.`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await start("admin");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await page.locator(".desktop-sidebar").evaluate(el => el.getAnimations().forEach(animation => animation.finish()));
  assert.equal(await page.locator(".desktop-sidebar").evaluate(el => el.getBoundingClientRect().width), 80);
  await navigate("Account Management");
  assert.equal(await page.getByRole("button", { name: "Account Management", exact: true }).first().getAttribute("aria-current"), "page");
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  const edit = page.getByRole("dialog", { name: "Edit User" });
  await edit.getByLabel("Full Name").fill("Preserved failed account draft");
  await edit.getByRole("button", { name: "Save Changes" }).click();
  await edit.getByRole("alert").filter({ hasText: "admin_update_account" }).waitFor();
  assert.equal(await edit.getByLabel("Full Name").inputValue(), "Preserved failed account draft");
  await page.keyboard.press("Escape");
  passed.push("Collapsed sidebar retains accessible route names; failed account RPC remains visible inside the native dialog and retains the draft.");

  await navigate("Interns");
  await page.getByLabel("Required Hours", { exact: true }).first().fill("500");
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await page.getByRole("status").filter({ hasText: "Assignment saved" }).waitFor();
  assert.equal(await page.getByLabel("Required Hours", { exact: true }).first().inputValue(), "500");
  passed.push("Assignment form remains connected to its existing RPC and persisted synthetic target.");

  await navigate("Bulk Import");
  assert.equal(await page.getByRole("button", { name: "Import unavailable" }).isDisabled(), true);
  const templatePromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV", exact: true }).first().click();
  assert.match((await templatePromise).suggestedFilename(), /\.csv$/);
  await navigate("Audit Logs");
  const auditPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all audit CSV", exact: true }).click();
  assert.match((await auditPromise).suggestedFilename(), /\.csv$/);
  await navigate("Backup & Security");
  assert.equal(await page.getByRole("button", { name: "Manual backup unavailable" }).isDisabled(), true);
  passed.push("Planning-template and complete audit CSV downloads dispatch; imports and manual backups stay disabled.");

  await start("intern"); await navigate("My Attendance");
  await page.getByRole("button", { name: "Clock In", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "clock_in" }).waitFor();
  await page.locator("#correction-date").fill("2026-10-10");
  await page.locator("#correction-clock-in").fill("22:00");
  await page.locator("#correction-clock-out").fill("06:00");
  await page.locator("#correction-end-date").fill("2026-10-11");
  await page.getByLabel("Reason / Explanation").fill("Preserved overnight correction draft");
  await page.getByRole("button", { name: "Submit Request" }).click();
  await page.getByRole("alert").filter({ hasText: "submit_correction" }).waitFor();
  assert.equal(await page.getByLabel("Reason / Explanation").inputValue(), "Preserved overnight correction draft");
  await navigate("My Documents");
  assert.equal(await page.getByRole("button", { name: "View file", exact: true }).first().isDisabled(), true);
  await navigate("Reports");
  const dtrPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export dtr CSV", exact: true }).click();
  assert.match((await dtrPromise).suggestedFilename(), /\.csv$/);
  assert.equal(await page.getByRole("button", { name: "Certificate unavailable" }).isDisabled(), true);
  passed.push("Clock-in and correction handlers reach the existing RPCs, failures retain overnight drafts; absent files are disabled; informational DTR CSV dispatches and certificate stays unavailable.");

  await page.evaluate(() => sessionStorage.setItem("synthetic-read-failure", "evaluations"));
  await start("intern");
  await page.getByRole("alert").filter({ hasText: "Evaluations unavailable" }).waitFor();
  assert.equal(await page.getByText("No evaluations yet", { exact: true }).count(), 0);
  await page.evaluate(() => sessionStorage.setItem("synthetic-read-failure", "attendance_exceptions"));
  await start("intern"); await navigate("My Attendance");
  await page.getByRole("alert").filter({ hasText: "Correction requests unavailable" }).waitFor();
  await page.evaluate(() => sessionStorage.removeItem("synthetic-read-failure"));
  passed.push("Failed evaluations and corrections display unavailable with retry instead of empty history.");

  await page.evaluate(() => {
    const key = "insync-synthetic-browser-data", state = JSON.parse(localStorage.getItem(key));
    const internId = "00000000-0000-4000-8000-000000000101";
    state.attendance_logs = [
      { id: "00000000-0000-4000-8000-000000000901", intern_id: internId, log_date: "2026-10-10", time_in: "22:00:00", time_out: "06:00:00", clocked_in_at: "2026-10-10T14:00:00Z", clocked_out_at: "2026-10-10T22:00:00Z", hours: 8, verified: false, verified_by: null },
      { id: "00000000-0000-4000-8000-000000000902", intern_id: internId, log_date: "2026-10-09", time_in: "08:00:00", time_out: "17:00:00", hours: 9, verified: true },
    ];
    localStorage.setItem(key, JSON.stringify(state));
  });
  await start("intern"); await navigate("My Attendance");
  const closedRow = page.locator("tbody tr").filter({ hasText: "8.00 logged" });
  assert.match(await closedRow.innerText(), /0.00 verified/);
  assert.match(await closedRow.innerText(), /Unverified/);
  assert.match(await closedRow.innerText(), /Ends Oct 11/);
  const legacyRow = page.locator("tbody tr").filter({ hasText: "Stored: 9" });
  assert.match(await legacyRow.innerText(), /Unknown/);
  assert.equal(await legacyRow.getByText("Verified", { exact: true }).count(), 0);
  passed.push("DTR uses existing evidence validation: unverified logged hours remain separate, overnight end date is explicit, legacy verification flags remain Unknown with raw stored hours retained.");

  await page.evaluate(() => sessionStorage.setItem("synthetic-read-failure", "my_profile"));
  await page.goto(`${origin}?role=intern`);
  await page.getByRole("heading", { name: "Account details unavailable" }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Welcome back" }).count(), 0);
  assert.equal(await page.locator(".dashboard-shell").count(), 0);
  await page.evaluate(() => sessionStorage.removeItem("synthetic-read-failure"));
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("heading", { name: /Hi,/ }).waitFor();
  passed.push("Failed signed-in profile retrieval gates the workspace with explicit unavailable/retry; retry restores the retained session without returning to login.");

  await start("instructor"); await navigate("Evaluations");
  await page.getByLabel("Select Intern", { exact: true }).selectOption("00000000-0000-4000-8000-000000000101");
  for (const criterion of RUBRIC) {
    await page.getByRole("button", { name: new RegExp(`^${criterion.label}: 4`) }).click();
  }
  await page.getByLabel("Feedback & Guidance").fill("Preserved evaluation draft");
  await page.getByRole("button", { name: "Submit Evaluation" }).click();
  await page.getByRole("alert").filter({ hasText: "submit_evaluation" }).waitFor();
  assert.equal(await page.getByLabel("Feedback & Guidance").inputValue(), "Preserved evaluation draft");
  await navigate("Announcements");
  await page.getByLabel("Subject").fill("Synthetic roster update");
  await page.getByLabel("Message", { exact: true }).fill("Synthetic browser-only announcement");
  await page.getByRole("button", { name: "Send Announcement", exact: true }).click();
  await page.getByText("Synthetic roster update", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Subject").inputValue(), "");
  await navigate("Reports");
  assert.equal(await page.getByRole("button", { name: "Export class PDF", exact: true }).isEnabled(), true);
  assert.equal(await page.getByRole("button", { name: "Export class Excel", exact: true }).isEnabled(), true);
  passed.push("Evaluation RPC failure retains all ratings/feedback; roster announcement saves through its existing insert handler; informational instructor reports are connected.");
  assert.deepEqual(errors, []);
  await writeFile(".client-review/redesign/results.json", JSON.stringify({ passed, errors, limits: "Synthetic transports only. RPCs absent in the existing fixture are deliberately checked as failures, not live successes. No live deployment or Storage delivery verification." }, null, 2));
  console.log(JSON.stringify({ passed, errors }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.message, browserErrors: errors, passed }, null, 2));
  if (currentPage) await currentPage.screenshot({ path: ".client-review/redesign/failure.png" });
  throw error;
} finally {
  if (browser) await browser.close();
  await server.close();
}
