import type { Box, El, Vec } from './types'

export const dist = (a: Vec | number[], b: Vec | number[]) => Math.hypot(a[0] - b[0], a[1] - b[1])

export function pathLength(pts: (Vec | number[])[]) {
  let len = 0
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i])
  return len
}

/** Remuestrea una polilínea a `n` puntos equidistantes. */
export function resample(pts: Vec[], n: number): Vec[] {
  if (pts.length < 2) return pts.slice()
  const step = pathLength(pts) / (n - 1)
  if (step === 0) return [pts[0]]
  const out: Vec[] = [pts[0]]
  let acc = 0
  let prev = pts[0]
  for (let i = 1; i < pts.length; i++) {
    let cur = pts[i]
    let d = dist(prev, cur)
    while (acc + d >= step && out.length < n) {
      const t = (step - acc) / d
      const q: Vec = [prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]
      out.push(q)
      prev = q
      d = dist(prev, cur)
      acc = 0
    }
    acc += d
    prev = cur
  }
  while (out.length < n) out.push(pts[pts.length - 1])
  return out
}

export function distToSegment(p: Vec, a: Vec, b: Vec) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return dist(p, a)
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

export function distToPolyline(p: Vec, pts: (Vec | number[])[], closed = false) {
  if (pts.length === 0) return Infinity
  if (pts.length === 1) return dist(p, pts[0])
  let best = Infinity
  const n = closed ? pts.length : pts.length - 1
  for (let i = 0; i < n; i++) {
    const a = pts[i] as Vec
    const b = pts[(i + 1) % pts.length] as Vec
    best = Math.min(best, distToSegment(p, a, b))
  }
  return best
}

export function pointInPolygon(p: Vec, poly: Vec[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Área con signo (shoelace). */
export function polygonArea(poly: Vec[]) {
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]
  }
  return a / 2
}

export function convexHull(points: Vec[]): Vec[] {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (pts.length < 3) return pts
  const cross = (o: Vec, a: Vec, b: Vec) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: Vec[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Vec[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  upper.pop()
  lower.pop()
  return lower.concat(upper)
}

export const rotate = (p: Vec, c: Vec, a: number): Vec => {
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const dx = p[0] - c[0]
  const dy = p[1] - c[1]
  return [c[0] + dx * cos - dy * sin, c[1] + dx * sin + dy * cos]
}

export function boxOf(pts: (Vec | number[])[], pad = 0): Box {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p[0] < minX) minX = p[0]
    if (p[1] < minY) minY = p[1]
    if (p[0] > maxX) maxX = p[0]
    if (p[1] > maxY) maxY = p[1]
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad }
}

export function unionBox(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null
  return boxes.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }))
}

export const boxContains = (outer: Box, inner: Box) =>
  inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY

export const boxesIntersect = (a: Box, b: Box) =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY

/** Contorno de rectángulos, rombos y elipses como polígono (en coordenadas del mundo). */
export function boxOutline(el: { type: string; cx: number; cy: number; w: number; h: number; angle: number }): Vec[] {
  const { cx, cy, w, h, angle } = el
  let pts: Vec[]
  if (el.type === 'rect') {
    pts = [
      [cx - w / 2, cy - h / 2],
      [cx + w / 2, cy - h / 2],
      [cx + w / 2, cy + h / 2],
      [cx - w / 2, cy + h / 2],
    ]
  } else if (el.type === 'diamond') {
    pts = [
      [cx, cy - h / 2],
      [cx + w / 2, cy],
      [cx, cy + h / 2],
      [cx - w / 2, cy],
    ]
  } else {
    pts = []
    for (let i = 0; i < 48; i++) {
      const t = (i / 48) * Math.PI * 2
      pts.push([cx + (Math.cos(t) * w) / 2, cy + (Math.sin(t) * h) / 2])
    }
  }
  return angle ? pts.map((p) => rotate(p, [cx, cy], angle)) : pts
}

export function elementBox(el: El): Box {
  switch (el.type) {
    case 'stroke':
      return boxOf(el.points, el.width / 2)
    case 'rect':
    case 'ellipse':
    case 'diamond':
      return boxOf(boxOutline(el), el.width)
    case 'line': {
      const b = boxOf(el.points, el.width)
      if (el.arrowEnd || el.arrowStart) {
        const pad = Math.min(24, pathLength(el.points) * 0.3)
        return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad }
      }
      return b
    }
    case 'poly':
      return boxOf(el.points, el.width)
    case 'text':
    case 'stamp':
      return { minX: el.x, minY: el.y, maxX: el.x + el.w, maxY: el.y + el.h }
  }
}

/** Distancia (aprox.) desde un punto a la "tinta" del elemento; 0 si está dentro de algo relleno/macizo. */
export function hitDistance(el: El, p: Vec): number {
  switch (el.type) {
    case 'stroke':
      return Math.max(0, distToPolyline(p, el.points) - el.width / 2)
    case 'rect':
    case 'ellipse':
    case 'diamond': {
      const outline = boxOutline(el)
      if (el.fill !== 'none' && pointInPolygon(p, outline)) return 0
      return distToPolyline(p, outline, true)
    }
    case 'line':
      return distToPolyline(p, el.points)
    case 'poly':
      if (el.fill !== 'none' && pointInPolygon(p, el.points)) return 0
      return distToPolyline(p, el.points, true)
    case 'text':
    case 'stamp': {
      const b = elementBox(el)
      const dx = Math.max(b.minX - p[0], 0, p[0] - b.maxX)
      const dy = Math.max(b.minY - p[1], 0, p[1] - b.maxY)
      return Math.hypot(dx, dy)
    }
  }
}

export function translateEl<T extends El>(el: T, dx: number, dy: number): T {
  switch (el.type) {
    case 'stroke':
      return { ...el, points: el.points.map((p) => [p[0] + dx, p[1] + dy, p[2]]) }
    case 'rect':
    case 'ellipse':
    case 'diamond':
      return { ...el, cx: el.cx + dx, cy: el.cy + dy }
    case 'line':
    case 'poly':
      return { ...el, points: el.points.map((p) => [p[0] + dx, p[1] + dy] as Vec) }
    case 'text':
    case 'stamp':
      return { ...el, x: el.x + dx, y: el.y + dy }
  }
}

/** Escala uniforme respecto a un origen. La tinta a mano escala su grosor; las formas lo mantienen. */
export function scaleEl<T extends El>(el: T, s: number, o: Vec): T {
  const sp = (p: Vec | number[]): Vec => [o[0] + (p[0] - o[0]) * s, o[1] + (p[1] - o[1]) * s]
  switch (el.type) {
    case 'stroke':
      return {
        ...el,
        points: el.points.map((p) => [...sp(p), p[2]]),
        width: Math.max(0.5, el.width * s),
      }
    case 'rect':
    case 'ellipse':
    case 'diamond': {
      const [cx, cy] = sp([el.cx, el.cy])
      return { ...el, cx, cy, w: el.w * s, h: el.h * s }
    }
    case 'line':
    case 'poly':
      return { ...el, points: el.points.map(sp) }
    case 'text': {
      const [x, y] = sp([el.x, el.y])
      return { ...el, x, y, fontSize: el.fontSize * s, w: el.w * s, h: el.h * s }
    }
    case 'stamp': {
      const [x, y] = sp([el.x, el.y])
      return { ...el, x, y, w: el.w * s, h: el.h * s }
    }
  }
}
