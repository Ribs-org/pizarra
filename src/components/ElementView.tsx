import { memo, type CSSProperties } from 'react'
import { drawElement } from '../render'
import type { Theme } from '../theme'
import type { El } from '../types'

interface Props {
  el: El
  theme: Theme
  /** si viene, el elemento aparece animado (dibujándose) durante estos ms */
  anim?: number
  faded?: boolean
}

export const ElementView = memo(function ElementView({ el, theme, anim, faded }: Props) {
  const drawn = drawElement(el, theme)
  const step = anim ? anim / Math.max(1, drawn.steps) : 0
  const animStyle = (seq = 0): CSSProperties | undefined =>
    anim ? { animationDelay: `${seq * step}ms`, animationDuration: `${Math.max(180, step * 1.6)}ms` } : undefined

  return (
    <g opacity={faded ? 0.22 : undefined}>
      {drawn.paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.fill ?? 'none'}
          stroke={p.stroke}
          strokeWidth={p.sw}
          strokeLinecap={p.linecap}
          strokeLinejoin="round"
          opacity={p.opacity}
          transform={p.rot ? `rotate(${p.rot[0]} ${p.rot[1]} ${p.rot[2]})` : undefined}
          pathLength={anim && p.draw ? 1 : undefined}
          // Los trazos translúcidos (destacador) no se animan: la animación pisaría su opacidad.
          className={anim && !p.opacity ? (p.draw ? 'a-draw' : 'a-fade') : undefined}
          style={p.opacity ? undefined : animStyle(p.seq)}
        />
      ))}
      {drawn.texts.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={t.y}
          fill={t.fill}
          fontFamily={`"${t.family}", cursive`}
          fontSize={t.size}
          fontWeight={t.weight}
          className={anim ? 'a-write' : undefined}
          style={{ whiteSpace: 'pre', ...animStyle(i) }}
        >
          {t.text}
        </text>
      ))}
    </g>
  )
})
