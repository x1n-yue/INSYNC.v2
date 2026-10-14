import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import AuthLayout from "./auth/AuthLayout";
import FormField from "./auth/FormField";
import PasswordField from "./auth/PasswordField";
import Notice from "./auth/Notice";
import SubmitButton from "./auth/SubmitButton";
import Icon from "./auth/Icons";
import "./auth/auth.css";
import { requestPasswordReset } from "../lib/authRecovery";

const emptyValues = { fullName: "", studentId: "", organization: "", email: "", password: "", confirmPassword: "" };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values, registering, recovering) {
  const errors = {};
  if (!values.email.trim()) errors.email = "Email address is required.";
  else if (!emailPattern.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (!recovering && !values.password) errors.password = "Password is required.";
  if (registering) {
    if (!values.fullName.trim()) errors.fullName = "Full name is required.";
    if (values.password && values.password.length < 8) errors.password = "Password must be at least 8 characters.";
    if (!values.confirmPassword) errors.confirmPassword = "Please confirm your password.";
    else if (values.confirmPassword !== values.password) errors.confirmPassword = "Passwords do not match.";
  }
  return errors;
}

export default function LoginPage() {
  const [screen, setScreen] = useState("login");
  const [values, setValues] = useState(emptyValues);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const formRef = useRef(null);
  const headingRef = useRef(null);
  const busy = useRef(false);
  const registering = screen === "register";
  const recovering = screen === "recover";
  const validation = validate(values, registering, recovering);

  useEffect(() => { headingRef.current?.focus(); }, [screen, success]);

  const switchScreen = (nextScreen) => {
    if (busy.current) return;
    setScreen(nextScreen);
    setValues(current => ({ ...emptyValues, email: current.email }));
    setTouched({});
    setSubmitted(false);
    setError("");
    setSuccess(null);
  };

  const fieldProps = (field) => ({
    value: values[field],
    onChange: value => {
      setValues(current => ({ ...current, [field]: value }));
      setError("");
    },
    onBlur: () => setTouched(current => ({ ...current, [field]: true })),
    error: submitted || touched[field] ? validation[field] : undefined,
    disabled: loading,
  });

  const submit = async (event) => {
    event.preventDefault();
    if (busy.current) return;
    setSubmitted(true);
    setError("");
    if (Object.keys(validation).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    busy.current = true;
    setLoading(true);
    try {
      if (recovering) {
        const result = await requestPasswordReset(supabase, values.email, window.location);
        if (!result.ok) { setError(result.error); return; }
        setSuccess("recovery-email");
      } else if (registering) {
        const { data, error: authError } = await supabase.auth.signUp({
          email: values.email.trim(), password: values.password,
          options: { data: {
            full_name: values.fullName.trim(), requested_role: "intern",
            organization: values.organization.trim(), student_id: values.studentId.trim(),
          } },
        });
        if (authError) { setError(authError.message); return; }
        if (!data?.user) { setError("Registration could not be confirmed. Please try again."); return; }
        // Supabase obscures existing confirmed accounts. An empty identity list
        // must not be presented as a newly created account.
        const existingIdentity = Array.isArray(data.user.identities) && data.user.identities.length === 0;
        setSuccess(data.session ? "session" : existingIdentity ? "unconfirmed" : "confirmation");
        setValues(current => ({ ...current, password: "", confirmPassword: "" }));
        // App's existing auth listener handles immediate sessions and Pending access.
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: values.email.trim(), password: values.password,
        });
        if (authError) { setError(authError.message); return; }
        setValues(current => ({ ...current, password: "" }));
        setSubmitted(false);
        setTouched({});
        // App owns persistence, profile/status checks and role routing.
      }
    } catch {
      setError("Unable to reach authentication. Check your connection and try again.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const headingClass = "text-[2rem] leading-tight font-bold tracking-[-0.03em] text-insync-navy sm:text-4xl";
  const linkClass = "rounded font-bold text-insync-teal-dark outline-none hover:text-insync-navy focus-visible:ring-2 focus-visible:ring-insync-teal focus-visible:ring-offset-2 disabled:opacity-50";

  return (
    <AuthLayout variant={registering ? "register" : "login"}>
      {success ? (
        <div>
          <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Icon name={success === "session" ? "check" : "mail"} className="h-7 w-7" />
          </div>
          <p className="mb-3 text-xs font-bold tracking-[0.16em] text-insync-teal uppercase">{recovering ? "Password recovery" : "Intern registration"}</p>
          <h1 ref={headingRef} tabIndex={-1} className={headingClass}>
            {success === "session" ? "Account request submitted" : "Check your email"}
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600" role="status">
            {success === "recovery-email" ? "If this address has an eligible account, check your email for password recovery instructions. Requesting a reset does not change your account approval status." : success === "session"
              ? "You are signed in. Your Intern account is Pending until an administrator activates it."
              : success === "unconfirmed"
                ? "If this address is eligible for registration, follow any confirmation email from INSync. If you already have an account, sign in."
                : "Follow the Supabase confirmation link sent to your email address before signing in. Email confirmation does not activate your internship access."}
          </p>
          {!recovering && <div className="mt-6"><Notice tone="pending" title="Administrator approval required">
            New accounts are Intern accounts with Pending status. An administrator must approve access to internship records.
          </Notice></div>}
          <button type="button" onClick={() => switchScreen("login")} className="mt-8 flex min-h-12 w-full items-center justify-center rounded-xl bg-insync-teal px-5 py-3 text-sm font-bold text-white hover:bg-insync-teal-dark">Continue to sign in</button>
        </div>
      ) : (
        <div className="w-full">
          <div className={`auth-form-heading ${registering ? "mb-7" : "mb-8"}`}>
            <p className="mb-3 text-xs font-bold tracking-[0.16em] text-insync-teal uppercase">
              {registering ? "Intern registration" : "INTERNSHIP PORTAL"}
            </p>
            <h1 ref={headingRef} tabIndex={-1} className={headingClass}>
              {recovering ? "Recover your password" : registering ? "Create your intern account" : "Welcome back"}
            </h1>
            <p className="auth-form-intro mt-3 text-base leading-7 text-slate-600">
              {recovering ? "Request a secure recovery link for your account." : registering ? "Start managing your internship journey with INSync." : "Sign in to continue your internship journey."}
            </p>
          </div>
          <form ref={formRef} onSubmit={submit} noValidate aria-busy={loading}>
            {registering && <div className="mb-5 grid gap-5 sm:grid-cols-2">
              <FormField id="register-name" label="Full name" {...fieldProps("fullName")} autoComplete="name" placeholder="Alex Rivera" icon="user" required />
              <FormField id="register-student-id" label="Student ID" {...fieldProps("studentId")} autoComplete="off" placeholder="2025-00123" icon="id" helper="Optional" />
            </div>}
            <div className="space-y-5">
              {registering && <FormField id="register-organization" label="University / School" {...fieldProps("organization")} autoComplete="organization" placeholder="Polytechnic College of La Union" helper="Optional" />}
              <FormField id={`${screen}-email`} label="Email address" type="email" {...fieldProps("email")} autoComplete="email" inputMode="email" placeholder="you@university.edu" icon="mail" required />
              {!recovering && <PasswordField key={`${screen}-password`} id={`${screen}-password`} label="Password" {...fieldProps("password")} autoComplete={registering ? "new-password" : "current-password"} placeholder={registering ? "Create a password" : "Enter your password"} helper={registering ? "Use at least 8 characters." : undefined} required />}
              {registering && <PasswordField id="register-confirm-password" label="Confirm password" {...fieldProps("confirmPassword")} autoComplete="new-password" placeholder="Re-enter your password" required />}
            </div>
            {error && <div className="mt-5"><Notice tone="error" title={registering ? "Unable to create account" : "Unable to sign in"}>{error}</Notice></div>}
            {registering && <div className="mt-6"><Notice tone="info">
              New Intern accounts have Pending status and require administrator approval before internship records can be accessed.
            </Notice></div>}
            <div className={`auth-submit-row ${registering ? "mt-6" : "mt-7"}`}>
              <SubmitButton loading={loading} loadingLabel={recovering ? "Requesting link…" : registering ? "Creating account…" : "Signing in…"}>{recovering ? "Send recovery link" : registering ? "Create account" : "Sign in"}</SubmitButton>
            </div>
          </form>
          {!registering && !recovering && <div className="mt-3 text-right"><button type="button" disabled={loading} onClick={() => switchScreen("recover")} className={linkClass}>Forgot password?</button></div>}
          <p className="auth-form-footer mt-8 text-center text-sm text-slate-600">
            {registering || recovering ? "Already have an account?" : "New to INSync?"}{" "}
            <button type="button" onClick={() => switchScreen(registering || recovering ? "login" : "register")} disabled={loading} className={linkClass}>{registering || recovering ? "Sign in" : "Create an account"}</button>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
