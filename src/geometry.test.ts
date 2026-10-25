import { describe, expect, it } from 'vitest'
import { elementBox, frameOf, hitDistance, rotateEl, scaleEl } from './geometry'
import type { StampEl, StrokeEl } from './types'

// La "llave {": alta y angosta.
const brace: StampEl = { id: 'b', type: 'stamp', stamp: 'llave', x: 0, y: 0, w: 40, h: 120, width: 2, rough: 1, seed: 1, color: 'ink' }
const center = (b: { minX: number; minY: number; maxX: number; maxY: number }) => [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2]

describe('rotateEl', () => {
  it('girar 90° una llave la deja acostada, con el mismo centro', () => {
    const r = rotateEl(brace, Math.PI / 2, [20, 60])
    expect(r.angle).toBeCloseTo(Math.PI / 2)
    const b = elementBox(r)
    expect(b.maxX - b.minX).toBeCloseTo(120)
    expect(b.maxY - b.minY).toBeCloseTo(40)
    expect(center(b)[0]).toBeCloseTo(20)
    expect(center(b)[1]).toBeCloseTo(60)
  })

  it('cuatro giros de 90° vuelven a 0 exacto', () => {
    let r = brace
    for (let i = 0; i < 4; i++) r = rotateEl(r, Math.PI / 2, [20, 60])
    expect(r.angle).toBe(0)
    expect(r.x).toBeCloseTo(0)
    expect(r.y).toBeCloseTo(0)
  })

  it('al girar un grupo, cada elemento gira alrededor del centro común', () => {
    const r = rotateEl(brace, Math.PI, [100, 60])
    expect(r.x + r.w / 2).toBeCloseTo(180)
    expect(r.y + r.h / 2).toBeCloseTo(60)
  })

  it('un trazo gira sus puntos y conserva la presión', () => {
    const s: StrokeEl = { id: 's', type: 'stroke', points: [[10, 0, 0.3], [20, 0, 0.7]], width: 2, color: 'ink' }
    const r = rotateEl(s, Math.PI / 2, [0, 0])
    expect(r.points[1][0]).toBeCloseTo(0)
    expect(r.points[1][1]).toBeCloseTo(20)
    expect(r.points[1][2]).toBe(0.7)
  })
})

describe('elementos girados', () => {
  const r = rotateEl(brace, Math.PI / 2, [20, 60])

  it('se tocan donde quedaron, no donde estaban', () => {
    expect(hitDistance(r, [-30, 60])).toBe(0)
    expect(hitDistance(r, [20, 5])).toBeGreaterThan(10)
  })

  it('el marco de selección de uno solo sigue su giro', () => {
    const f = frameOf([r])!
    expect(f.w).toBeCloseTo(40)
    expect(f.h).toBeCloseTo(120)
    expect(f.angle).toBeCloseTo(Math.PI / 2)
  })

  it('escalar mantiene el giro y escala desde el centro', () => {
    const s = scaleEl(r, 2, [20, 60])
    expect(s.angle).toBeCloseTo(Math.PI / 2)
    expect(s.w).toBeCloseTo(80)
    expect(s.x + s.w / 2).toBeCloseTo(20)
    expect(s.y + s.h / 2).toBeCloseTo(60)
  })
})
