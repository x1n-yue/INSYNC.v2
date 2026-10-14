import type { ReactNode } from "react"

type SubmitButtonProps = {
  children: ReactNode
  loading: boolean
  loadingLabel: string
}

export default function SubmitButton({
  children,
  loading,
  loadingLabel,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-insync-teal px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(15,140,133,0.18)] outline-none transition hover:bg-insync-teal-dark focus-visible:ring-3 focus-visible:ring-insync-teal/30 focus-visible:ring-offset-2 disabled:cursor-wait disabled:bg-insync-teal/75"
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden="true"
        />
      )}
      {loading ? loadingLabel : children}
    </button>
  )
}
