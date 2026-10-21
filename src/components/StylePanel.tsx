import { ChevronLeft, Palette } from 'lucide-react'
import type { CSSProperties } from 'react'
import { applyStyleToSelection } from '../actions'
import { useStore } from '../store'
import { padRect } from './ZoomPad'
import { COLOR_NAMES, COLOR_ORDER, FONTS, FONT_ORDER, SIZES, THEMES } from '../theme'
import type { FillStyle, FontKey, Roughness } from '../types'

const SHAPE_TYPES = new Set(['rect', 'ellipse', 'diamond', 'line', 'poly', 'stamp'])

export function StylePanel() {
  const style = useStore((s) => s.style)
  const tool = useStore((s) => s.tool)
  const open = useStore((s) => s.ui.stylePanel)
  const themeKey = useStore((s) => s.settings.theme)
  const editing = useStore((s) => s.editing)
  const selection = useStore((s) => s.selection)
  const elements = useStore((s) => s.elements)
  const setStyle = useStore((s) => s.setStyle)
  const setUI = useStore((s) => s.setUI)
  const padOpen = useStore((s) => s.ui.pad)
  const theme = THEMES[themeKey]

  const ids = new Set(selection)
  const selected = elements.filter((e) => ids.has(e.id))
  const showShape =
    ['rect', 'ellipse', 'diamond', 'arrow', 'line', 'pen'].includes(tool) || selected.some((e) => SHAPE_TYPES.has(e.type))
  const showFill = ['rect', 'ellipse', 'diamond', 'pen'].includes(tool) || selected.some((e) => 'fill' in e)
  const showFont = tool === 'text' || !!editing || selected.some((e) => e.type === 'text')

  if (!open) {
    return (
      <button className="panel icon-btn style-toggle" title="Mostrar colores y estilo" onClick={() => setUI({ stylePanel: true })}>
        <Palette size={18} />
        <span className="swatch-dot" style={{ background: theme.palette[style.color] }} />
      </button>
    )
  }

  const pick = (patch: Parameters<typeof setStyle>[0]) => {
    setStyle(patch)
    applyStyleToSelection(patch)
  }

  return (
    <div
      className="style-panel panel"
      // Con la lupa abierta, el panel no baja hasta ella (ahí empiezas a escribir).
      style={padOpen ? { maxHeight: padRect().top - 84 } : undefined}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="panel-head">
        <span>Color</span>
        <button className="icon-btn small" title="Ocultar panel" onClick={() => setUI({ stylePanel: false })}>
          <ChevronLeft size={16} />
        </button>
      </div>
      <div className="swatches">
        {COLOR_ORDER.map((c, i) => (
          <button
            key={c}
            className={`swatch ${style.color === c ? 'active' : ''}`}
            style={{ '--c': theme.palette[c] } as CSSProperties}
            title={`${COLOR_NAMES[c]} — ${i === 9 ? 0 : i + 1}`}
            aria-label={COLOR_NAMES[c]}
            onClick={() => pick({ color: c })}
          />
        ))}
      </div>

      <div className="panel-label">Grosor</div>
      <div className="seg">
        {SIZES.map((sz, i) => (
          <button key={sz.label} className={style.size === i ? 'active' : ''} title={`Grosor ${sz.label}`} onClick={() => pick({ size: i })}>
            <span className="size-dot" style={{ width: 4 + i * 4, height: 4 + i * 4 }} />
          </button>
        ))}
      </div>

      {showShape && (
        <>
          <div className="panel-label">Trazo</div>
          <div className="seg">
            {([0, 1, 2] as Roughness[]).map((r) => (
              <button key={r} className={style.rough === r ? 'active' : ''} title={['Limpio', 'A mano', 'Boceto'][r]} onClick={() => pick({ rough: r })}>
                <RoughIcon r={r} />
              </button>
            ))}
          </div>
        </>
      )}

      {showFill && (
        <>
          <div className="panel-label">Relleno</div>
          <div className="seg">
            {(['none', 'soft', 'hachure'] as FillStyle[]).map((f) => (
              <button key={f} className={style.fill === f ? 'active' : ''} title={{ none: 'Sin relleno', soft: 'Suave', hachure: 'Rayado' }[f]} onClick={() => pick({ fill: f })}>
                <FillIcon f={f} />
              </button>
            ))}
          </div>
        </>
      )}

      {showFont && (
        <>
          <div className="panel-label">Letra</div>
          <div className="fonts">
            {FONT_ORDER.map((k: FontKey) => (
              <button
                key={k}
                className={style.font === k ? 'active' : ''}
                style={{ fontFamily: `"${FONTS[k].family}"`, fontWeight: FONTS[k].weight, fontSize: 15 * FONTS[k].scale }}
                onClick={() => pick({ font: k })}
                title={FONTS[k].name}
              >
                {FONTS[k].name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function RoughIcon({ r }: { r: Roughness }) {
  const d = ['M3 12 L21 12', 'M3 12.5 Q8 10.5 12 12 T21 11.5', 'M3 13 Q6 9 9 12.5 T15 11 T21 12.5']
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d={d[r]} />
      {r === 2 && <path d="M3 11.5 Q7 13 11 11 T21 11" opacity="0.6" />}
    </svg>
  )
}

function FillIcon({ f }: { f: FillStyle }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="16" height="16" rx="3" fill={f === 'soft' ? 'currentColor' : 'none'} fillOpacity={0.3} />
      {f === 'hachure' && <path d="M4 12 L12 4 M4 18 L18 4 M10 18 L18 10" strokeWidth="1.2" />}
    </svg>
  )
}
