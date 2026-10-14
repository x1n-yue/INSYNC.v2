import { afterEach, describe, expect, it, vi } from "vitest";
import { historicalDocumentLink, signedFileLink } from "../src/lib/documents";
import { requestResult } from "../src/lib/requests";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const owner = "00000000-0000-4000-8000-000000000101";
const version = { id: "version", document_id: "requirement", intern_id: owner, version_no: 1, committed_at: "2026-10-12T00:00:00Z", file_path: `${owner}/old.pdf`, file_name: "old.pdf" };
const doc = { history_version_id: version.id, document_id: version.document_id, intern_id: owner, upload_version: 1 };
function client(row = version, failure = null) {
  const sign = vi.fn(async () => ({ data: { signedUrl: "https://synthetic.invalid/private-file" } }));
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn(async () => ({ data: row, error: failure })) };
  return { from: vi.fn(() => query), storage: { from: vi.fn(() => ({ createSignedUrl: sign })) }, sign, query };
}
describe("private document links", () => {
  it("includes response latency in the 60-second lifetime", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const c = client(); c.sign.mockImplementation(async () => { vi.setSystemTime(25000); return { data: { signedUrl: "https://synthetic.invalid/private-file" } }; });
    expect(await signedFileLink(c, version)).toMatchObject({ ok: true, expiresAt: 60000 });
    expect(c.sign).toHaveBeenCalledWith(version.file_path, 60, {});
  });
  it("never offers a link that expired before the response arrived", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const c = client(); c.sign.mockImplementation(async () => { vi.setSystemTime(60000); return { data: { signedUrl: "https://synthetic.invalid/private-file" } }; });
    expect(await signedFileLink(c, version)).toMatchObject({ ok: false, url: null, error: expect.stringContaining("expired") });
  });
  it("rechecks historical identity through RLS, then signs a retained version", async () => {
    const c = client(); expect(await historicalDocumentLink(c, doc, true)).toMatchObject({ ok: true });
    expect(c.query.eq).toHaveBeenCalledWith("id", doc.history_version_id);
    expect(c.sign).toHaveBeenCalledWith(version.file_path, 60, { download: version.file_name });
  });
  it.each([null, { ...version, committed_at: null }, { ...version, document_id: "other" }, { ...version, intern_id: "other" }, { ...version, version_no: 2 }, { ...version, file_path: "other/old.pdf" }])("does not sign missing, staged or mismatched evidence %j", async row => {
    const c = client(row); expect(await historicalDocumentLink(c, doc)).toMatchObject({ ok: false, url: null }); expect(c.sign).not.toHaveBeenCalled();
  });
  it("preserves RLS and Storage failures instead of inventing a URL", async () => {
    const c = client(null, { message: "Synthetic denied" });
    expect(await historicalDocumentLink(c, doc)).toMatchObject({ ok: false }); expect(c.sign).not.toHaveBeenCalled();
    const d = client(); d.sign.mockResolvedValue({ error: { message: "Synthetic missing file" } });
    expect(await historicalDocumentLink(d, doc)).toMatchObject({ ok: false, url: null });
  });
});
describe("independent data panels", () => {
  it("normalizes a rejected transport as explicit unavailable data, with useful diagnostics", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await requestResult(Promise.reject(new Error("Synthetic transport rejection")), "Assignment retrieval failed");
    expect(result.data).toBeNull(); expect(result.error.message).toContain("retry");
    expect(log).toHaveBeenCalledWith("Assignment retrieval failed:", "Synthetic transport rejection");
  });
  it("retains an SDK error and a successful zero count as distinct outcomes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { message: "Synthetic forbidden", code: "42501" };
    expect(await requestResult(Promise.resolve({ data: null, error }), "Read")).toEqual({ data: null, error });
    expect(await requestResult(Promise.resolve({ data: [], count: 0, error: null }), "Read")).toEqual({ data: [], count: 0, error: null });
  });
});
