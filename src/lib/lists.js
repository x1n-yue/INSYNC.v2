import { manilaDate } from "./authority";

export function calendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const n = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value ? n : null;
}
export function dateRange(period, start = "", end = "", now = new Date()) {
  if (period === "all") return { start: "", end: "", error: null };
  if (period === "custom") {
    if (calendarDate(start) === null || calendarDate(end) === null) return { error: "Enter two valid calendar dates." };
    if (start > end) return { error: "Start date must be on or before end date." };
    return { start, end, error: null };
  }
  const today = manilaDate(now), n = calendarDate(today);
  if (n === null) return { error: "Current calendar date unavailable." };
  const iso = n => new Date(n).toISOString().slice(0, 10);
  if (period === "week") {
    const monday = n - ((new Date(n).getUTCDay() + 6) % 7) * 86400000;
    return { start: iso(monday), end: iso(monday + 6 * 86400000), error: null };
  }
  if (period === "month") return { start: `${today.slice(0, 7)}-01`,
    end: iso(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)), error: null };
  return { error: "Unknown period." };
}
export function filterEvaluations(rows, range) {
  if (range.error) return [];
  return rows.filter(row => {
    if (!range.start && !range.end) return true; // retain unknown legacy dates in All
    const instant = new Date(row.created_at);
    if (!row.created_at || !Number.isFinite(instant.getTime())) return false;
    const date = manilaDate(instant);
    return (!range.start || date >= range.start) && (!range.end || date <= range.end);
  });
}
export function filterRoster(rows, search = "", section = "") {
  const query = search.trim().toLocaleLowerCase();
  return rows.filter(row => (!section || (section === "unassigned" ? !row.sectionId : row.sectionId === section)) &&
    (!query || [row.name, row.studentId, row.company].some(v => String(v ?? "").toLocaleLowerCase().includes(query))));
}
export function paginate(rows, page = 1, size = 10) {
  size = [10, 25, 50, 100].includes(Number(size)) ? Number(size) : 10;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  page = Math.min(pages, Math.max(1, Math.trunc(Number(page)) || 1));
  const offset = (page - 1) * size;
  return { rows: rows.slice(offset, offset + size), page, size, pages, total: rows.length,
    from: rows.length ? offset + 1 : 0, to: Math.min(offset + size, rows.length) };
}
