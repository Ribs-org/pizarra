import { Search, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { insertStamp } from '../actions'
import { normalize } from '../search'
import { CATEGORIES, STAMPS, type StampCategory, type StampDef } from '../stamps'
import { screenToWorld, useStore } from '../store'
import { THEMES, type Theme } from '../theme'
import type { StampEl } from '../types'
import { ElementView } from './ElementView'

const TILE = 64

function previewEl(def: StampDef): StampEl {
  const k = Math.min(TILE / def.box[0], TILE / def.box[1])
  const w = def.box[0] * k
  const h = def.box[1] * k
  return { id: `pv-${def.id}`, type: 'stamp', stamp: def.id, x: (TILE - w) / 2 + 6, y: (TILE - h) / 2 + 6, w, h, width: 1.4, rough: 1, seed: 7, color: 'ink' }
}

export function StampPreview({ def, theme, size = TILE + 12 }: { def: StampDef; theme: Theme; size?: number }) {
  const el = useMemo(() => previewEl(def), [def])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${TILE + 12} ${TILE + 12}`}>
      <ElementView el={el} theme={theme} />
    </svg>
  )
}

export function Library() {
  const open = useStore((s) => s.ui.library)
  const themeKey = useStore((s) => s.settings.theme)
  const setUI = useStore((s) => s.setUI)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<StampCategory | 'all'>('all')
  const [ghost, setGhost] = useState<{ def: StampDef; x: number; y: number } | null>(null)
  const drag = useRef<{ def: StampDef; start: [number, number]; moved: boolean } | null>(null)
  const theme = THEMES[themeKey]

  const list = useMemo(() => {
    const words = normalize(q).split(/\s+/).filter(Boolean)
    return STAMPS.filter((s) => {
      if (cat !== 'all' && s.cat !== cat) return false
      const hay = normalize(`${s.name} ${s.tags} ${s.cat}`)
      return words.every((w) => hay.includes(w))
    })
  }, [q, cat])

  if (!open) return null

  return (
    <aside className="library panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel-head">
        <span>Biblioteca</span>
        <button className="icon-btn small" title="Cerrar — B" onClick={() => setUI({ library: false })}>
          <X size={16} />
        </button>
      </div>
      <label className="search">
        <Search size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: persona, servidor, flecha…" onKeyDown={(e) => e.stopPropagation()} />
      </label>
      <div className="chips">
        <button className={cat === 'all' ? 'active' : ''} onClick={() => setCat('all')}>
          Todo
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className={cat === c.id ? 'active' : ''} onClick={() => setCat(c.id)}>
            {c.name}
          </button>
        ))}
      </div>
      <div className="stamp-grid">
        {list.map((def) => (
          <button
            key={def.id}
            className="stamp-tile"
            title={`${def.name} — toca para insertar o arrastra a la pizarra`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              drag.current = { def, start: [e.clientX, e.clientY], moved: false }
            }}
            onPointerMove={(e) => {
              const d = drag.current
              if (!d) return
              if (!d.moved && Math.hypot(e.clientX - d.start[0], e.clientY - d.start[1]) > 10) d.moved = true
              if (d.moved) setGhost({ def: d.def, x: e.clientX, y: e.clientY })
            }}
            onPointerUp={(e) => {
              const d = drag.current
              drag.current = null
              setGhost(null)
              if (!d) return
              if (!d.moved) return insertStamp(d.def.id)
              const target = document.elementFromPoint(e.clientX, e.clientY)
              if (target?.closest('.board')) {
                insertStamp(d.def.id, screenToWorld(useStore.getState().camera, [e.clientX, e.clientY]))
              }
            }}
            onPointerCancel={() => {
              drag.current = null
              setGhost(null)
            }}
          >
            <StampPreview def={def} theme={theme} />
            <span>{def.name}</span>
          </button>
        ))}
        {list.length === 0 && <p className="muted empty">Nada con “{q}”. Prueba otra palabra.</p>}
      </div>
      {ghost &&
        createPortal(
          <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>
            <StampPreview def={ghost.def} theme={theme} size={90} />
          </div>,
          document.body,
        )}
    </aside>
  )
}
