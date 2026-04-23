'use client'

import { useEffect, useRef } from 'react'

export function SignaturePad({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    canvas.width = Math.max(1, Math.floor(width * ratio))
    canvas.height = Math.max(1, Math.floor(height * ratio))
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#1f2937'

    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, width, height)
      img.src = value
    }
  }, [value])

  const drawPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const point = { x: clientX - rect.left, y: clientY - rect.top }
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!lastPointRef.current) {
      lastPointRef.current = point
      return
    }

    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPointRef.current = point
  }

  const finishStroke = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    drawingRef.current = false
    lastPointRef.current = null
    onChange(canvas.toDataURL('image/png'))
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <canvas
        ref={canvasRef}
        data-testid="quote-signature-canvas"
        aria-label="Signature canvas"
        onPointerDown={(event) => {
          if (typeof event.currentTarget.setPointerCapture === 'function') {
            event.currentTarget.setPointerCapture(event.pointerId)
          }
          drawingRef.current = true
          drawPoint(event.clientX, event.clientY)
        }}
        onPointerMove={(event) => {
          if (!drawingRef.current) return
          drawPoint(event.clientX, event.clientY)
        }}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={finishStroke}
        style={{
          width: '100%',
          height: 110,
          borderRadius: 12,
          border: '1px solid #d1d5db',
          background: '#fff',
          touchAction: 'none',
          cursor: 'crosshair',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button
          type="button"
          onClick={() => onChange('')}
          style={{
            border: '1px solid #d1d5db',
            background: '#fff',
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
        <div style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>
          Draw your signature above, or use typed signature below.
        </div>
      </div>
    </div>
  )
}
