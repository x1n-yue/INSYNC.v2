import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import LoginPage from "./components/LoginPage";
import AdminDashboard from "./components/AdminDashboard";
import InstructorDashboard from "./components/InstructorDashboard";
import InternDashboard from "./components/InternDashboard";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    supabase
      .rpc("my_profile")
      .then(({ data, error }) => {
        if (error) console.error("Failed to load profile:", error.message);
        setProfile(data ?? null);
        setLoading(false);
      });
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  if (!session || !profile) {
    return <LoginPage />;
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background)", color: "var(--muted-foreground)" }}
      >
        Loading…
      </div>
    );
  }

  if (profile.status !== "Active") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center"
        style={{ background: "var(--background)" }}
      >
        <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Account pending activation
        </h1>
        <p style={{ color: "var(--muted-foreground)" }}>
          Your account is <strong>{profile.status}</strong>. An administrator needs to
          activate it before you can access internship records.
        </p>
        <button
          onClick={handleLogout}
          className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          Back to Sign In
        </button>
      </div>
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
