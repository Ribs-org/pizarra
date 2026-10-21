/**
 * Convierte elementos en primitivas de dibujo (paths + textos). Las usan tanto la pizarra (SVG)
 * como la exportación a PNG (canvas), así lo que exportas es idéntico a lo que ves.
 */
import { getStroke } from 'perfect-freehand'
import rough from 'roughjs'
import type { Options } from 'roughjs/bin/core'
import { dist, rotate } from './geometry'
import { STAMP_MAP, type StampPrim } from './stamps'
import { baselineOffset, cssSize, lineHeight } from './text'
import { FONTS, type Theme, withAlpha } from './theme'
import type { El, FillStyle, Roughness, StrokeEl, Vec } from './types'

export interface PathPrim {
  d: string
  fill?: string
  stroke?: string
  sw?: number
  opacity?: number
  /** rotación (grados) alrededor de (cx, cy) */
  rot?: [number, number, number]
  /** trazo animable con stroke-dashoffset */
  draw?: boolean
  /** orden de aparición en la animación (0..steps-1) */
  seq?: number
  linecap?: 'round' | 'butt'
}

export interface TextPrim {
  x: number
  y: number
  text: string
  size: number
  family: string
  weight: number
  fill: string
}

export interface Drawn {
  paths: PathPrim[]
  texts: TextPrim[]
  steps: number
}

const gen = rough.generator()

// ——— Tinta a mano (perfect-freehand) ———

/** Sobre fondo oscuro el destacador necesita más opacidad para no verse "barroso". */
export const highlighterOpacity = (theme: Theme) => (theme.ui === 'dark' ? 0.55 : 0.38)

const sineOut = (t: number) => Math.sin((t * Math.PI) / 2)

export function strokeOutline(el: Pick<StrokeEl, 'points' | 'width' | 'highlighter' | 'pressure'>, last = true) {
  return getStroke(el.points, {
    size: el.width,
    thinning: el.highlighter ? 0 : 0.6,
    smoothing: 0.6,
    streamline: 0.35,
    easing: sineOut,
    simulatePressure: !el.pressure && !el.highlighter,
    start: { cap: !el.highlighter, taper: 0 },
    end: { cap: !el.highlighter, taper: 0 },
    last,
  })
}

const avg = (a: number, b: number) => (a + b) / 2

