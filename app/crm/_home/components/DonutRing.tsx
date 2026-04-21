type DonutRingProps = {
  pct: number
  label: string
}

export function DonutRing({ pct, label }: DonutRingProps) {
  const size = 100
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const filled = Math.min(100, Math.max(0, pct))
  const dash = (filled / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={50}
          cy={50}
          r={radius}
          fill="none"
          stroke="var(--crm-border)"
          strokeWidth={10}
        />
        <circle
          cx={50}
          cy={50}
          r={radius}
          fill="none"
          stroke="var(--crm-accent)"
          strokeWidth={10}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="absolute text-base font-extrabold" style={{ color: 'var(--crm-text)' }}>
        {label}
      </span>
    </div>
  )
}
