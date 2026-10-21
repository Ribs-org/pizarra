/**
 * Reconocedor de formas para trazos a mano alzada ("mantén el dedo quieto y se arregla").
 *
 * Idea: probar varios candidatos geométricos (elipse, rectángulo, rombo, triángulo, línea,
 * flecha, polilínea), medir qué tan lejos queda el trazo de cada uno y quedarse con el mejor
 * si el error es lo bastante chico. Después se "endereza" (ángulos rectos, círculos perfectos…).
 */
import {
  boxOf,
  convexHull,
  dist,
  distToPolyline,
  pathLength,
  polygonArea,
  resample,
  rotate,
} from './geometry'
import type { RecognizedShape, Vec } from './types'

const DEG = Math.PI / 180

type BoxShape = Extract<RecognizedShape, { cx: number }>

export interface RecognizeOptions {
  /** Tamaño mínimo (diagonal de la caja) en unidades del mundo para intentar reconocer. */
  minSize: number
}

export function recognize(raw: (Vec | number[])[], opts: RecognizeOptions): RecognizedShape | null {
  const pts = dedupe(raw.map((p) => [p[0], p[1]] as Vec))
  if (pts.length < 4) return null
  const bb = boxOf(pts)
  const diag = Math.hypot(bb.maxX - bb.minX, bb.maxY - bb.minY)
  if (diag < opts.minSize) return null

  const r = resample(pts, 96)
  const L = pathLength(r)
  const first = r[0]
  const last = r[r.length - 1]

  // 1) Flecha de un solo trazo (línea + punta sin levantar el dedo)
  const arrow = detectArrow(r, L)
  if (arrow) return arrow

  // 2) Línea recta
  if (dist(first, last) / L > 0.85 && deviation(r) < 0.06) return { kind: 'line', points: fitLine(r) }

  // 3) Formas cerradas
  const closedAt = closingIndex(r, diag)
  if (closedAt !== -1) return recognizeClosed(r.slice(0, closedAt + 1), diag)

  // 4) Polilínea (L, zigzag, conectores en codo)
  return detectPolyline(pts, diag)
}

/**
 * Desviación máxima respecto de la cuerda, relativa a su largo. Es robusta al temblor fino
 * (a diferencia de largo-de-cuerda / largo-de-trazo, que se infla con cada zigzag).
 */
function deviation(seg: Vec[]) {
  const a = seg[0]
  const b = seg[seg.length - 1]
  const len = dist(a, b)
  if (len === 0) return Infinity
  let max = 0
  for (const p of seg) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len
    if (d > max) max = d
  }
  return max / len
}

function dedupe(pts: Vec[]) {
  const out: Vec[] = []
  for (const p of pts) {
    if (out.length === 0 || dist(out[out.length - 1], p) > 0.01) out.push(p)
  }
  return out
}

/** Ajusta una recta por PCA y proyecta los extremos sobre ella; luego endereza el ángulo. */
function fitLine(r: Vec[]): Vec[] {
  const n = r.length
  const cx = r.reduce((s, p) => s + p[0], 0) / n
  const cy = r.reduce((s, p) => s + p[1], 0) / n
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const [x, y] of r) {
    sxx += (x - cx) ** 2
    syy += (y - cy) ** 2
    sxy += (x - cx) * (y - cy)
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  const d: Vec = [Math.cos(theta), Math.sin(theta)]
  const proj = (p: Vec): Vec => {
    const t = (p[0] - cx) * d[0] + (p[1] - cy) * d[1]
    return [cx + t * d[0], cy + t * d[1]]
  }
  const a = proj(r[0])
  const b = proj(r[n - 1])
  return [a, snapAngle(a, b, 6)]
}

/** Si el segmento a→b está a menos de `tol` grados de un múltiplo de 45°, lo deja exacto. */
export function snapAngle(a: Vec, b: Vec, tol: number): Vec {
  const len = dist(a, b)
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  const step = 45 * DEG
  const snapped = Math.round(ang / step) * step
  if (Math.abs(snapped - ang) > tol * DEG) return b
  return [a[0] + Math.cos(snapped) * len, a[1] + Math.sin(snapped) * len]
}

