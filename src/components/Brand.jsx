export default function Brand({ compact = false, inverse = true }) {
  return <div className={`brand ${inverse ? "brand-inverse" : ""}`} aria-label="INSync">
    <span className="brand-mark" aria-hidden="true">
      <span className="brand-link brand-link-first" /><span className="brand-link brand-link-second" />
    </span>
    {!compact && <span className="brand-word">IN<span>Sync</span></span>}
  </div>;
}
