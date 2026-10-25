import { useEffect, useMemo, useRef, useState } from 'react'
import { BoardController } from '../controller'
import { elementBox, frameOf, SELECTION_PAD, selectionHandles } from '../geometry'
import { useLive } from '../live'
import { highlighterOpacity, outlineToPath, strokeOutline } from '../render'
import { useStore } from '../store'
import { THEMES, type Pattern, type Theme } from '../theme'
import type { Camera } from '../types'
import { ElementView } from './ElementView'
import { PadFrame } from './ZoomPad'

export let boardController: BoardController | null = null

export function Board() {
  const ref = useRef<SVGSVGElement>(null)
  const elements = useStore((s) => s.elements)
  const camera = useStore((s) => s.camera)
  const themeKey = useStore((s) => s.settings.theme)
  const pattern = useStore((s) => s.settings.pattern)
  const anim = useStore((s) => s.anim)
  const editingId = useStore((s) => s.editing?.id)
  const tool = useStore((s) => s.tool)
  const erasing = useLive((s) => s.erasing)
  const theme = THEMES[themeKey]
  const erasingSet = useMemo(() => new Set(erasing), [erasing])

  useEffect(() => {
    const svg = ref.current!
    const c = new BoardController(svg)
    boardController = c
    const noMenu = (e: Event) => e.preventDefault()
    svg.addEventListener('pointerdown', c.onPointerDown)
    window.addEventListener('pointermove', c.onPointerMove)
    window.addEventListener('pointerup', c.onPointerUp)
    window.addEventListener('pointercancel', c.onPointerCancel)
    svg.addEventListener('pointerleave', c.onPointerLeave)
    svg.addEventListener('wheel', c.onWheel, { passive: false })
    svg.addEventListener('contextmenu', noMenu)
    return () => {
      svg.removeEventListener('pointerdown', c.onPointerDown)
      window.removeEventListener('pointermove', c.onPointerMove)
      window.removeEventListener('pointerup', c.onPointerUp)
      window.removeEventListener('pointercancel', c.onPointerCancel)
      svg.removeEventListener('pointerleave', c.onPointerLeave)
      svg.removeEventListener('wheel', c.onWheel)
      svg.removeEventListener('contextmenu', noMenu)
      boardController = null
    }
  }, [])

  return (
    <svg ref={ref} className={`board tool-${tool}`} style={{ background: theme.bg }}>
      <BoardPattern camera={camera} pattern={pattern} color={theme.pattern} />
      <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.z})`}>
        {elements.map((el) =>
          el.id === editingId ? null : (
            <ElementView key={el.id} el={el} theme={theme} anim={anim[el.id]} faded={erasingSet.has(el.id)} />
          ),
        )}
        <LiveLayer theme={theme} />
        <SelectionLayer theme={theme} z={camera.z} />
        <PadFrame theme={theme} z={camera.z} />
      </g>
      <LaserLayer camera={camera} />
    </svg>
  )
}

function BoardPattern({ camera, pattern, color }: { camera: Camera; pattern: Pattern; color: string }) {
  if (pattern === 'none') return null
  const gap = pattern === 'dots' ? 28 : pattern === 'grid' ? 32 : 40
  let size = gap * camera.z
  // Con mucho zoom out el patrón se vuelve ruido: se agranda en potencias de 2.
  while (size < 14) size *= 2
  const ox = ((camera.x % size) + size) % size
  const oy = ((camera.y % size) + size) % size
  return (
    <>
      <defs>
        <pattern id="bg-pattern" width={size} height={size} patternUnits="userSpaceOnUse" x={ox} y={oy}>
          {pattern === 'dots' && <circle cx={size / 2} cy={size / 2} r={Math.max(0.9, Math.min(1.6, camera.z * 1.3))} fill={color} />}
          {pattern === 'grid' && <path d={`M ${size} 0 L 0 0 0 ${size}`} fill="none" stroke={color} strokeWidth={1} />}
          {pattern === 'lines' && <path d={`M 0 ${size - 0.5} L ${size} ${size - 0.5}`} fill="none" stroke={color} strokeWidth={1} />}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg-pattern)" />
    </>
  )
}

function LiveLayer({ theme }: { theme: Theme }) {
  const stroke = useLive((s) => s.stroke)
  const preview = useLive((s) => s.preview)
  const snapped = useLive((s) => s.snapped)
  const marquee = useLive((s) => s.marquee)
  const z = useStore((s) => s.camera.z)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (!snapped) return
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 320)
    return () => clearTimeout(t)
  }, [snapped])

  return (
    <g pointerEvents="none">
      {stroke && (
        <path
          d={outlineToPath(strokeOutline(stroke, false))}
          fill={theme.palette[stroke.color]}
          opacity={stroke.highlighter ? highlighterOpacity(theme) : undefined}
        />
      )}
      {preview && (
        <g className={flash ? 'snap-flash' : undefined}>
          <ElementView el={preview} theme={theme} />
        </g>
      )}
      {marquee && (
        <rect
          x={marquee.minX}
          y={marquee.minY}
          width={marquee.maxX - marquee.minX}
          height={marquee.maxY - marquee.minY}
          className="marquee"
          strokeWidth={1 / z}
          strokeDasharray={`${4 / z} ${4 / z}`}
        />
      )}
    </g>
  )
}

function SelectionLayer({ theme, z }: { theme: Theme; z: number }) {
  const selection = useStore((s) => s.selection)
  const elements = useStore((s) => s.elements)
  const editing = useStore((s) => s.editing)
  const rotating = useLive((s) => s.frame)
  const selected = useMemo(() => {
    const ids = new Set(selection)
    return elements.filter((e) => ids.has(e.id))
  }, [selection, elements])
  const boxes = useMemo(() => (selected.length > 1 ? selected.map(elementBox) : []), [selected])
  const frame = rotating ?? frameOf(selected)
  if (!frame || editing) return null
  const accent = theme.ui === 'dark' ? '#8AB4FF' : '#3B6FE0'
  const pad = SELECTION_PAD / z
  const r = 6 / z
  const handles = selectionHandles(frame, z)
  return (
    <g pointerEvents="none">
      {boxes.map((b, i) => (
          <rect
            key={i}
            x={b.minX}
            y={b.minY}
            width={b.maxX - b.minX}
            height={b.maxY - b.minY}
            fill="none"
            stroke={accent}
            strokeOpacity={0.45}
            strokeWidth={1 / z}
          />
        ))}
      <rect
        x={frame.cx - frame.w / 2 - pad}
        y={frame.cy - frame.h / 2 - pad}
        width={frame.w + pad * 2}
        height={frame.h + pad * 2}
        transform={frame.angle ? `rotate(${(frame.angle * 180) / Math.PI} ${frame.cx} ${frame.cy})` : undefined}
        fill="none"
        stroke={accent}
        strokeWidth={1.5 / z}
        rx={4 / z}
      />
      {/* manilla para girar */}
      <line x1={handles.top[0]} y1={handles.top[1]} x2={handles.rotate[0]} y2={handles.rotate[1]} stroke={accent} strokeWidth={1.5 / z} />
      <circle className="handle" cx={handles.rotate[0]} cy={handles.rotate[1]} r={r} fill={accent} stroke={accent} strokeWidth={1.5 / z} />
      {handles.corners.map(([x, y], i) => (
        <circle key={i} className="handle" cx={x} cy={y} r={r} fill={theme.bg} stroke={accent} strokeWidth={1.5 / z} />
      ))}
    </g>
  )
}

const LASER_MS = 900

function LaserLayer({ camera }: { camera: Camera }) {
  const trails = useLive((s) => s.laser)
  const [now, setNow] = useState(() => performance.now())
  const active = trails.length > 0

  useEffect(() => {
    if (!active) return
    let raf = 0
    const tick = () => {
      const t = performance.now()
      const alive = useLive
        .getState()
        .laser.map((tr) => tr.filter((p) => t - p[2] < LASER_MS))
        .filter((tr) => tr.length > 0)
      const cur = useLive.getState().laser
      if (alive.length !== cur.length || alive.some((tr, i) => tr.length !== cur[i].length)) useLive.getState().set({ laser: alive })
      setNow(t)
      if (alive.length > 0) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])

  if (trails.length === 0) return null
  return (
    <g pointerEvents="none" filter="url(#laser-glow)">
      <defs>
        <filter id="laser-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {trails.map((tr, i) => {
        const pts = tr.map(([x, y, t]) => [x * camera.z + camera.x, y * camera.z + camera.y, Math.max(0, 1 - (now - t) / LASER_MS)])
        if (pts.length === 0) return null
        const outline = strokeOutline({ points: pts, width: 7, pressure: true }, true)
        return <path key={i} d={outlineToPath(outline)} fill="#FF3B3B" />
      })}
    </g>
  )
}
