// Supabase normally resolves {data,error}; transport adapters can also reject.
// Keep either failure explicit so one failed panel cannot strand the workspace.
export async function requestResult(request, context) {
  try {
    const result = await request;
    if (result.error) console.error(`${context}:`, result.error.message);
    return result;
  } catch (error) {
    console.error(`${context}:`, error?.message || error);
    return { data: null, error: { message: "Unable to retrieve this information. Check your connection and retry." } };
  }
}