function detectArrow(r: Vec[], L: number): RecognizedShape | null {
  const start = r[0]
  const dists = r.map((p) => dist(start, p))
  const maxD = Math.max(...dists)
  // La punta se visita varias veces (ida y vuelta por cada ala): quedarse con la primera.
  let k = dists.findIndex((d) => d >= maxD * 0.97)
  while (k < r.length - 1 && dists[k + 1] > dists[k]) k++
  if (k >= r.length - 3) return null
  const far = dists[k]
  const shaft = r.slice(0, k + 1)
  const shaftLen = pathLength(shaft)
  const headLen = L - shaftLen
  if (deviation(shaft) > 0.07) return null
  if (headLen < 0.06 * L || headLen > 0.6 * L || headLen > shaftLen) return null

  const tip = r[k]
  const dir: Vec = [(tip[0] - start[0]) / far, (tip[1] - start[1]) / far]
  const head = r.slice(k + 1)
  let maxOff = 0
  let goesBack = false
  for (const h of head) {
    const dx = h[0] - tip[0]
    const dy = h[1] - tip[1]
    if (Math.hypot(dx, dy) > 0.55 * far) return null
    const along = dx * dir[0] + dy * dir[1]
    const off = Math.abs(dx * -dir[1] + dy * dir[0])
    if (along < -0.04 * far) goesBack = true
    maxOff = Math.max(maxOff, off)
  }
  if (!goesBack || maxOff < 0.04 * far) return null
  const [a, b] = fitLine(shaft)
  return { kind: 'line', points: [a, b], arrowEnd: true }
}

/** Índice donde el trazo "se cierra" (vuelve cerca del inicio), o -1. Recorta el sobrante. */
function closingIndex(r: Vec[], diag: number) {
  const from = Math.floor(r.length * 0.55)
  let best = Infinity
  let idx = -1
  for (let j = from; j < r.length; j++) {
    const d = dist(r[j], r[0])
    if (d < best) {
      best = d
      idx = j
    }
  }
  return best < 0.22 * diag ? idx : -1
}

interface Candidate {
  shape: RecognizedShape
  err: number
}

function recognizeClosed(loop: Vec[], diag: number): RecognizedShape | null {
  const pts = resample(loop, 72)
  const hull = convexHull(pts)
  if (hull.length < 3 || Math.abs(polygonArea(hull)) < (diag * diag) / 200) return null

  const candidates: Candidate[] = []
  const ell = fitEllipse(hull)
  if (ell) {
    candidates.push({ shape: ell, err: meanDist(pts, outlineOf(ell), true) })
    const dia = fitDiamond(hull, ell)
    candidates.push({ shape: dia, err: meanDist(pts, outlineOf(dia), true) * 1.05 })
  }
  const rect = minAreaRect(hull)
  candidates.push({ shape: rect, err: meanDist(pts, outlineOf(rect), true) })
  const tri = maxTriangle(hull)
  if (tri) candidates.push({ shape: tri, err: meanDist(pts, tri.points, true) })

  candidates.sort((a, b) => a.err - b.err)
  const best = candidates[0]
  if (best.err / diag > 0.07) return null
  return straighten(best.shape)
}

function meanDist(pts: Vec[], outline: Vec[], closed: boolean) {
  let s = 0
  for (const p of pts) s += distToPolyline(p, outline, closed)
  return s / pts.length
}

export function outlineOf(s: RecognizedShape): Vec[] {
  if (s.kind === 'line' || s.kind === 'poly') return s.points
  const { cx, cy, w, h, angle } = s
  let pts: Vec[]
  if (s.kind === 'rect') {
    pts = [
      [cx - w / 2, cy - h / 2],
      [cx + w / 2, cy - h / 2],
      [cx + w / 2, cy + h / 2],
      [cx - w / 2, cy + h / 2],
    ]
  } else if (s.kind === 'diamond') {
    pts = [
      [cx, cy - h / 2],
      [cx + w / 2, cy],
      [cx, cy + h / 2],
      [cx - w / 2, cy],
    ]
  } else {
    pts = []
    for (let i = 0; i < 64; i++) {
      const t = (i / 64) * Math.PI * 2
      pts.push([cx + (Math.cos(t) * w) / 2, cy + (Math.sin(t) * h) / 2])
    }
  }
  return angle ? pts.map((p) => rotate(p, [cx, cy], angle)) : pts
}

