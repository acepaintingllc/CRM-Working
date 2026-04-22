import type { CSSProperties, HTMLAttributes } from 'react'

type CrmDenseActionRowProps = HTMLAttributes<HTMLDivElement> & {
  className?: string
  align?: 'start' | 'between'
  style?: CSSProperties
}

export function CrmDenseActionRow({
  children,
  className = '',
  align = 'start',
  style,
  ...props
}: CrmDenseActionRowProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${
        align === 'between' ? 'justify-between' : 'justify-start'
      } ${className}`.trim()}
      style={style}
      {...props}
    >
      {children}
    </div>
  )
}
