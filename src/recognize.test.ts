import { describe, expect, it } from 'vitest'
import { recognize } from './recognize'
import type { Vec } from './types'

/** RNG determinista para que los tests sean reproducibles. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** Simula un trazo con el dedo: puntos densos con temblor. */
function wobble(pts: Vec[], amount: number, seed = 1): Vec[] {
  const rand = rng(seed)
  let ox = 0
  let oy = 0
  return pts.map(([x, y]) => {
    // Ruido correlacionado (más parecido a un pulso real que ruido blanco).
    ox = ox * 0.8 + (rand() - 0.5) * amount
    oy = oy * 0.8 + (rand() - 0.5) * amount
    return [x + ox, y + oy] as Vec
  })
}

function polyPath(corners: Vec[], perSide = 30, closed = true): Vec[] {
  const out: Vec[] = []
  const n = closed ? corners.length : corners.length - 1
  for (let i = 0; i < n; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % corners.length]
    for (let k = 0; k < perSide; k++) {
      const t = k / perSide
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  out.push(closed ? corners[0] : corners[corners.length - 1])
  return out
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number, turns = 1.05, start = 0.3): Vec[] {
  const out: Vec[] = []
  const n = 120
  for (let i = 0; i <= n; i++) {
    const t = start + (i / n) * Math.PI * 2 * turns
    out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry])
  }
  return out
}

const opts = { minSize: 20 }

describe('recognize', () => {
  it('círculo tembloroso → círculo perfecto', () => {
    const s = recognize(wobble(ellipsePath(200, 200, 80, 76), 5), opts)
    expect(s?.kind).toBe('ellipse')
    if (s?.kind === 'ellipse') {
      expect(s.w).toBeCloseTo(s.h, 5)
      expect(s.w).toBeGreaterThan(140)
      expect(s.w).toBeLessThan(180)
      expect(Math.abs(s.cx - 200)).toBeLessThan(8)
    }
  })

  it('elipse ancha → elipse horizontal', () => {
    const s = recognize(wobble(ellipsePath(300, 200, 150, 70), 5, 3), opts)
    expect(s?.kind).toBe('ellipse')
    if (s?.kind === 'ellipse') {
      expect(s.angle).toBe(0)
      expect(s.w).toBeGreaterThan(s.h * 1.6)
    }
  })

  it('rectángulo a mano → rectángulo derecho', () => {
    const pts = wobble(polyPath([[100, 100], [320, 104], [318, 230], [98, 226]]), 5, 7)
    const s = recognize(pts, opts)
    expect(s?.kind).toBe('rect')
    if (s?.kind === 'rect') {
      expect(s.angle).toBe(0)
      expect(Math.abs(s.w - 220)).toBeLessThan(20)
      expect(Math.abs(s.h - 126)).toBeLessThan(20)
    }
  })

  it('rombo → rombo', () => {
    const pts = wobble(polyPath([[200, 100], [320, 180], [200, 260], [80, 180]]), 4, 11)
    const s = recognize(pts, opts)
    expect(s?.kind).toBe('diamond')
  })

  it('cuadrado girado 45° → rombo', () => {
    const pts = wobble(polyPath([[200, 100], [300, 200], [200, 300], [100, 200]]), 4, 13)
    const s = recognize(pts, opts)
    expect(s?.kind).toBe('diamond')
  })

  it('triángulo → triángulo con base horizontal y punta centrada', () => {
    const pts = wobble(polyPath([[100, 300], [205, 110], [300, 296]]), 4, 17)
    const s = recognize(pts, opts)
    expect(s?.kind).toBe('poly')
    if (s?.kind === 'poly') {
      expect(s.points).toHaveLength(3)
      const ys = s.points.map((p) => p[1]).sort((a, b) => b - a)
      expect(ys[0]).toBeCloseTo(ys[1], 5)
    }
  })

  it('línea casi horizontal → horizontal exacta', () => {
    const pts = wobble(polyPath([[100, 100], [400, 112]], 60, false), 3, 19)
    const s = recognize(pts, opts)
    expect(s?.kind).toBe('line')
    if (s?.kind === 'line') {
      expect(s.points).toHaveLength(2)
      expect(s.points[0][1]).toBeCloseTo(s.points[1][1], 5)
      expect(s.arrowEnd).toBeFalsy()
    }
  })

  it('flecha de un trazo → línea con punta', () => {
    const pts = wobble(polyPath([[100, 200], [400, 200], [360, 170], [400, 200], [360, 230]], 30, false), 2, 23)
    const s = recognize(pts, opts)
    expect(s?.kind).toBe('line')
    if (s?.kind === 'line') {
      expect(s.arrowEnd).toBe(true)
      expect(s.points[1][0]).toBeGreaterThan(380)
    }
  })

  it('forma de L → polilínea en ángulo recto', () => {
    const pts = wobble(polyPath([[100, 100], [104, 300], [320, 296]], 40, false), 3, 29)
    const s = recognize(pts, opts)
    expect(s?.kind).toBe('line')
    if (s?.kind === 'line') {
      expect(s.points).toHaveLength(3)
      expect(s.points[0][0]).toBeCloseTo(s.points[1][0], 5)
      expect(s.points[1][1]).toBeCloseTo(s.points[2][1], 5)
    }
  })

  it('garabato → nada', () => {
    const rand = rng(31)
    const pts: Vec[] = []
    let x = 200
    let y = 200
    for (let i = 0; i < 150; i++) {
      x += (rand() - 0.5) * 40
      y += (rand() - 0.5) * 40
      pts.push([x, y])
    }
    expect(recognize(pts, opts)).toBeNull()
  })

  it('espiral → nada', () => {
    const pts: Vec[] = []
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * Math.PI * 4
      const r = 20 + t * 15
      pts.push([300 + Math.cos(t) * r, 300 + Math.sin(t) * r])
    }
    expect(recognize(pts, opts)).toBeNull()
  })

  it('trazo diminuto → nada', () => {
    expect(recognize(ellipsePath(10, 10, 4, 4), opts)).toBeNull()
  })
})