/** Elipse a partir de los momentos de área del polígono (exacto para una elipse rellena). */
function fitEllipse(poly: Vec[]): BoxShape | null {
  let A = 0
  let cx = 0
  let cy = 0
  let ixx = 0
  let iyy = 0
  let ixy = 0
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % poly.length]
    const c = x0 * y1 - x1 * y0
    A += c
    cx += (x0 + x1) * c
    cy += (y0 + y1) * c
    iyy += (x0 * x0 + x0 * x1 + x1 * x1) * c
    ixx += (y0 * y0 + y0 * y1 + y1 * y1) * c
    ixy += (x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * c
  }
  A /= 2
  if (Math.abs(A) < 1e-6) return null
  cx /= 6 * A
  cy /= 6 * A
  const sxx = iyy / 12 / A - cx * cx
  const syy = ixx / 12 / A - cy * cy
  const sxy = ixy / 24 / A - cx * cy
  const tr = sxx + syy
  const det = sxx * syy - sxy * sxy
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det))
  const l1 = tr / 2 + disc
  const l2 = Math.max(1e-9, tr / 2 - disc)
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  return { kind: 'ellipse', cx, cy, w: 4 * Math.sqrt(l1), h: 4 * Math.sqrt(l2), angle }
}

/** Rombo alineado con los ejes principales, con las diagonales tocando los extremos del casco. */
function fitDiamond(hull: Vec[], ell: BoxShape): BoxShape {
  const c: Vec = [ell.cx, ell.cy]
  let maxU = 0
  let maxV = 0
  for (const p of hull) {
    const q = rotate(p, c, -ell.angle)
    maxU = Math.max(maxU, Math.abs(q[0] - c[0]))
    maxV = Math.max(maxV, Math.abs(q[1] - c[1]))
  }
  return { kind: 'diamond', cx: ell.cx, cy: ell.cy, w: maxU * 2, h: maxV * 2, angle: ell.angle }
}

/** Rectángulo de área mínima (calibres rotatorios sobre el casco convexo). */
function minAreaRect(hull: Vec[]): BoxShape {
  let best = { area: Infinity, angle: 0, minU: 0, maxU: 0, minV: 0, maxV: 0 }
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]
    const b = hull[(i + 1) % hull.length]
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
    const cos = Math.cos(-ang)
    const sin = Math.sin(-ang)
    let minU = Infinity
    let maxU = -Infinity
    let minV = Infinity
    let maxV = -Infinity
    for (const p of hull) {
      const u = p[0] * cos - p[1] * sin
      const v = p[0] * sin + p[1] * cos
      minU = Math.min(minU, u)
      maxU = Math.max(maxU, u)
      minV = Math.min(minV, v)
      maxV = Math.max(maxV, v)
    }
    const area = (maxU - minU) * (maxV - minV)
    if (area < best.area) best = { area, angle: ang, minU, maxU, minV, maxV }
  }
  const cu = (best.minU + best.maxU) / 2
  const cv = (best.minV + best.maxV) / 2
  const cos = Math.cos(best.angle)
  const sin = Math.sin(best.angle)
  return {
    kind: 'rect',
    cx: cu * cos - cv * sin,
    cy: cu * sin + cv * cos,
    w: best.maxU - best.minU,
    h: best.maxV - best.minV,
    angle: best.angle,
  }
}

function maxTriangle(hull: Vec[]): Extract<RecognizedShape, { kind: 'poly' }> | null {
  const h = hull.length > 36 ? hull.filter((_, i) => i % Math.ceil(hull.length / 36) === 0) : hull
  if (h.length < 3) return null
  let best = 0
  let tri: Vec[] = []
  for (let i = 0; i < h.length; i++)
    for (let j = i + 1; j < h.length; j++)
      for (let k = j + 1; k < h.length; k++) {
        const a = Math.abs(polygonArea([h[i], h[j], h[k]]))
        if (a > best) {
          best = a
          tri = [h[i], h[j], h[k]]
        }
      }
  return tri.length === 3 ? { kind: 'poly', points: tri } : null
}

