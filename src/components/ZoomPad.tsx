/**
 * Lupa de escritura: un panel abajo donde escribes GRANDE con el dedo y en la pizarra queda
 * chico y ordenado (como la "ventana de zoom" de GoodNotes). Tiene renglón guía y avanza sola
 * cuando llegas al margen derecho.
 */
import { ChevronLeft, ChevronRight, CornerDownLeft, Minus, Move, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { boxesIntersect, dist, elementBox, hitDistance } from '../geometry'
import { InkSession } from '../ink'
import { useLive } from '../live'
import { highlighterOpacity, outlineToPath, strokeOutline } from '../render'
import { screenToWorld, useStore, type PadTarget } from '../store'
import { SIZES, THEMES, type Theme } from '../theme'
import type { Vec } from '../types'
import { ElementView } from './ElementView'

const ADVANCE_AT = 0.7
const ADVANCE_TO = 0.28

export function padRect() {
  const W = window.innerWidth
  const H = window.innerHeight
  const h = Math.round(Math.min(320, Math.max(190, H * 0.34)))
  const w = Math.min(W - 24, 1400)
  // Queda sobre los botones de abajo (deshacer, zoom), que siguen a mano.
  return { left: Math.round((W - w) / 2), top: H - h - 70, width: w, height: h }
}

export function openPad() {
  const s = useStore.getState()
  const r = padRect()
  const z = s.camera.z
  const w = r.width / 3 / z
  // Buscar un hueco libre arriba-izquierda para no escribir encima de lo que ya hay.
  const frameW = r.width / 3
  const frameH = r.height / 3
  const left = s.ui.stylePanel && !s.ui.hidden ? 264 : 60
  const boxes = s.elements.map(elementBox)
  let top = 84
  for (let y = 84; y + frameH < r.top - 16; y += frameH / 2) {
    const a = screenToWorld(s.camera, [left, y])
    const b = screenToWorld(s.camera, [left + frameW, y + frameH])
    const area = { minX: a[0], minY: a[1], maxX: b[0], maxY: b[1] }
    if (!boxes.some((bb) => boxesIntersect(area, bb))) {
      top = y
      break
    }
  }
  const start = screenToWorld(s.camera, [left, top])
  s.setPad({ x: start[0], y: start[1], w, lineStartX: start[0] })
  s.setUI({ pad: true })
}

export function closePad() {
  useStore.getState().setUI({ pad: false })
}

export function togglePad() {
  if (useStore.getState().ui.pad) closePad()
  else openPad()
}

/** Mueve la zona de escritura (animado) y mantiene la cámara principal mostrándola. */
function moveTarget(next: PadTarget) {
  const s = useStore.getState()
  const from = s.pad
  if (!from) return
  const t0 = performance.now()
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / 200)
    const e = 1 - (1 - k) ** 3
    useStore.getState().setPad({ ...next, x: from.x + (next.x - from.x) * e, y: from.y + (next.y - from.y) * e })
    if (k < 1) requestAnimationFrame(step)
    else keepTargetVisible()
  }
  requestAnimationFrame(step)
}

function keepTargetVisible() {
  const s = useStore.getState()
  const pad = s.pad
  if (!pad) return
  const r = padRect()
  const c = s.camera
  const th = (pad.w * r.height) / r.width
  const left = pad.x * c.z + c.x
  const right = (pad.x + pad.w) * c.z + c.x
  const top = pad.y * c.z + c.y
  const bottom = (pad.y + th) * c.z + c.y
  let dx = 0
  let dy = 0
  if (right > window.innerWidth - 30) dx = window.innerWidth - 30 - right
  if (left + dx < 30) dx = 30 - left
  if (bottom > r.top - 16) dy = r.top - 16 - bottom
  if (top + dy < 70) dy = 70 - top
  if (dx || dy) s.setCamera({ ...c, x: c.x + dx, y: c.y + dy })
}

