import { useEffect, useRef } from "react"
import Icon from "./Icons"
import Brand from "../Brand"

const features = [
  { icon: "calendar", label: "Track attendance" },
  { icon: "document", label: "Manage submissions" },
  { icon: "chart", label: "Monitor progress" },
]

function ProgressIllustration() {
  return (
    <svg
      viewBox="0 0 560 350"
      className="h-auto w-full max-w-[560px]"
      role="img"
      aria-labelledby="illustration-title illustration-description"
    >
      <title id="illustration-title">Internship progress dashboard</title>
      <desc id="illustration-description">
        A student beside calendar, submission, and progress cards.
      </desc>
      <path
        d="M62 292c56-67 89-62 143-20 56 43 88-12 146-8 58 3 97 41 145 28"
        fill="none"
        stroke="#36d0c6"
        strokeOpacity=".25"
        strokeWidth="2"
      />
      <rect
        x="118"
        y="39"
        width="374"
        height="250"
        rx="24"
        fill="#fff"
        fillOpacity=".96"
      />
      <rect x="118" y="39" width="374" height="52" rx="24" fill="#eaf3f3" />
      <path d="M118 68h374v23H118z" fill="#eaf3f3" />
      <circle cx="148" cy="65" r="6" fill="#0f8c85" />
      <rect x="165" y="60" width="78" height="10" rx="5" fill="#b8cece" />
      <rect x="143" y="112" width="105" height="68" rx="14" fill="#f1f6f6" />
      <rect x="157" y="126" width="38" height="7" rx="3.5" fill="#799494" />
      <circle
        cx="180"
        cy="156"
        r="13"
        fill="none"
        stroke="#0f8c85"
        strokeWidth="7"
        strokeDasharray="65 18"
        transform="rotate(-90 180 156)"
      />
      <text x="204" y="158" fill="#0b1f33" fontSize="13" fontWeight="700">
        82%
      </text>
      <rect x="265" y="112" width="200" height="68" rx="14" fill="#f1f6f6" />
      <rect x="280" y="127" width="65" height="7" rx="3.5" fill="#799494" />
      <rect x="280" y="150" width="150" height="8" rx="4" fill="#d7e4e4" />
      <rect x="280" y="150" width="116" height="8" rx="4" fill="#0f8c85" />
      <rect x="143" y="198" width="322" height="65" rx="14" fill="#f1f6f6" />
      <path
        d="m166 244 35-21 32 11 42-25 37 15 44-29 41 17 41-17"
        fill="none"
        stroke="#0f8c85"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M166 249h272"
        stroke="#c8d9d9"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="201" cy="223" r="5" fill="#36d0c6" />
      <circle cx="275" cy="209" r="5" fill="#36d0c6" />
      <circle cx="356" cy="195" r="5" fill="#36d0c6" />
      <g transform="translate(40 112)">
        <circle cx="61" cy="41" r="29" fill="#efc8aa" />
        <path
          d="M33 43c1-27 13-41 33-39 15 1 26 12 28 27-10 2-20-2-28-12-8 13-19 21-33 24Z"
          fill="#18364d"
        />
        <path
          d="M31 89c8-18 20-27 36-27 17 0 30 9 39 27l14 79H10Z"
          fill="#0f8c85"
        />
        <path
          d="M47 73 65 91 84 72"
          fill="none"
          stroke="#fff"
          strokeWidth="4"
        />
        <rect x="68" y="99" width="68" height="48" rx="7" fill="#dbe8e8" />
        <path d="M78 113h45M78 124h33" stroke="#799494" strokeWidth="5" />
      </g>
      <g transform="translate(427 16)">
        <rect width="84" height="90" rx="16" fill="#0f8c85" />
        <path d="M18 30h48M18 47h48M18 64h30" stroke="#fff" strokeWidth="5" />
        <path
          d="m54 68 7 7 14-18"
          fill="none"
          stroke="#78eee6"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

export default function AuthLayout({ children, variant = "status" }) {
  const shell = useRef(null), formPanel = useRef(null)
  useEffect(() => { formPanel.current?.scrollTo({ top: 0 }) }, [variant])
  useEffect(() => {
    const viewport = window.visualViewport, element = shell.current
    // Mobile keyboards can reduce only the visual viewport, leaving dvh intact.
    // Keep that adjustment local to this shell; pinch zoom retains native behavior.
    const resize = () => {
      const available = viewport?.scale === 1 ? Math.min(window.innerHeight, viewport.height) : window.innerHeight
      if (available < window.innerHeight) element.style.setProperty("--auth-available-height", `${available}px`)
      else element.style.removeProperty("--auth-available-height")
      element.dataset.compactHeight = String(available <= 600)
    }
    resize()
    viewport?.addEventListener("resize", resize)
    window.addEventListener("resize", resize)
    return () => { viewport?.removeEventListener("resize", resize); window.removeEventListener("resize", resize) }
  }, [])
  return (
    <main ref={shell} className={`insync-auth auth-${variant}`}>
      <div className="auth-viewport">
        <section className="auth-brand-panel relative overflow-hidden bg-insync-navy px-6 py-6 sm:px-10 lg:flex lg:flex-col lg:px-12 lg:py-10 xl:px-16">
          <div
            className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full border border-white/8"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute top-10 -right-24 h-52 w-52 rounded-full border border-insync-mint/10"
            aria-hidden="true"
          />
          <Brand />
          <div className="auth-brand-copy relative z-10 mt-5 max-w-xl lg:mt-14">
            <h2 className="max-w-md text-2xl leading-tight font-bold tracking-[-0.035em] text-white sm:text-3xl lg:text-[2.65rem]">
              Stay connected. Stay on track.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300 sm:text-base lg:mt-5 lg:leading-7">
              Manage your internship attendance, submissions, and progress in
              one place.
            </p>
          </div>
          <div className="auth-illustration relative z-10 hidden items-center justify-center lg:flex">
            <ProgressIllustration />
          </div>
          <div className="auth-brand-features relative z-10 mt-7 hidden flex-wrap gap-3 lg:flex">
            {features.map((feature) => (
              <div
                key={feature.label}
                className="flex items-center gap-2.5 rounded-full bg-white/8 px-3.5 py-2 text-xs font-semibold text-slate-100 ring-1 ring-white/10"
              >
                <Icon
                  name={feature.icon}
                  className="h-4 w-4 text-insync-mint"
                />
                {feature.label}
              </div>
            ))}
          </div>
        </section>

        <section ref={formPanel} className="auth-form-panel" tabIndex={0}
          aria-label={variant === "register" ? "Registration form" : variant === "login" ? "Sign-in form" : "Account access"}>
          <div className="auth-form-inner">{children}</div>
        </section>
      </div>
    </main>
  )
}