/** Normaliza ángulo a (-π/2, π/2]. */
function normAngle(a: number) {
  while (a <= -Math.PI / 2) a += Math.PI
  while (a > Math.PI / 2) a -= Math.PI
  return a
}

/** Endereza: ejes alineados, círculos perfectos, cuadrados a 45° → rombo, bases horizontales… */
function straighten(s: RecognizedShape): RecognizedShape {
  if (s.kind === 'rect' || s.kind === 'ellipse' || s.kind === 'diamond') {
    let { w, h } = s
    let angle = normAngle(s.angle)
    // Llevar el ángulo a (-45°, 45°] intercambiando ancho/alto.
    if (angle > Math.PI / 4) {
      angle -= Math.PI / 2
      ;[w, h] = [h, w]
    } else if (angle <= -Math.PI / 4) {
      angle += Math.PI / 2
      ;[w, h] = [h, w]
    }
    if (s.kind === 'ellipse') {
      const ratio = Math.min(w, h) / Math.max(w, h)
      if (ratio > 0.82) {
        const d = (w + h) / 2
        return { ...s, w: d, h: d, angle: 0 }
      }
      return { ...s, w, h, angle: Math.abs(angle) < 12 * DEG ? 0 : angle }
    }
    if (s.kind === 'rect') {
      const ratio = Math.min(w, h) / Math.max(w, h)
      if (Math.abs(Math.abs(angle) - Math.PI / 4) < 12 * DEG && ratio > 0.75) {
        // Un cuadrado girado 45° es, para efectos prácticos, un rombo.
        const d = ((w + h) / 2) * Math.SQRT2
        return { kind: 'diamond', cx: s.cx, cy: s.cy, w: d, h: d, angle: 0 }
      }
      if (ratio > 0.9) {
        const d = (w + h) / 2
        w = d
        h = d
      }
      return { ...s, w, h, angle: Math.abs(angle) < 10 * DEG ? 0 : angle }
    }
    // Rombo
    const ratio = Math.min(w, h) / Math.max(w, h)
    if (Math.abs(Math.abs(angle) - Math.PI / 4) < 12 * DEG && ratio > 0.75) {
      // Un rombo "cuadrado" girado 45° es un cuadrado derecho.
      const side = ((w + h) / 2) / Math.SQRT2
      return { kind: 'rect', cx: s.cx, cy: s.cy, w: side, h: side, angle: 0 }
    }
    return { ...s, w, h, angle: Math.abs(angle) < 12 * DEG ? 0 : angle }
  }
  if (s.kind === 'poly' && s.points.length === 3) return straightenTriangle(s.points)
  return s
}

function straightenTriangle(tri: Vec[]): RecognizedShape {
  const c: Vec = [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3]
  let pts = tri
  // ¿Algún lado casi horizontal? → rotar para que quede exacto.
  for (let i = 0; i < 3; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % 3]
    const ang = normAngle(Math.atan2(b[1] - a[1], b[0] - a[0]))
    if (Math.abs(ang) < 10 * DEG) {
      pts = pts.map((p) => rotate(p, c, -ang))
      // Si es casi isósceles, centrar el vértice opuesto.
      const apex = pts[(i + 2) % 3]
      const p0 = pts[i]
      const p1 = pts[(i + 1) % 3]
      const midX = (p0[0] + p1[0]) / 2
      const base = Math.abs(p1[0] - p0[0])
      if (Math.abs(apex[0] - midX) < 0.12 * base) {
        pts = pts.map((p, j) => (j === (i + 2) % 3 ? [midX, p[1]] : p))
      }
      break
    }
  }
  return { kind: 'poly', points: pts }
}

