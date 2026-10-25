import { memo, type CSSProperties } from 'react'
import { useFiles } from '../images'
import { drawElement, type ImagePrim } from '../render'
import type { Theme } from '../theme'
import type { El } from '../types'

interface Props {
  el: El
  theme: Theme
  /** si viene, el elemento aparece animado (dibujándose) durante estos ms */
  anim?: number
  faded?: boolean
}

const rotate = (rot?: [number, number, number]) => (rot ? `rotate(${rot[0]} ${rot[1]} ${rot[2]})` : undefined)

export const ElementView = memo(function ElementView({ el, theme, anim, faded }: Props) {
  const drawn = drawElement(el, theme)
  const step = anim ? anim / Math.max(1, drawn.steps) : 0
  const animStyle = (seq = 0): CSSProperties | undefined =>
    anim ? { animationDelay: `${seq * step}ms`, animationDuration: `${Math.max(180, step * 1.6)}ms` } : undefined

  return (
    <g opacity={faded ? 0.22 : undefined}>
      {drawn.images?.map((im, i) => (
        <ImageView key={i} im={im} theme={theme} className={anim ? 'a-fade' : undefined} style={animStyle()} />
      ))}
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
          transform={rotate(p.rot)}
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
          transform={rotate(t.rot)}
          className={anim ? 'a-write' : undefined}
          style={{ whiteSpace: 'pre', ...animStyle(i) }}
        >
          {t.text}
        </text>
      ))}
    </g>
  )
})

/** El contenido de la imagen llega aparte (y al abrir la app, un poco después que los elementos). */
function ImageView({ im, theme, className, style }: { im: ImagePrim; theme: Theme; className?: string; style?: CSSProperties }) {
  const src = useFiles((s) => s.files[im.file])
  const ready = useFiles((s) => s.ready)
  if (!src) {
    // Se perdió el contenido (p. ej. se borraron los datos del navegador): queda un marco para poder borrarla.
    return ready ? (
      <rect x={im.x} y={im.y} width={im.w} height={im.h} fill="none" stroke={theme.palette.gray} strokeDasharray="6 6" transform={rotate(im.rot)} />
    ) : null
  }
  return (
    <image
      href={src}
      x={im.x}
      y={im.y}
      width={im.w}
      height={im.h}
      preserveAspectRatio="none"
      transform={rotate(im.rot)}
      className={className}
      style={style}
    />
  )
}
