import type { ReactNode } from "react"
import Icon, { type IconName } from "./Icons"

type NoticeTone = "error" | "info" | "pending"

type NoticeProps = {
  children: ReactNode
  tone: NoticeTone
  title?: string
}

const styles: Record<NoticeTone, {
  wrapper: string
  icon: string
  iconName: IconName
}> = {
  error: {
    wrapper: "border-red-200 bg-red-50 text-red-950",
    icon: "bg-red-100 text-red-700",
    iconName: "alert",
  },
  info: {
    wrapper: "border-sky-200 bg-sky-50 text-sky-950",
    icon: "bg-sky-100 text-sky-700",
    iconName: "info",
  },
  pending: {
    wrapper: "border-amber-200 bg-amber-50 text-amber-950",
    icon: "bg-amber-100 text-amber-700",
    iconName: "calendar",
  },
}

export default function Notice({ children, tone, title }: NoticeProps) {
  const style = styles[tone]
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 ${style.wrapper}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.icon}`}
      >
        <Icon name={style.iconName} className="h-4 w-4" />
      </span>
      <div className="pt-0.5 text-sm leading-5">
        {title && <p className="mb-0.5 font-bold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  )
}