/** Esquinas con ShortStraw (Wolin et al.) y verificación de que cada tramo sea recto. */
function detectPolyline(pts: Vec[], diag: number): RecognizedShape | null {
  const spacing = diag / 40
  const n = Math.max(8, Math.round(pathLength(pts) / spacing))
  const r = smooth(resample(pts, n), 2)
  const W = 3
  if (r.length < 2 * W + 2) return null
  const straws: number[] = new Array(r.length).fill(Infinity)
  for (let i = W; i < r.length - W; i++) straws[i] = dist(r[i - W], r[i + W])
  const finite = straws.filter(Number.isFinite).sort((a, b) => a - b)
  const t = finite[Math.floor(finite.length / 2)] * 0.95
  const corners = [0]
  for (let i = W; i < r.length - W; i++) {
    if (straws[i] < t) {
      let localMin = i
      while (i < r.length - W && straws[i] < t) {
        if (straws[i] < straws[localMin]) localMin = i
        i++
      }
      corners.push(localMin)
    }
  }
  corners.push(r.length - 1)

  // Fusionar esquinas espurias: si el tramo sin esa esquina sigue siendo recto, sobra.
  for (let changed = true; changed; ) {
    changed = false
    for (let i = 1; i < corners.length - 1; i++) {
      if (corners[i] - corners[i - 1] < W || deviation(r.slice(corners[i - 1], corners[i + 1] + 1)) < 0.05) {
        corners.splice(i, 1)
        changed = true
        break
      }
    }
  }

  const segs: Vec[][] = []
  for (let i = 1; i < corners.length; i++) {
    const seg = r.slice(corners[i - 1], corners[i] + 1)
    const isEnd = i === 1 || i === corners.length - 1
    // Ganchitos al empezar/terminar el trazo: se ignoran.
    if (seg.length < 2 || (isEnd && dist(seg[0], seg[seg.length - 1]) < diag * 0.08)) continue
    segs.push(seg)
  }
  if (segs.length < 2 || segs.length > 6) return null
  if (segs.some((seg) => deviation(seg) > 0.08)) return null

  // Vértices = intersección de las rectas ajustadas a tramos consecutivos.
  const lines = segs.map(pcaLine)
  const out: Vec[] = [projectOn(lines[0], segs[0][0])]
  for (let i = 0; i < lines.length - 1; i++) {
    out.push(intersect(lines[i], lines[i + 1]) ?? segs[i][segs[i].length - 1])
  }
  const lastSeg = segs[segs.length - 1]
  out.push(projectOn(lines[lines.length - 1], lastSeg[lastSeg.length - 1]))

  // Enderezar ángulos encadenando desde el inicio (conserva el largo de cada tramo).
  const fixed: Vec[] = [out[0]]
  for (let i = 1; i < out.length; i++) {
    const prev = fixed[i - 1]
    const target: Vec = [prev[0] + out[i][0] - out[i - 1][0], prev[1] + out[i][1] - out[i - 1][1]]
    fixed.push(snapAngle(prev, target, 8))
  }
  return { kind: 'line', points: fixed }
}

function smooth(r: Vec[], k: number): Vec[] {
  return r.map((_, i) => {
    const lo = Math.max(0, i - k)
    const hi = Math.min(r.length - 1, i + k)
    let x = 0
    let y = 0
    for (let j = lo; j <= hi; j++) {
      x += r[j][0]
      y += r[j][1]
    }
    const n = hi - lo + 1
    return [x / n, y / n] as Vec
  })
}

interface Line2 {
  c: Vec
  d: Vec
}

function pcaLine(seg: Vec[]): Line2 {
  const n = seg.length
  const cx = seg.reduce((s, p) => s + p[0], 0) / n
  const cy = seg.reduce((s, p) => s + p[1], 0) / n
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const [x, y] of seg) {
    sxx += (x - cx) ** 2
    syy += (y - cy) ** 2
    sxy += (x - cx) * (y - cy)
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  return { c: [cx, cy], d: [Math.cos(theta), Math.sin(theta)] }
}

function projectOn(l: Line2, p: Vec): Vec {
  const t = (p[0] - l.c[0]) * l.d[0] + (p[1] - l.c[1]) * l.d[1]
  return [l.c[0] + t * l.d[0], l.c[1] + t * l.d[1]]
}

function intersect(a: Line2, b: Line2): Vec | null {
  const den = a.d[0] * b.d[1] - a.d[1] * b.d[0]
  if (Math.abs(den) < 0.2) return null
  const t = ((b.c[0] - a.c[0]) * b.d[1] - (b.c[1] - a.c[1]) * b.d[0]) / den
  return [a.c[0] + t * a.d[0], a.c[1] + t * a.d[1]]
}
