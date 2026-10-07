import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { manilaDate } from "../src/lib/authority";
import { formatBusinessDate } from "../src/lib/attendance";

const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const admin = source("src/components/AdminDashboard.jsx");
const intern = source("src/components/InternDashboard.jsx");

function between(text, start, end) {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Source probe boundary missing: ${start}`);
  return text.slice(from, to);
}

// Remaining characterization cases assert audited defects. The owner date check
// now asserts corrected behavior; server interval tests live in the SQL suite.
// Replace other probes with desired-behavior tests when their findings are fixed.
// No extracted handler may access a real client, credentials, or records.
describe("audit baseline characterization (known defects, not remediation)", () => {
  it("INS-012: owner clock display uses the Manila date at early morning boundaries", () => {
    const clock = new Date("2026-10-07T00:30:00+08:00");
    vi.useFakeTimers();
    try {
      vi.setSystemTime(clock);
      expect(manilaDate()).toBe("2026-10-07");
      expect(manilaDate(new Date("2026-10-07T00:00:00+08:00"))).toBe("2026-10-07");
      expect(manilaDate(new Date("2026-10-07T07:59:00+08:00"))).toBe("2026-10-07");
      expect(manilaDate(new Date("2026-10-07T08:00:00+08:00"))).toBe("2026-10-07");
    } finally {
      vi.useRealTimers();
    }
  });

  // INS-016's extracted computeHours probe is replaced by actual Postgres
  // correction_instants/review tests in m01-authority.test.js. No client clamp.

  it.each([["0", 486], ["", 486], ["abc", 486], ["-1", -1], ["1.5", 1.5]])(
    "INS-018: required_hours %j is coerced to %s", (value, saved) => {
      const expression = admin.match(/required_hours: (Number\(form\.required_hours\)[^,\n]+)/)?.[1];
      expect(expression).toBeTruthy();
      expect(new Function("form", `return ${expression};`)({ required_hours: value })).toBe(saved);
    },
  );

  it("INS-039: zero-row assignment write still changes local state and claims success", async () => {
    const persisted = { id: "synthetic-intern", required_hours: 486 };
    let localRows = [{ ...persisted }];
    const toast = vi.fn();
    const refreshAudit = vi.fn();
    const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null, data: [], count: 0 })) }));
    const declaration = between(admin, "  const saveInternAssignment =", "  const attachStandardDocs =");
    const save = new Function("supabase", "internForms", "setSavingInternId", "setInternRows", "internsForTab", "refreshAudit", "toast",
      `${declaration}; return saveInternAssignment;`)(
      { from: () => ({ update }) },
      { [persisted.id]: { required_hours: "100", company_id: "", instructor_id: "" } },
      vi.fn(), (apply) => { localRows = apply(localRows); },
      [{ id: persisted.id, full_name: "Synthetic Intern" }], refreshAudit, toast,
    );
    await save(persisted.id);
    expect(persisted.required_hours).toBe(486);
    expect(localRows[0].required_hours).toBe(100);
    expect(toast).toHaveBeenCalledWith("Synthetic Intern updated");
    expect(refreshAudit).toHaveBeenCalledOnce();
    expect(admin).not.toContain("addLog"); // No fake audit on the remaining zero-row defect.
  });

  it("INS-011: maybeSingle detects duplicate response after sending the PATCH", async () => {
    const transport = vi.fn(async () => new Response(JSON.stringify([{ id: "one" }, { id: "two" }]), {
      status: 200, headers: { "Content-Type": "application/json" },
    }));
    const client = createClient("https://audit.invalid", "synthetic-public-placeholder", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: transport },
    });
    const result = await client.from("attendance_logs").update({ time_out: "17:00" })
      .eq("intern_id", "00000000-0000-4000-8000-000000000001").eq("log_date", "2026-10-07").select().maybeSingle();
    expect(transport).toHaveBeenCalledOnce();
    expect(transport.mock.calls[0][1].method).toBe("PATCH");
    expect(result.error?.code).toBe("PGRST116");
    expect(result.data).toBeNull();
  });

  it("INS-025: chart merges October across years and averages daily hours", () => {
    const declaration = between(intern, "    const withHours =", "  }, [dtr]);");
    const derive = new Function("dtr", "formatBusinessDate", declaration);
    const result = derive([
      { log_date: "2025-10-07", hours: 8 },
      { log_date: "2026-10-07", hours: 4 },
      { log_date: "2026-10-08", hours: 8 },
    ], formatBusinessDate);
    expect(result.Monthly).toEqual([{ day: "Oct", hours: 6.7 }]);
    expect(result["All Time"]).toEqual(result.Monthly);
  });

  it("INS-034: current success/warning token pairs fail small-text contrast", () => {
    const css = source("src/index.css");
    const token = (name) => css.match(new RegExp(`--${name}: (#[0-9a-f]{6});`, "i"))?.[1];
    const luminance = (hex) => hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255)
      .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
    expect(ratio(token("success"), token("success-bg"))).toBeCloseTo(3.00, 1);
    expect(ratio(token("warning"), token("warning-bg"))).toBeCloseTo(2.86, 1);
    expect(ratio(token("success"), "#ffffff")).toBeLessThan(4.5);
  });
});