/** Outline de perfect-freehand → path SVG suave (curvas cuadráticas por los puntos medios). */
export function outlineToPath(points: number[][], closed = true) {
  const len = points.length
  if (len < 4) return ''
  let a = points[0]
  let b = points[1]
  const c = points[2]
  let d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0]).toFixed(2)},${avg(b[1], c[1]).toFixed(2)} T`
  for (let i = 2; i < len - 1; i++) {
    a = points[i]
    b = points[i + 1]
    d += `${avg(a[0], b[0]).toFixed(2)},${avg(a[1], b[1]).toFixed(2)} `
  }
  if (closed) d += 'Z'
  return d
}

// ——— Formas con rough.js ———

const ROUGHNESS = [0, 1, 1.9]

function roughOpts(rough: Roughness, color: string, width: number, fill: FillStyle, size: number, seed: number): Options {
  // Las formas chicas con mucho "temblor" se ven sucias: se atenúa según el tamaño.
  const k = Math.max(0.3, Math.min(1, size / 70))
  const o: Options = {
    seed,
    roughness: ROUGHNESS[rough] * k,
    bowing: rough === 0 ? 0 : 0.8,
    stroke: color,
    strokeWidth: width,
    disableMultiStroke: rough === 0,
    preserveVertices: true,
  }
  if (fill === 'soft') {
    o.fill = withAlpha(color, 0.16)
    o.fillStyle = 'solid'
  } else if (fill === 'hachure') {
    o.fill = withAlpha(color, 0.55)
    o.fillStyle = 'hachure'
    o.hachureGap = Math.max(5, width * 3.5)
    o.fillWeight = Math.max(1, width * 0.55)
    o.hachureAngle = -41
  }
  return o
}

function drawableToPrims(drawable: ReturnType<typeof gen.rectangle>, seq = 0): PathPrim[] {
  return gen.toPaths(drawable).map((p) => {
    const isFill = p.fill && p.fill !== 'none'
    return isFill
      ? { d: p.d, fill: p.fill, seq }
      : { d: p.d, stroke: p.stroke, sw: p.strokeWidth, draw: true, seq, linecap: 'round' as const }
  })
}

function arrowHead(from: Vec, tip: Vec, width: number): Vec[] {
  const len = dist(from, tip)
  const size = Math.min(Math.max(12, width * 4 + 10), len * 0.45)
  const ang = Math.atan2(tip[1] - from[1], tip[0] - from[0])
  const spread = (27 * Math.PI) / 180
  return [
    [tip[0] - Math.cos(ang - spread) * size, tip[1] - Math.sin(ang - spread) * size],
    tip,
    [tip[0] - Math.cos(ang + spread) * size, tip[1] - Math.sin(ang + spread) * size],
  ]
}

// ——— Sellos ———

function stampPrims(el: Extract<El, { type: 'stamp' }>, color: string): Drawn {
  const def = STAMP_MAP.get(el.stamp)
  if (!def) return { paths: [], texts: [], steps: 1 }
  const k = el.w / def.box[0]
  const X = (v: number) => el.x + v * k
  const Y = (v: number) => el.y + v * k
  const pts = (flat: number[]): [number, number][] => {
    const out: [number, number][] = []
    for (let i = 0; i < flat.length; i += 2) out.push([X(flat[i]), Y(flat[i + 1])])
    return out
  }
  const paths: PathPrim[] = []
  def.prims.forEach((prim: StampPrim, i) => {
    const seed = el.seed + i * 7919
    const fillOf = (f?: 1 | 2): FillStyle => (f ? 'soft' : 'none')
    const opts = (size: number, f?: 1 | 2) => {
      const o = roughOpts(el.rough, color, el.width, fillOf(f), size * k, seed)
      if (f === 2) {
        o.fill = color
        o.fillStyle = 'solid'
      }
      return o
    }
    let d
    if ('c' in prim) {
      const [cx, cy, dd] = prim.c
      d = gen.circle(X(cx), Y(cy), dd * k, opts(dd, prim.f))
    } else if ('e' in prim) {
      const [cx, cy, w, h] = prim.e
      d = gen.ellipse(X(cx), Y(cy), w * k, h * k, opts(Math.min(w, h), prim.f))
    } else if ('l' in prim) {
      const [x1, y1, x2, y2] = prim.l
      d = gen.line(X(x1), Y(y1), X(x2), Y(y2), opts(Math.hypot(x2 - x1, y2 - y1)))
    } else if ('p' in prim) {
      d = gen.polygon(pts(prim.p), opts(60, prim.f))
    } else if ('o' in prim) {
      d = gen.linearPath(pts(prim.o), opts(60))
    } else if ('k' in prim) {
      d = gen.curve(pts(prim.k), opts(60, prim.f))
    } else if ('r' in prim) {
      const [x, y, w, h] = prim.r
      d = gen.rectangle(X(x), Y(y), w * k, h * k, opts(Math.min(w, h), prim.f))
    } else {
      const [cx, cy, w, h, a0, a1] = prim.a
      d = gen.arc(X(cx), Y(cy), w * k, h * k, (a0 * Math.PI) / 180, (a1 * Math.PI) / 180, false, opts(Math.min(w, h)))
    }
    paths.push(...drawableToPrims(d, i))
  })
  return { paths, texts: [], steps: def.prims.length }
}

// ——— Punto de entrada ———

const cache = new WeakMap<El, Map<string, Drawn>>()

export function drawElement(el: El, theme: Theme): Drawn {
  let byTheme = cache.get(el)
  if (!byTheme) {
    byTheme = new Map()
    cache.set(el, byTheme)
  }
  let drawn = byTheme.get(theme.key)
  if (!drawn) {
    drawn = computeDrawn(el, theme)
    byTheme.set(theme.key, drawn)
  }
  return drawn
}

function computeDrawn(el: El, theme: Theme): Drawn {
  const color = theme.palette[el.color]
  switch (el.type) {
    case 'stroke': {
      const d = outlineToPath(strokeOutline(el))
      return { paths: [{ d, fill: color, opacity: el.highlighter ? highlighterOpacity(theme) : undefined }], texts: [], steps: 1 }
    }
    case 'rect':
    case 'diamond': {
      const { cx, cy, w, h, angle } = el
      const corners: Vec[] =
        el.type === 'rect'
          ? [
              [cx - w / 2, cy - h / 2],
              [cx + w / 2, cy - h / 2],
              [cx + w / 2, cy + h / 2],
              [cx - w / 2, cy + h / 2],
            ]
          : [
              [cx, cy - h / 2],
              [cx + w / 2, cy],
              [cx, cy + h / 2],
              [cx - w / 2, cy],
            ]
      const pts = angle ? corners.map((p) => rotate(p, [cx, cy], angle)) : corners
      const d = gen.polygon(pts, roughOpts(el.rough, color, el.width, el.fill, Math.min(w, h), el.seed))
      return { paths: drawableToPrims(d), texts: [], steps: 1 }
    }
    case 'ellipse': {
      const d = gen.ellipse(el.cx, el.cy, el.w, el.h, roughOpts(el.rough, color, el.width, el.fill, Math.min(el.w, el.h), el.seed))
      const rot: [number, number, number] | undefined = el.angle ? [(el.angle * 180) / Math.PI, el.cx, el.cy] : undefined
      return { paths: drawableToPrims(d).map((p) => ({ ...p, rot })), texts: [], steps: 1 }
    }
    case 'line': {
      const o = roughOpts(el.rough, color, el.width, 'none', 120, el.seed)
      const paths = drawableToPrims(el.points.length === 2 ? gen.line(...el.points[0], ...el.points[1], o) : gen.linearPath(el.points, o))
      const n = el.points.length
      if (el.arrowEnd && n >= 2) paths.push(...drawableToPrims(gen.linearPath(arrowHead(el.points[n - 2], el.points[n - 1], el.width), { ...o, seed: el.seed + 1 }), 1))
      if (el.arrowStart && n >= 2) paths.push(...drawableToPrims(gen.linearPath(arrowHead(el.points[1], el.points[0], el.width), { ...o, seed: el.seed + 2 }), 1))
      return { paths, texts: [], steps: 2 }
    }
    case 'poly': {
      const d = gen.polygon(el.points, roughOpts(el.rough, color, el.width, el.fill, 80, el.seed))
      return { paths: drawableToPrims(d), texts: [], steps: 1 }
    }
    case 'text': {
      const f = FONTS[el.font]
      const lh = lineHeight(el.font, el.fontSize)
      const base = baselineOffset(el.font, el.fontSize)
      const texts = el.text.split('\n').map((line, i) => ({
        x: el.x,
        y: el.y + i * lh + base,
        text: line,
        size: cssSize(el.font, el.fontSize),
        family: f.family,
        weight: f.weight,
        fill: color,
      }))
      return { paths: [], texts, steps: texts.length }
    }
    case 'stamp':
      return stampPrims(el, color)
  }
}
