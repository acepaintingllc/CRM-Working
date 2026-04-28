'use client'

import type { CSSProperties, ReactNode, RefObject } from 'react'
import { ScopeAccordionRow, type SharedStyles } from './EstimateV2EditorPrimitives'

type WrapperStyles = SharedStyles & {
  scopePill: CSSProperties
}

function EstimateV2SectionAccordion({
  title,
  sectionRef,
  styles,
  expanded,
  onToggle,
  summary,
  children,
}: {
  title: string
  sectionRef: RefObject<HTMLDivElement | null>
  styles: WrapperStyles
  expanded: boolean
  onToggle: () => void
  summary: ReactNode
  children: ReactNode
}) {
  return (
    <div ref={sectionRef}>
      <ScopeAccordionRow
        title={title}
        expanded={expanded}
        onToggle={onToggle}
        summary={summary}
        styles={styles}
      >
        {children}
      </ScopeAccordionRow>
    </div>
  )
}

export function EstimateV2WallsSection(props: Omit<Parameters<typeof EstimateV2SectionAccordion>[0], 'title'>) {
  return <EstimateV2SectionAccordion {...props} title="Walls" />
}

export function EstimateV2CeilingsSection(props: Omit<Parameters<typeof EstimateV2SectionAccordion>[0], 'title'>) {
  return <EstimateV2SectionAccordion {...props} title="Ceilings" />
}

export function EstimateV2TrimSection(props: Omit<Parameters<typeof EstimateV2SectionAccordion>[0], 'title'>) {
  return <EstimateV2SectionAccordion {...props} title="Trim" />
}

export function EstimateV2DoorsSection(props: Omit<Parameters<typeof EstimateV2SectionAccordion>[0], 'title'>) {
  return <EstimateV2SectionAccordion {...props} title="Doors" />
}
