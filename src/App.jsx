import { useEffect, useRef, useState } from "react";
import { supabase, setupError } from "./lib/supabaseClient";
import LoginPage from "./components/LoginPage";
import AdminDashboard from "./components/AdminDashboard";
import InstructorDashboard from "./components/InstructorDashboard";
import InternDashboard from "./components/InternDashboard";
import AuthLayout from "./components/auth/AuthLayout";
import Notice from "./components/auth/Notice";
import { ErrorNotice, LoadingState } from "./components/UI";
import { useToast } from "./components/Toast";
import PasswordRecovery from "./components/PasswordRecovery";
import { clearRecoveryRoute, recoveryRoute } from "./lib/authRecovery";

export default function App() {
  if (setupError) return <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
    <h1 className="text-xl font-semibold">Setup required</h1>
    <p role="alert" className="max-w-xl text-sm">{setupError}</p>
    <p className="max-w-xl text-sm">Copy the .env file from the laptop where this project is configured, or copy .env.example to .env and fill in your Supabase project URL and public key. The example contains no project credentials. Restart development or rebuild and redeploy after setting them. See the README for setup steps.</p>
  </div>;
  return <ConfiguredApp />;
}

function ConfiguredApp() {
  const { toast } = useToast();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [profileRetry, setProfileRetry] = useState(0);
  const [recoveryMode, setRecoveryMode] = useState(() => recoveryRoute(window.location));
  const [restoring, setRestoring] = useState(true);
  const verifiedIdentity = useRef(null);
  const logoutInFlight = useRef(false);

  useEffect(() => {
    let current = true;
    let authRevision = 0;
    const acceptSession = newSession => {
      setRestoring(false);
      setSession(newSession);
      if (!newSession || newSession.user.id !== verifiedIdentity.current) {
        verifiedIdentity.current = null;
        setProfile(null);
        setProfileError(false);
        setLoading(Boolean(newSession));
      }
    };
    supabase.auth.getSession().then(({ data, error }) => {
      if (!current || authRevision !== 0) return;
      if (error) throw error;
      acceptSession(data.session);
    }).catch(error => {
      if (!current || authRevision !== 0) return;
      console.error("Failed to restore session:", error.message);
      setLoading(false);
      setRestoring(false);
      toast("Unable to restore your session. Please sign in again.", "error");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!current) return;
      authRevision++;
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      acceptSession(newSession);
    });

    return () => { current = false; listener.subscription.unsubscribe(); };
  }, [toast]);

  useEffect(() => {
    if (recoveryMode) { setLoading(false); return; }
    if (!session) return;
    let current = true;
    // Recheck access on refresh without unmounting same-account form drafts.
    // Identity changes still clear the previous workspace immediately.
    if (verifiedIdentity.current !== session.user.id) setLoading(true);
    setProfileError(false);
    supabase
      .rpc("my_profile")
      .then(({ data, error }) => {
        if (!current) return;
        if (error) console.error("Failed to load profile:", error.message);
        const valid = !error && data?.id === session.user.id &&
          ["Active", "Pending", "Inactive"].includes(data.status) &&
          (data.status !== "Active" || ["admin", "instructor", "intern"].includes(data.role));
        if (!valid && !error) console.error("Failed to load profile: invalid account response");
        verifiedIdentity.current = valid ? session.user.id : null;
        setProfile(valid ? data : null);
        setProfileError(!valid);
        setLoading(false);
      }).catch(error => {
        if (!current) return;
        console.error("Failed to load profile:", error.message);
        verifiedIdentity.current = null;
        setProfile(null); setProfileError(true); setLoading(false);
      });
    return () => { current = false; };
  }, [session, profileRetry, recoveryMode]);

  useEffect(() => {
    if (!session || recoveryMode) return;
    const check = () => { if (document.visibilityState === 'visible' && !logoutInFlight.current) setProfileRetry(n=>n+1); };
    const timer=setInterval(check,60000);
    window.addEventListener('focus',check); document.addEventListener('visibilitychange',check);
    return () => { clearInterval(timer); window.removeEventListener('focus',check); document.removeEventListener('visibilitychange',check); };
  }, [session, recoveryMode]);

  const handleLogout = async () => {
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      verifiedIdentity.current = null;
      setSession(null); setProfile(null); setProfileError(false);
      if (recoveryMode) { clearRecoveryRoute(); setRecoveryMode(false); }
    } catch (error) {
      console.error("Sign out failed:", error.message);
      toast("Unable to sign out. Check your connection and try again.", "error");
    } finally { logoutInFlight.current = false; }
  };

  if (recoveryMode) return <PasswordRecovery key={session?.user?.id || 'restoring-recovery'} session={session} restoring={restoring} onClose={() => {
    if (session) handleLogout();
    else { clearRecoveryRoute(); setRecoveryMode(false); }
  }} />;

  if (loading) {
    return <AuthLayout><LoadingState>Loading your workspace…</LoadingState></AuthLayout>;
  }

  if (session && profileError) {
    return <AuthLayout><div className="space-y-5">
      <h1 className="text-3xl font-bold">Account details unavailable</h1>
      <ErrorNotice title="Unable to load your account" onRetry={() => setProfileRetry(value => value + 1)}>
        Your session is signed in, but account access could not be verified. Retry or sign out.
      </ErrorNotice>
      <button onClick={handleLogout} className="action-secondary">Back to Sign In</button>
    </div></AuthLayout>;
  }

  if (!session || !profile) {
    return <LoginPage />;
  }

  if (profile.status !== "Active") {
    return (
      <AuthLayout><div className="space-y-5">
        <p className="page-eyebrow">INTERNSHIP PORTAL</p>
        <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
          {profile.status === "Pending" ? "Account pending activation" : "Account inactive"}
        </h1>
        <Notice tone="pending" title={`Account status: ${profile.status}`}>
          Your account is <strong>{profile.status}</strong>. An administrator needs to
          activate it before you can access internship records.
        </Notice>
        <button
          onClick={handleLogout}
          className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          Back to Sign In
        </button>
      </div></AuthLayout>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {profile.role === "admin" && <AdminDashboard profile={profile} onLogout={handleLogout} />}
      {profile.role === "instructor" && <InstructorDashboard profile={profile} onLogout={handleLogout} />}
      {profile.role === "intern" && <InternDashboard profile={profile} onLogout={handleLogout} />}
    </div>
  );
}
