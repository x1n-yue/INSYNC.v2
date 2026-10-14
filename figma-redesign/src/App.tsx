import { useRef, useState, type FormEvent } from "react"
import AuthLayout from "./components/auth/AuthLayout"
import FormField from "./components/auth/FormField"
import Notice from "./components/auth/Notice"
import PasswordField from "./components/auth/PasswordField"
import SubmitButton from "./components/auth/SubmitButton"

type Screen = "login" | "register"
type LoginResult = "invalid" | "pending" | null

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function focusFirstInvalid(form: HTMLFormElement | null) {
  requestAnimationFrame(() => {
    form?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus()
  })
}

function LoginForm({ onRegister }: { onRegister: () => void }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LoginResult>(null)
  const [scenario, setScenario] = useState<LoginResult>("invalid")

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (!email.trim()) nextErrors.email = "Email address is required."
    else if (!emailPattern.test(email))
      nextErrors.email = "Enter a valid email address."
    if (!password) nextErrors.password = "Password is required."
    return nextErrors
  }

  const updateEmail = (value: string) => {
    setEmail(value)
    setScenario("invalid")
    setResult(null)
    if (touched.email) {
      setErrors((current) => ({
        ...current,
        email: !value.trim()
          ? "Email address is required."
          : !emailPattern.test(value)
            ? "Enter a valid email address."
            : "",
      }))
    }
  }

  const updatePassword = (value: string) => {
    setPassword(value)
    setResult(null)
    if (touched.password) {
      setErrors((current) => ({
        ...current,
        password: value ? "" : "Password is required.",
      }))
    }
  }

  const blurField = (field: "email" | "password") => {
    setTouched((current) => ({ ...current, [field]: true }))
    const nextErrors = validate()
    setErrors((current) => ({
      ...current,
      [field]: nextErrors[field] ?? "",
    }))
  }

  const chooseScenario = (nextScenario: Exclude<LoginResult, null>) => {
    setScenario(nextScenario)
    setResult(null)
    setErrors({})
    setTouched({})
    setEmail(
      nextScenario === "pending"
        ? "pending.intern@example.test"
        : "intern@example.test",
    )
    setPassword("demo-pass")
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validate()
    setTouched({ email: true, password: true })
    setErrors(nextErrors)
    setResult(null)

    if (Object.keys(nextErrors).length) {
      focusFirstInvalid(formRef.current)
      return
    }

    setLoading(true)
    window.setTimeout(() => {
      setLoading(false)
      setResult(scenario)
    }, 900)
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <p className="mb-3 text-xs font-bold tracking-[0.16em] text-insync-teal uppercase">
          Intern portal
        </p>
        <h1 className="text-[2rem] leading-tight font-bold tracking-[-0.03em] text-insync-navy sm:text-4xl">
          Welcome back
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Sign in to continue your internship journey.
        </p>
      </div>

      <form ref={formRef} onSubmit={submit} noValidate>
        <div className="space-y-5">
          <FormField
            id="login-email"
            label="Email address"
            type="email"
            value={email}
            onChange={updateEmail}
            onBlur={() => blurField("email")}
            autoComplete="email"
            inputMode="email"
            placeholder="you@university.edu"
            error={errors.email}
            icon="mail"
            disabled={loading}
            required
          />
          <PasswordField
            id="login-password"
            label="Password"
            value={password}
            onChange={updatePassword}
            onBlur={() => blurField("password")}
            autoComplete="current-password"
            placeholder="Enter your password"
            error={errors.password}
            disabled={loading}
            required
          />
        </div>

        {result === "invalid" && (
          <div className="mt-5">
            <Notice tone="error" title="Unable to sign in">
              These credentials could not be verified in this demo. Check your
              details or preview the pending account state below.
            </Notice>
          </div>
        )}
        {result === "pending" && (
          <div className="mt-5">
            <Notice tone="pending" title="Approval pending">
              Your account is awaiting administrator approval.
            </Notice>
          </div>
        )}

        <div className="mt-7">
          <SubmitButton loading={loading} loadingLabel="Signing in…">
            Sign in
          </SubmitButton>
        </div>

      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        New to INSync?{" "}
        <button
          type="button"
          onClick={onRegister}
          disabled={loading}
          className="rounded font-bold text-insync-teal-dark outline-none hover:text-insync-navy focus-visible:ring-2 focus-visible:ring-insync-teal focus-visible:ring-offset-2 disabled:opacity-50"
        >
          Create an account
        </button>
      </p>
    </div>
  )
}

type RegistrationValues = {
  fullName: string
  studentId: string
  email: string
  password: string
  confirmPassword: string
}

const initialRegistrationValues: RegistrationValues = {
  fullName: "",
  studentId: "",
  email: "",
  password: "",
  confirmPassword: "",
}

