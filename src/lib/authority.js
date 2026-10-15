// No authority decisions here: all RPCs authorize in Postgres. Normalize returned
// composites across SDK transports and reject empty/multi-row success responses.
export async function recordRpc(client, name, args = {}) {
  try {
    const { data, error } = await client.rpc(name, args);
    if (error) return { ok: false, error: error.message, data: null, errorCode: error.code || null };
    const row = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
    if (!row?.id) return { ok: false, error: "No single record returned; refresh and retry.", data: null };
    if (args.p_id && row.id !== args.p_id) return { ok: false, error: "Unexpected record returned; refresh and retry.", data: null };
    return { ok: true, data: row, error: null };
  } catch (error) {
    return { ok: false, data: null, error: error.message || "Request failed; retry." };
  }
}

export function manilaDate(instant = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}
