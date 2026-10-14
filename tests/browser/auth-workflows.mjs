// Local browser checks with env loading disabled and all remote requests blocked.
// Uses the optional Playwright install described in tests/README.md.
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
const fixture = path.resolve("tests/browser/auth-client.js");
const server = await createServer({ configFile: false, envFile: false, cacheDir: path.resolve(".client-review/node_modules/.vite-auth"), plugins: [
  { name: "synthetic-auth", enforce: "pre", resolveId(source) {
    if (/(?:^|\/)supabaseClient(?:\.js)?$/.test(source)) return fixture;
  } }, react(), tailwind(),
], server: { host: "127.0.0.1", port: 0 } });
let browser;
const passed = [], errors = [];
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  const executablePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  const mode = value => page.evaluate(value => { window.__authTest.mode = value; }, value);
  const login = async (query = "") => {
    await page.goto(origin + query);
    await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  };
  const register = async () => {
    await page.getByRole("button", { name: "Create an account", exact: true }).click();
    await page.getByRole("heading", { name: "Create your intern account" }).waitFor();
  };
  const fillLogin = async () => {
    await page.getByLabel("Email address", { exact: false }).fill("intern@example.invalid");
    await page.locator("#login-password").fill("synthetic-secret");
  };
  const fillRegistration = async () => {
    await page.getByLabel("Full name", { exact: false }).fill("Synthetic Student");
    await page.getByLabel("Student ID", { exact: true }).fill("SYN-123");
    await page.getByLabel("University / School", { exact: true }).fill("Synthetic School");
    await page.locator("#register-email").fill("intern@example.invalid");
    await page.locator("#register-password").fill("synthetic-secret");
    await page.locator("#register-confirm-password").fill("synthetic-secret");
  };
  const widthCheck = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const documentCheck = async () => {
    assert.equal(await page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1 && window.scrollY === 0), true, "Authentication must not scroll the document");
    assert.equal(await page.locator(".auth-form-panel").evaluate(el => getComputedStyle(el).overflowY), "auto");
  };
  const fitsPanel = async () => assert.equal(await page.locator(".auth-form-panel").evaluate(el => el.scrollHeight <= el.clientHeight + 1), true, "Desktop login must fit its panel, including errors");
  const reachable = async control => {
    await control.scrollIntoViewIfNeeded();
    const bounds = await control.boundingBox(), panel = await page.locator(".auth-form-panel").boundingBox();
    assert.ok(bounds.y >= panel.y - 1 && bounds.y + bounds.height <= panel.y + panel.height + 1, "Control must be fully reachable inside the form panel");
    await documentCheck();
  };
  const brandGeometry = async () => page.locator(".auth-brand-panel .brand, .auth-brand-copy, .auth-illustration, .auth-brand-features").evaluateAll(elements => elements.map(el => {
    const box = el.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height };
  }));
  const fullScreenCheck = async width => {
    const geometry = await page.locator(".auth-viewport").evaluate(el => {
      const box = el.getBoundingClientRect(), style = getComputedStyle(el);
      return { x: box.x, width: box.width, height: box.height, viewportHeight: innerHeight, radius: style.borderRadius, shadow: style.boxShadow };
    });
    assert.equal(geometry.x, 0);
    assert.equal(geometry.width, width);
    assert.ok(Math.abs(geometry.height - geometry.viewportHeight) <= 1);
    assert.equal(geometry.radius, "0px");
    assert.equal(geometry.shadow, "none");
    await documentCheck();
    if (width >= 1024) {
      const brand = await page.locator(".auth-brand-panel").boundingBox();
      const form = await page.locator(".auth-form-panel").boundingBox();
      assert.equal(brand.x, 0);
      assert.ok(Math.abs(brand.width / width - .45) < .001);
      assert.ok(Math.abs(brand.x + brand.width - form.x) < 1);
      assert.ok(Math.abs(form.x + form.width - width) < 1);
    }
  };
  await mkdir(".client-review/auth", { recursive: true });

  for (const [width, height] of [[1440, 1000], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [720, 450], [390, 844], [320, 568], [390, 360], [1440, 420], [1024, 420], [320, 360], [390, 240]]) {
    await page.setViewportSize({ width, height });
    await login();
    await fullScreenCheck(width);
    assert.equal(await page.locator('[aria-invalid="true"]').count(), 0);
    assert.equal(await page.locator(".insync-auth > div > section").first().evaluate(el => getComputedStyle(el).backgroundColor), "rgb(11, 31, 51)");
    assert.equal(await page.getByRole("button", { name: "Sign in", exact: true }).evaluate(el => getComputedStyle(el).backgroundColor), "rgb(14, 131, 125)");
    if (width >= 1024) {
      const illustration = await page.getByRole("img", { name: /Internship progress dashboard/ }).boundingBox();
      assert.ok(illustration.width > 0 && illustration.width <= 560);
      assert.ok(illustration.height > 0);
      const scale = await page.getByRole("img", { name: /Internship progress dashboard/ }).evaluate(svg => { const matrix = svg.getScreenCTM(); return { x: matrix.a, y: matrix.d }; });
      assert.ok(Math.abs(scale.x - scale.y) < .001, "The SVG drawing must retain its proportions");
      const brand = await page.locator(".auth-brand-panel").boundingBox();
      for (const item of await brandGeometry()) assert.ok(item.y >= brand.y - 1 && item.y + item.height <= brand.y + brand.height + 1, "Branding must fit within the stationary panel");
    }
    await widthCheck();
    if (width >= 1024 && height >= 720) {
      await fitsPanel();
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.getByText("Email address is required.", { exact: true }).waitFor();
      await page.getByText("Password is required.", { exact: true }).waitFor();
      await fitsPanel();
      await reachable(page.getByRole("button", { name: "Sign in", exact: true }));
      await reachable(page.getByRole("button", { name: "Create an account", exact: true }));
      await fillLogin();
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "Invalid login credentials" }).waitFor();
      await fitsPanel();
      await login();
    } else {
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await reachable(page.locator("#login-email"));
      await reachable(page.locator("#login-password"));
      await reachable(page.getByRole("button", { name: "Sign in", exact: true }));
      await reachable(page.getByRole("button", { name: "Create an account", exact: true }));
      await page.locator(".auth-form-panel").evaluate(el => { el.scrollTop = 0; });
    }
    if ([1440, 390].includes(width) && height > 500) await page.screenshot({ path: `.client-review/auth/login-${width}.png`, fullPage: true });
    await register();
    await fullScreenCheck(width);
    assert.equal(await page.locator('[aria-invalid="true"]').count(), 0);
    await widthCheck();
    const brandingBefore = await brandGeometry();
    if (width >= 1024 && height <= 768) {
      const before = await page.locator(".auth-form-panel").evaluate(el => el.scrollTop);
      const panel = await page.locator(".auth-form-panel").boundingBox();
      await page.mouse.move(panel.x + panel.width / 2, panel.y + panel.height / 2);
      await page.mouse.wheel(0, 400);
      await page.waitForFunction(before => document.querySelector(".auth-form-panel").scrollTop > before, before);
      await documentCheck();
    }
    for (const input of await page.locator("input").all()) {
      await reachable(input);
    }
    await reachable(page.getByRole("button", { name: "Create account", exact: true }));
    await reachable(page.getByRole("status").filter({ hasText: "New Intern accounts have Pending status" }));
    await reachable(page.getByRole("button", { name: "Sign in", exact: true }));
    assert.deepEqual(await brandGeometry(), brandingBefore, "Scrolling registration must not move the branding");
    assert.equal(await page.getByRole("button", { name: "Create account", exact: true }).isVisible(), true);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.getByText("Full name is required.", { exact: true }).waitFor();
    await reachable(page.locator("#register-name"));
    await reachable(page.locator("#register-confirm-password"));
    await reachable(page.getByRole("button", { name: "Create account", exact: true }));
    await reachable(page.getByRole("button", { name: "Sign in", exact: true }));
    await page.locator(".auth-form-panel").evaluate(el => { el.scrollTop = 0; });
    if ([1440, 390].includes(width) && height > 500) await page.screenshot({ path: `.client-review/auth/register-${width}.png`, fullPage: true });
  }
  passed.push("Authentication at 13 viewport sizes: fixed viewport shell and 45/55 desktop split, no document scrolling, stationary branding, registration wheel scroll confined to the right panel, all controls/errors/links reachable. Normal desktop login fits with field and authentication errors. Narrow/short sizes model zoom and keyboard space constraints.");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login();
  assert.equal(await page.getByText("INTERNSHIP PORTAL", { exact: true }).count(), 1);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByText("Email address is required.", { exact: true }).waitFor();
  assert.equal(await page.locator("#login-email").evaluate(el => el === document.activeElement), true);
  await page.locator("#login-email").fill("invalid");
  await page.getByText("Enter a valid email address.", { exact: true }).waitFor();
  await fillLogin();
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  assert.equal(await page.locator("#login-password").getAttribute("type"), "text");
  assert.equal(await page.getByRole("button", { name: "Hide password", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  await page.locator("#login-password").focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.getByRole("button", { name: "Show password", exact: true }).evaluate(el => el === document.activeElement && getComputedStyle(el).outlineStyle !== "none"), true);
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#login-password").getAttribute("type"), "text");
  await mode("hold");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Signing in…", exact: true }).waitFor();
  await page.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  assert.equal(await page.evaluate(() => window.__authTest.signIns), 1);
  assert.equal(await page.getByRole("button", { name: "Create an account" }).isDisabled(), true);
  await page.evaluate(() => window.__authTest.release());
  await page.getByRole("alert").filter({ hasText: "Synthetic authentication failure" }).waitFor();
  await mode("offline");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Check your connection" }).waitFor();
  passed.push("Required/email validation, first-error focus, named visibility toggle, loading lock, duplicate prevention and thrown network error recovery.");

  // Model a keyboard that shrinks visualViewport while layout height stays 844px.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    if (!new URLSearchParams(location.search).has("keyboard-test")) return;
    const viewport = new EventTarget();
    Object.assign(viewport, { height: 844, scale: 1 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  });
  await login("?keyboard-test=1");
  await page.evaluate(() => { window.visualViewport.height = 260; window.visualViewport.dispatchEvent(new Event("resize")); });
  assert.equal((await page.locator(".insync-auth").boundingBox()).height, 260);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await reachable(page.locator("#login-email"));
  await reachable(page.locator("#login-password"));
  await reachable(page.getByRole("button", { name: "Sign in", exact: true }));
  await reachable(page.getByRole("button", { name: "Create an account", exact: true }));
  await register();
  await reachable(page.locator("#register-confirm-password"));
  await reachable(page.getByRole("button", { name: "Create account", exact: true }));
  await reachable(page.getByRole("button", { name: "Sign in", exact: true }));
  await page.evaluate(() => { window.visualViewport.height = 844; window.visualViewport.dispatchEvent(new Event("resize")); });
  assert.equal((await page.locator(".insync-auth").boundingBox()).height, 844);
  passed.push("Synthetic keyboard overlay shrinks only the auth shell to visualViewport height; login/registration controls stay reachable and shell height restores when it closes.");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login();

  await register();
  assert.equal(await page.locator("#register-password").inputValue(), "");
  await page.locator("#register-name").fill("Synthetic Student");
  await page.locator("#register-name").blur();
  assert.equal(await page.locator('[aria-invalid="true"]').count(), 0);
  await fillRegistration();
  await page.locator("#register-password").fill("short");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByText("Password must be at least 8 characters.", { exact: true }).waitFor();
  await page.getByText("Passwords do not match.", { exact: true }).waitFor();
  await fillRegistration();
  await mode("hold");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("button", { name: "Creating account…" }).waitFor();
  await page.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  assert.equal(await page.evaluate(() => window.__authTest.signUps), 1);
  await page.evaluate(() => window.__authTest.release());
  await page.getByRole("alert").filter({ hasText: "Synthetic registration failure" }).waitFor();
  assert.equal(await page.locator("#register-name").inputValue(), "Synthetic Student");
  await mode("confirmation");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.__authTest.metadata), {
    full_name: "Synthetic Student", requested_role: "intern", organization: "Synthetic School", student_id: "SYN-123",
  });
  assert.equal(await page.getByText("Administrator approval required", { exact: true }).count(), 1);
  await page.getByRole("button", { name: "Continue to sign in" }).click();
  assert.equal(await page.locator("#login-password").inputValue(), "");
  passed.push("Registration password/match validation, duplicate prevention, failed draft retention, original metadata with Intern-only request, actual confirmation branch and password clearing.");

  await register(); await fillRegistration(); await mode("existing");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByText(/If this address is eligible/).waitFor();
  passed.push("Supabase empty-identity response uses conditional wording without claiming a new account.");
  for (const status of ["pending", "restricted"]) {
    await login(); await fillLogin(); await mode(status);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("heading", { name: status === "restricted" ? "Account inactive" : "Account pending activation" }).waitFor();
    await page.getByRole("button", { name: "Back to Sign In" }).click();
    await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  }
  await register(); await fillRegistration(); await mode("immediate");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("heading", { name: "Account pending activation" }).waitFor();
  passed.push("Real App session listener routes confirmation-off signup, Pending login and Inactive login to existing access restriction; sign-out returns to login.");
  for (const role of ["admin", "instructor", "intern"]) {
    await login(`?role=${role}`); await fillLogin(); await mode("active");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("heading", { name: /Hi,/ }).waitFor();
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.locator(".dashboard-content .loading-state").waitFor({ state: "hidden" });
    const scrolling = await page.locator(".dashboard-content").evaluate(el => {
      el.scrollTop = 200;
      return { overflow: getComputedStyle(el).overflowY, scrollTop: el.scrollTop };
    });
    assert.equal(scrolling.overflow, "auto");
    assert.ok(scrolling.scrollTop > 0, "Dashboard scrolling must remain usable after authentication");
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflowY), "visible");
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto(origin + "?role=intern&session=1");
  await page.getByRole("heading", { name: /Hi,/ }).waitFor();
  passed.push("All three Active role dashboards use the existing App role architecture; restored synthetic session reaches the intern dashboard.");
  await login("?restore-error=1");
  await page.getByRole("alert").filter({ hasText: "Unable to restore your session" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Sign in", exact: true }).isEnabled(), true);
  passed.push("Failed session restoration shows a concise error and reachable real sign-in form, rather than remaining in loading state.");
  assert.deepEqual(errors, []);
  await writeFile(".client-review/auth/results.json", JSON.stringify({ passed, errors, limits: "Local Chrome with synthetic Supabase only; no live Auth, email delivery, JWT/RLS or deployment verification." }, null, 2));
  console.log(JSON.stringify({ passed, errors }, null, 2));
} finally {
  if (browser) await browser.close();
  await server.close();
}
