import Icon from "./Icons"

export default function FormField({
  id,
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  autoComplete,
  inputMode,
  placeholder,
  helper,
  error,
  icon,
  disabled,
  required,
}) {
  const descriptionId = error
    ? `${id}-error`
    : helper
      ? `${id}-helper`
      : undefined

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-insync-navy"
      >
        {label}
        {required && (
          <span className="ml-1 text-slate-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="relative">
        {icon && (
          <Icon
            name={icon}
            className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400"
          />
        )}
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
          className={`min-h-12 w-full rounded-xl border bg-white py-3 pr-4 text-base text-insync-navy outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${
            icon ? "pl-12" : "pl-4"
          } ${
            error
              ? "border-red-400 ring-3 ring-red-100 focus:border-red-500 focus:ring-red-100"
              : "border-slate-300 hover:border-slate-400 focus:border-insync-teal focus:ring-3 focus:ring-insync-teal/15"
          }`}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}-helper`} className="mt-2 text-xs text-slate-500">
          {helper}
        </p>
      ) : null}
    </div>
  )
}
