import Link from 'next/link'
import type { ButtonHTMLAttributes, ComponentPropsWithoutRef, ReactNode } from 'react'
import { crmButtonClassName, type CrmButtonTone } from '@/app/crm/_components/crmStyles'

type SharedProps = {
  children: ReactNode
  tone?: CrmButtonTone
  className?: string
}

type ButtonProps = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined
  }

type LinkProps = SharedProps & Omit<ComponentPropsWithoutRef<typeof Link>, 'className' | 'href'> & { href: string }

export function CrmButton(props: ButtonProps | LinkProps) {
  if ('href' in props && props.href) {
    const { href, children, tone = 'secondary', className, ...linkProps } = props

    return (
      <Link href={href} className={crmButtonClassName(tone, className)} {...linkProps}>
        {children}
      </Link>
    )
  }

  const { children, tone = 'secondary', className, type, ...buttonProps } = props as ButtonProps
  const buttonType: NonNullable<ButtonHTMLAttributes<HTMLButtonElement>['type']> =
    type === 'submit' || type === 'reset' ? type : 'button'

  return (
    <button type={buttonType} className={crmButtonClassName(tone, className)} {...buttonProps}>
      {children}
    </button>
  )
}