export function padNewLine() {
  const s = useStore.getState()
  const pad = s.pad
  if (!pad) return
  const r = padRect()
  const th = (pad.w * r.height) / r.width
  moveTarget({ ...pad, x: pad.lineStartX, y: pad.y + th * 0.62 })
}

function nudge(dir: number) {
  const pad = useStore.getState().pad
  if (pad) moveTarget({ ...pad, x: pad.x + dir * pad.w * 0.4 })
}

function setMagnification(factor: number) {
  const pad = useStore.getState().pad
  if (!pad) return
  const w = Math.min(4000, Math.max(20, pad.w / factor))
  useStore.getState().setPad({ ...pad, w })
  keepTargetVisible()
}

/** Marco punteado en la pizarra principal que muestra dónde cae lo que escribes en la lupa. */
export function PadFrame({ theme, z }: { theme: Theme; z: number }) {
  const open = useStore((s) => s.ui.pad)
  const pad = useStore((s) => s.pad)
  if (!open || !pad) return null
  const r = padRect()
  const th = (pad.w * r.height) / r.width
  const accent = theme.ui === 'dark' ? '#8AB4FF' : '#3B6FE0'
  return (
    <g pointerEvents="none">
      <rect
        x={pad.x}
        y={pad.y}
        width={pad.w}
        height={th}
        fill={accent}
        fillOpacity={0.05}
        stroke={accent}
        strokeOpacity={0.7}
        strokeWidth={1.25 / z}
        strokeDasharray={`${5 / z} ${4 / z}`}
        rx={4 / z}
      />
      <line
        x1={pad.x}
        x2={pad.x + pad.w}
        y1={pad.y + th * 0.68}
        y2={pad.y + th * 0.68}
        stroke={accent}
        strokeOpacity={0.35}
        strokeWidth={1 / z}
      />
    </g>
  )
}

