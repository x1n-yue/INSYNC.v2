import { IconAlertTriangle, IconCalendar, IconFolder } from "./Icons";

export function PageHeader({ title, description, eyebrow, actions, date = false }) {
  return <header className="page-header">
    <div className="min-w-0">
      {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
      <h1 tabIndex={-1}>{title}</h1>
      {description && <div className="page-description">{description}</div>}
    </div>
    <div className="page-actions">
      {date && <span className="business-date"><IconCalendar size={16} />{new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Manila" })}</span>}
      {actions}
    </div>
  </header>;
}

export function MetricCard({ icon, label, value, sub, warn = false, onClick, selected = false, help, describedBy, controls }) {
  const Tag = onClick ? "button" : "article";
  return <Tag className={`metric-card ui-card ${warn ? "metric-warning" : ""} ${onClick ? "metric-interactive" : ""}`}
    {...(onClick ? { type: "button", onClick, "aria-pressed": selected, "aria-label": `${label}: ${value}. ${sub ? `${sub}. ` : ""}Show qualifying interns`,
      "aria-describedby": describedBy, "aria-controls": controls } : {})} title={help}>
    <span className="metric-icon">{icon}</span>
    <span className="metric-value block">{value}</span>
    <span className="metric-label block">{label}</span>
    {sub && <span className="metric-description block">{sub}</span>}
  </Tag>;
}

const tones = {
  Active: "success", Approved: "success", Completed: "success", "On Track": "success", Eligible: "success", Verified: "success",
  Pending: "warning", "Near Complete": "info", "Needs Revision": "danger", Rejected: "danger", "At Risk": "danger",
  Inactive: "neutral", Unknown: "neutral", Unavailable: "neutral", Incomplete: "warning", Unverified: "warning", "In Progress": "info",
};
export function StatusBadge({ status }) {
  return <span className={`status-badge status-${tones[status] || "neutral"}`}><span aria-hidden="true" />{status || "Unknown"}</span>;
}

export function LoadingState({ children = "Loading…" }) {
  return <div className="loading-state" role="status"><span className="loading-spinner" aria-hidden="true" />{children}</div>;
}

export function ErrorNotice({ title = "Unable to load this section", children, onRetry }) {
  return <div className="error-notice" role="alert"><IconAlertTriangle size={20} />
    <div className="min-w-0 flex-1"><p className="font-semibold">{title}</p>{children && <p className="text-sm mt-1">{children}</p>}</div>
    {onRetry && <button onClick={onRetry} className="action-secondary">Retry</button>}
  </div>;
}

export function EmptyState({ title, children, icon = <IconFolder size={24} />, actions }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><p className="font-semibold">{title}</p>{children && <p className="text-sm muted-copy mt-1">{children}</p>}{actions&&<div className="empty-actions">{actions}</div>}</div>;
}
