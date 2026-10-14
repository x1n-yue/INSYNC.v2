export function recoveryRoute(location) {
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  return url.searchParams.get('auth') === 'recovery' || fragment.get('type') === 'recovery';
}
export function recoveryRedirect(location) {
  const url = new URL(location.href);
  url.search = ''; url.hash = ''; url.searchParams.set('auth', 'recovery');
  return url.href;
}
export function clearRecoveryRoute(browser = window) {
  const url = new URL(browser.location.href);
  url.searchParams.delete('auth');
  for (const key of ['code', 'error', 'error_code', 'error_description']) url.searchParams.delete(key);
  url.hash = '';
  browser.history.replaceState(null, '', url.pathname + url.search);
}
export async function requestPasswordReset(client, email, location) {
  const address = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return { ok: false, error: 'Enter a valid email address.' };
  try {
    const { error } = await client.auth.resetPasswordForEmail(address, { redirectTo: recoveryRedirect(location) });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch { return { ok: false, error: 'Unable to reach authentication. Check your connection and retry.' }; }
}
export async function changeRecoveredPassword(client, ownerId, password, confirmation) {
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
  if (password !== confirmation) return { ok: false, error: 'Passwords do not match.' };
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !ownerId || data?.user?.id !== ownerId) return { ok: false, error: 'Recovery session unavailable or expired. Request a new link.' };
    const result = await client.auth.updateUser({ password });
    if (result.error) return { ok: false, error: result.error.message };
    if (result.data?.user?.id !== ownerId) return { ok: false, error: 'Password update could not be confirmed. Try signing in or request a new link.' };
    return { ok: true };
  } catch { return { ok: false, error: 'Password update could not be confirmed. Check your connection before retrying.' }; }
}