export function ZoomPad() {
  const open = useStore((s) => s.ui.pad)
  const pad = useStore((s) => s.pad)
  const elements = useStore((s) => s.elements)
  const themeKey = useStore((s) => s.settings.theme)
  const anim = useStore((s) => s.anim)
  const camera = useStore((s) => s.camera)
  const theme = THEMES[themeKey]
  const svgRef = useRef<SVGSVGElement>(null)
  const [rect, setRect] = useState(padRect)
  const liveStroke = useLive((s) => s.stroke)
  const livePreview = useLive((s) => s.preview)
  const live = livePreview ?? liveStroke
  const erasing = useLive((s) => s.erasing)

  useEffect(() => {
    const onResize = () => setRect(padRect())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const th = pad ? (pad.w * rect.height) / rect.width : 0
  const zp = pad ? rect.width / pad.w : 1

  const visible = useMemo(() => {
    if (!pad) return []
    const view = { minX: pad.x, minY: pad.y, maxX: pad.x + pad.w, maxY: pad.y + th }
    return elements.filter((e) => boxesIntersect(view, elementBox(e)))
  }, [elements, pad, th])

  // Entrada del panel (dibujar / borrar / dos dedos para mover la zona).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !open) return
    let session: InkSession | null = null
    let erase: { hits: Set<string> } | null = null
    let activeId = -1
    const touches = new Map<number, Vec>()
    let twoFinger: { mid: Vec; pad: PadTarget; start: number; moved: boolean } | null = null

    const local = (e: PointerEvent): Vec => {
      const r = svg.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top]
    }
    const toWorld = (p: Vec): Vec => {
      const pd = useStore.getState().pad!
      const k = svg.getBoundingClientRect().width / pd.w
      return [pd.x + p[0] / k, pd.y + p[1] / k]
    }
    const midOf = (): Vec => {
      const [a, b] = [...touches.values()]
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    }

    const eraseAt = (p: Vec) => {
      if (!erase) return
      const w = toWorld(p)
      const pd = useStore.getState().pad!
      const r = (14 * pd.w) / svg.getBoundingClientRect().width
      for (const el of useStore.getState().elements) {
        if (!erase.hits.has(el.id) && hitDistance(el, w) <= r) erase.hits.add(el.id)
      }
      useLive.getState().set({ erasing: [...erase.hits] })
    }

    const down = (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const p = local(e)
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, p)
        if (touches.size === 2) {
          session?.cancel()
          session = null
          useLive.getState().set({ stroke: null, preview: null })
          twoFinger = { mid: midOf(), pad: useStore.getState().pad!, start: performance.now(), moved: false }
          return
        }
        if (touches.size > 2) return
      }
      if (activeId !== -1) return
      svg.setPointerCapture(e.pointerId)
      activeId = e.pointerId
      const s = useStore.getState()
      if (s.tool === 'eraser') {
        erase = { hits: new Set() }
        eraseAt(p)
        return
      }
      const preset = SIZES[s.style.size]
      const k = svg.getBoundingClientRect().width / s.pad!.w
      const highlighter = s.tool === 'highlighter'
      session = new InkSession(toWorld, {
        highlighter,
        color: s.style.color,
        width: ((highlighter ? preset.highlighter : preset.pen) * 1.3) / k,
        shapeWidth: (preset.shape * 1.3) / k,
        smoothing: s.settings.smoothing,
        quickShape: s.settings.quickShape,
        rough: s.style.rough,
        fill: s.style.fill,
        worldPerPx: 1 / k,
      })
      session.add(p, e.pressure, e.pointerType === 'pen')
    }

    const move = (e: PointerEvent) => {
      const p = local(e)
      if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
        touches.set(e.pointerId, p)
        if (twoFinger && touches.size >= 2) {
          const m = midOf()
          if (dist(m, twoFinger.mid) > 8) twoFinger.moved = true
          const k = svg.getBoundingClientRect().width / twoFinger.pad.w
          useStore.getState().setPad({
            ...twoFinger.pad,
            x: twoFinger.pad.x - (m[0] - twoFinger.mid[0]) / k,
            y: twoFinger.pad.y - (m[1] - twoFinger.mid[1]) / k,
          })
          return
        }
      }
      if (e.pointerId !== activeId) return
      if (erase) return eraseAt(p)
      if (!session) return
      const evs = e.getCoalescedEvents?.() ?? []
      if (evs.length > 1) for (const ce of evs) session.add(local(ce), ce.pressure, ce.pointerType === 'pen')
      else session.add(p, e.pressure, e.pointerType === 'pen')
    }

    const up = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        touches.delete(e.pointerId)
        if (twoFinger) {
          if (touches.size === 0) {
            if (!twoFinger.moved && performance.now() - twoFinger.start < 400) useStore.getState().undo()
            twoFinger = null
            keepTargetVisible()
          }
          if (e.pointerId === activeId) activeId = -1
          return
        }
      }
      if (e.pointerId !== activeId) return
      activeId = -1
      const s = useStore.getState()
      if (erase) {
        s.removeIds([...erase.hits])
        useLive.getState().set({ erasing: [] })
        erase = null
        return
      }
      if (!session) return
      const el = session.finish()
      const snapped = !!session.snapped
      session = null
      useLive.getState().set({ stroke: null, preview: null })
      if (!el) return
      s.add([el], { animate: snapped && s.settings.animate ? 260 : undefined })
      // Avance automático: si escribiste en el margen derecho, la zona se corre.
      const pd = s.pad!
      const k = svg.getBoundingClientRect().width / pd.w
      const bb = elementBox(el)
      const rightPx = (bb.maxX - pd.x) * k
      const width = svg.getBoundingClientRect().width
      if (rightPx > width * ADVANCE_AT) moveTarget({ ...pd, x: pd.x + (rightPx - width * ADVANCE_TO) / k })
    }

    svg.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      session?.cancel()
      svg.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [open])

  if (!open || !pad) return null
  const accent = theme.ui === 'dark' ? '#8AB4FF' : '#3B6FE0'
  const handle: Vec = [pad.x * camera.z + camera.x, pad.y * camera.z + camera.y]
  const erasingSet = new Set(erasing)

  return (
    <>
      <MoveHandle at={handle} />
      <div className="pad" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
        <svg ref={svgRef} className="pad-svg" style={{ background: theme.bg }}>
          {/* margen de avance */}
          <rect x={rect.width * ADVANCE_AT} y={0} width={rect.width * (1 - ADVANCE_AT)} height={rect.height} fill={accent} opacity={0.06} />
          <line x1={rect.width * ADVANCE_AT} x2={rect.width * ADVANCE_AT} y1={0} y2={rect.height} stroke={accent} strokeOpacity={0.25} strokeDasharray="4 6" />
          {/* renglón: línea base + altura de la x */}
          <line x1={0} x2={rect.width} y1={rect.height * 0.68} y2={rect.height * 0.68} stroke={accent} strokeOpacity={0.45} strokeWidth={1.5} />
          <line x1={0} x2={rect.width} y1={rect.height * 0.44} y2={rect.height * 0.44} stroke={accent} strokeOpacity={0.2} strokeDasharray="6 8" />
          <g transform={`scale(${zp}) translate(${-pad.x} ${-pad.y})`}>
            {visible.map((el) => (
              <ElementView key={el.id} el={el} theme={theme} anim={anim[el.id]} faded={erasingSet.has(el.id)} />
            ))}
            {live &&
              (live.type === 'stroke' ? (
                <path d={outlineToPath(strokeOutline(live, false))} fill={theme.palette[live.color]} opacity={live.highlighter ? highlighterOpacity(theme) : undefined} />
              ) : (
                <ElementView el={live} theme={theme} />
              ))}
          </g>
        </svg>
        <div className="pad-tools" onPointerDown={(e) => e.stopPropagation()}>
          <button className="icon-btn" title="Mover zona a la izquierda" onClick={() => nudge(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button className="icon-btn" title="Mover zona a la derecha" onClick={() => nudge(1)}>
            <ChevronRight size={18} />
          </button>
          <button className="pill-btn" title="Nueva línea (Shift+Enter)" onClick={padNewLine}>
            <CornerDownLeft size={16} /> Nueva línea
          </button>
          <span className="sep" />
          <button className="icon-btn" title="Letra más chica (más aumento)" onClick={() => setMagnification(1.2)}>
            <Plus size={18} />
          </button>
          <button className="icon-btn" title="Letra más grande (menos aumento)" onClick={() => setMagnification(1 / 1.2)}>
            <Minus size={18} />
          </button>
          <span className="sep" />
          <button className="icon-btn" title="Cerrar lupa (Z)" onClick={closePad}>
            <X size={18} />
          </button>
        </div>
      </div>
    </>
  )
}

/** Manija para arrastrar la zona de la lupa por la pizarra. */
function MoveHandle({ at }: { at: Vec }) {
  const drag = useRef<{ id: number; start: Vec; pad: PadTarget } | null>(null)
  return (
    <button
      className="pad-handle"
      style={{ left: at[0] - 34, top: at[1] }}
      title="Arrastra para mover la zona de escritura"
      onPointerDown={(e) => {
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { id: e.pointerId, start: [e.clientX, e.clientY], pad: useStore.getState().pad! }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        const z = useStore.getState().camera.z
        const x = d.pad.x + (e.clientX - d.start[0]) / z
        const y = d.pad.y + (e.clientY - d.start[1]) / z
        useStore.getState().setPad({ ...d.pad, x, y, lineStartX: x })
      }}
      onPointerUp={() => (drag.current = null)}
    >
      <Move size={16} />
    </button>
  )
}
