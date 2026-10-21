/**
 * Una sesión de tinta = un trazo con el dedo/lápiz, desde que toca hasta que se levanta.
 *
 * Hace tres cosas para que la letra con el dedo se vea pareja:
 *  1. Estabilizador tipo "lazy brush": la punta sigue al dedo como con un hilo, así el temblor
 *     chico se ignora (radio en píxeles de pantalla, configurable con "Suavizado").
 *  2. perfect-freehand dibuja la tinta con grosor variable y bordes suaves.
 *  3. Si mantienes el dedo quieto al final, el reconocedor convierte el trazo en una forma limpia.
 */
import { dist } from './geometry'
import { useLive } from './live'
import { recognize, snapAngle } from './recognize'
import { newId, newSeed } from './store'
import type { ColorKey, El, FillStyle, RecognizedShape, Roughness, StrokeEl, Vec } from './types'

export interface InkOptions {
  highlighter: boolean
  color: ColorKey
  /** grosor de la tinta en unidades del mundo */
  width: number
  /** grosor para formas reconocidas */
  shapeWidth: number
  smoothing: number
  quickShape: boolean
  rough: Roughness
  fill: FillStyle
  /** unidades del mundo por píxel de pantalla en esta vista */
  worldPerPx: number
}

const HOLD_MS = 520
const HOLD_SLOP_PX = 7

export class InkSession {
  readonly points: number[][] = []
  private brush: Vec | null = null
  private lastScreen: Vec | null = null
  private holdAnchor: Vec | null = null
  private holdTimer = 0
  private realPressure = false
  snapped: El | null = null
  private readonly id = newId()
  private readonly toWorld: (p: Vec) => Vec
  private readonly opts: InkOptions

  constructor(toWorld: (p: Vec) => Vec, opts: InkOptions) {
    this.toWorld = toWorld
    this.opts = opts
  }

  private get radius() {
    return 1 + this.opts.smoothing * 9
  }

  add(screen: Vec, pressure: number, isPen: boolean) {
    this.lastScreen = screen
    if (this.snapped) return this.dragSnapped(screen)
    if (isPen && pressure > 0) this.realPressure = true
    const p = this.realPressure ? Math.max(0.05, pressure) : 0.5

    if (!this.brush) {
      this.brush = screen
      this.pushPoint(screen, p)
    } else {
      const d = dist(this.brush, screen)
      const r = this.radius
      if (d > r) {
        const t = (d - r) / d
        this.brush = [this.brush[0] + (screen[0] - this.brush[0]) * t, this.brush[1] + (screen[1] - this.brush[1]) * t]
        this.pushPoint(this.brush, p)
      }
    }
    this.watchHold(screen)
  }

  private pushPoint(screen: Vec, pressure: number) {
    const [x, y] = this.toWorld(screen)
    this.points.push([x, y, pressure])
    useLive.getState().set({ stroke: this.strokeEl() })
  }

  private strokeEl(): StrokeEl {
    return {
      id: this.id,
      type: 'stroke',
      color: this.opts.color,
      points: this.points.slice(),
      width: this.opts.width,
      highlighter: this.opts.highlighter || undefined,
      pressure: this.realPressure || undefined,
    }
  }

  private watchHold(screen: Vec) {
    if (!this.opts.quickShape) return
    if (this.holdAnchor && dist(this.holdAnchor, screen) <= HOLD_SLOP_PX) return
    this.holdAnchor = screen
    clearTimeout(this.holdTimer)
    this.holdTimer = window.setTimeout(() => this.trySnap(), HOLD_MS)
  }

  private trySnap() {
    const shape = recognize(this.points, { minSize: 28 * this.opts.worldPerPx })
    if (!shape) return
    const el = this.shapeElement(shape)
    if (!el) return
    this.snapped = el
    useLive.getState().set({ stroke: null, preview: el, snapped: Date.now() })
  }

  private shapeElement(s: RecognizedShape): El | null {
    const o = this.opts
    if (o.highlighter) {
      // El destacador solo se endereza (líneas), no se convierte en formas.
      if (s.kind !== 'line' || s.points.length !== 2 || s.arrowEnd) return null
      return { ...this.strokeEl(), points: straightPoints(s.points[0], s.points[1]) }
    }
    const base = { id: this.id, color: o.color, width: o.shapeWidth, rough: o.rough, seed: newSeed() }
    switch (s.kind) {
      case 'line':
        return { ...base, type: 'line', points: s.points, arrowEnd: s.arrowEnd || undefined }
      case 'poly':
        return { ...base, type: 'poly', points: s.points, fill: o.fill }
      default:
        return { ...base, type: s.kind, cx: s.cx, cy: s.cy, w: s.w, h: s.h, angle: s.angle, fill: o.fill }
    }
  }

  /** Después de convertir una línea, seguir moviendo el dedo ajusta su extremo (como QuickShape). */
  private dragSnapped(screen: Vec) {
    const el = this.snapped
    if (!el || !this.holdAnchor) return
    if (dist(screen, this.holdAnchor) < HOLD_SLOP_PX) return
    const end = this.toWorld(screen)
    if (el.type === 'line' && el.points.length === 2) {
      const next = { ...el, points: [el.points[0], snapAngle(el.points[0], end, 5)] }
      this.snapped = next
      useLive.getState().set({ preview: next })
    } else if (el.type === 'stroke' && el.highlighter) {
      const a: Vec = [el.points[0][0], el.points[0][1]]
      const next = { ...el, points: straightPoints(a, snapAngle(a, end, 5)) }
      this.snapped = next
      useLive.getState().set({ preview: next })
    }
  }

  /** Termina el trazo y devuelve el elemento a guardar (o null si no hay nada). */
  finish(): El | null {
    clearTimeout(this.holdTimer)
    if (this.snapped) return this.snapped
    // Completar la cola que el estabilizador dejó atrás.
    if (this.lastScreen && this.brush && dist(this.lastScreen, this.brush) > 0.5) {
      const [x, y] = this.toWorld(this.lastScreen)
      this.points.push([x, y, this.points[this.points.length - 1]?.[2] ?? 0.5])
    }
    if (this.points.length === 0) return null
    return this.strokeEl()
  }

  cancel() {
    clearTimeout(this.holdTimer)
  }
}

function straightPoints(a: Vec, b: Vec): number[][] {
  const n = Math.max(2, Math.ceil(dist(a, b) / 6))
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0.5]
  })
}