function RegistrationForm({ onLogin }: { onLogin: () => void }) {
  const formRef = useRef<HTMLFormElement>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const [values, setValues] = useState(initialRegistrationValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const validate = (nextValues = values) => {
    const nextErrors: Record<string, string> = {}
    if (!nextValues.fullName.trim())
      nextErrors.fullName = "Full name is required."
    if (!nextValues.studentId.trim())
      nextErrors.studentId = "Student ID is required."
    if (!nextValues.email.trim())
      nextErrors.email = "Email address is required."
    else if (!emailPattern.test(nextValues.email))
      nextErrors.email = "Enter a valid email address."
    if (!nextValues.password) nextErrors.password = "Password is required."
    else if (nextValues.password.length < 8)
      nextErrors.password = "Password must be at least 8 characters."
    if (!nextValues.confirmPassword)
      nextErrors.confirmPassword = "Please confirm your password."
    else if (nextValues.confirmPassword !== nextValues.password)
      nextErrors.confirmPassword = "Passwords do not match."
    return nextErrors
  }

  const update = (field: keyof RegistrationValues, value: string) => {
    const nextValues = { ...values, [field]: value }
    setValues(nextValues)
    if (touched[field]) setErrors(validate(nextValues))
  }

  const blur = (field: keyof RegistrationValues) => {
    setTouched((current) => ({ ...current, [field]: true }))
    const nextErrors = validate()
    setErrors((current) => ({
      ...current,
      [field]: nextErrors[field] ?? "",
    }))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validate()
    setTouched({
      fullName: true,
      studentId: true,
      email: true,
      password: true,
      confirmPassword: true,
    })
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length) {
      focusFirstInvalid(formRef.current)
      return
    }

    setLoading(true)
    window.setTimeout(() => {
      setLoading(false)
      setValues((current) => ({
        ...current,
        password: "",
        confirmPassword: "",
      }))
      setSuccess(true)
      requestAnimationFrame(() => successRef.current?.focus())
    }, 1000)
  }

  if (success) {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        className="outline-none"
        aria-labelledby="registration-success-title"
      >
        <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              d="m5 12 4 4L19 6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="mb-3 text-xs font-bold tracking-[0.16em] text-insync-teal uppercase">
          Registration complete
        </p>
        <h1
          id="registration-success-title"
          className="text-[2rem] leading-tight font-bold tracking-[-0.03em] text-insync-navy sm:text-4xl"
        >
          Account created
        </h1>
        <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
          Account created. Your account is awaiting administrator approval.
        </p>
        <div className="mt-6">
          <Notice tone="pending" title="What happens next?">
            An administrator will review your account before internship records
            can be accessed.
          </Notice>
        </div>
        <div className="mt-8">
          <button
            type="button"
            onClick={onLogin}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-insync-teal px-5 py-3 text-sm font-bold text-white shadow-sm outline-none hover:bg-insync-teal-dark focus-visible:ring-3 focus-visible:ring-insync-teal/30 focus-visible:ring-offset-2"
          >
            Continue to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-7">
        <p className="mb-3 text-xs font-bold tracking-[0.16em] text-insync-teal uppercase">
          Intern registration
        </p>
        <h1 className="text-[2rem] leading-tight font-bold tracking-[-0.03em] text-insync-navy sm:text-4xl">
          Create your intern account
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Start managing your internship journey with INSync.
        </p>
      </div>

      <form ref={formRef} onSubmit={submit} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="register-name"
            label="Full name"
            value={values.fullName}
            onChange={(value) => update("fullName", value)}
            onBlur={() => blur("fullName")}
            autoComplete="name"
            placeholder="Alex Rivera"
            error={errors.fullName}
            icon="user"
            disabled={loading}
            required
          />
          <FormField
            id="register-student-id"
            label="Student ID"
            value={values.studentId}
            onChange={(value) => update("studentId", value)}
            onBlur={() => blur("studentId")}
            autoComplete="off"
            placeholder="2025-00123"
            error={errors.studentId}
            icon="id"
            disabled={loading}
            required
          />
        </div>
        <div className="mt-5 space-y-5">
          <FormField
            id="register-email"
            label="Email address"
            type="email"
            value={values.email}
            onChange={(value) => update("email", value)}
            onBlur={() => blur("email")}
            autoComplete="email"
            inputMode="email"
            placeholder="you@university.edu"
            error={errors.email}
            icon="mail"
            disabled={loading}
            required
          />
          <PasswordField
            id="register-password"
            label="Password"
            value={values.password}
            onChange={(value) => update("password", value)}
            onBlur={() => blur("password")}
            autoComplete="new-password"
            placeholder="Create a password"
            helper="Use at least 8 characters."
            error={errors.password}
            disabled={loading}
            required
          />
          <PasswordField
            id="register-confirm-password"
            label="Confirm password"
            value={values.confirmPassword}
            onChange={(value) => update("confirmPassword", value)}
            onBlur={() => blur("confirmPassword")}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            error={errors.confirmPassword}
            disabled={loading}
            required
          />
        </div>

        <div className="mt-6">
          <Notice tone="info">
            New accounts require administrator approval before internship
            records can be accessed.
          </Notice>
        </div>
        <div className="mt-6">
          <SubmitButton loading={loading} loadingLabel="Creating account…">
            Create account
          </SubmitButton>
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onLogin}
          disabled={loading}
          className="rounded font-bold text-insync-teal-dark outline-none hover:text-insync-navy focus-visible:ring-2 focus-visible:ring-insync-teal focus-visible:ring-offset-2 disabled:opacity-50"
        >
          Sign in
        </button>
      </p>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("login")

  return (
    <AuthLayout>
      {screen === "login" ? (
        <LoginForm onRegister={() => setScreen("register")} />
      ) : (
        <RegistrationForm onLogin={() => setScreen("login")} />
      )}
    </AuthLayout>
  )
}
