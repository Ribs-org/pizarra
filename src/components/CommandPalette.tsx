import { CornerDownLeft, Search, Type } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  applyStyleToSelection,
  clearBoard,
  insertStamp,
  quickText,
  resetZoom,
  selectAll,
  toggleFullscreen,
  viewCenterWorld,
  zoomToFit,
} from '../actions'
import { copyPng, exportPng, openFile, saveFile } from '../export'
import { pasteImage } from '../images'
import { normalize } from '../search'
import { STAMPS } from '../stamps'
import { newId, useStore } from '../store'
import { lineHeight, measureText } from '../text'
import { COLOR_NAMES, COLOR_ORDER, FONTS, FONT_ORDER, SIZES, THEMES, type Pattern, type ThemeKey } from '../theme'
import { TOOLS } from '../tools'
import { StampPreview } from './Library'
import { toast } from './Toast'
import { togglePad } from './ZoomPad'

interface Cmd {
  id: string
  label: string
  group: string
  keywords?: string
  hint?: string
  icon?: ReactNode
  run: () => void
}

/** Inserta texto "escribiéndose solo": ideal para no grabar typos ni el teclado. */
export function insertWrittenText(text: string) {
  const s = useStore.getState()
  const fontSize = SIZES[s.style.size].text
  const { w, h } = measureText(text, s.style.font, fontSize)
  const c = viewCenterWorld()
  const el = {
    id: newId(),
    type: 'text' as const,
    x: c[0] - w / 2,
    y: c[1] - lineHeight(s.style.font, fontSize) / 2,
    text,
    fontSize,
    font: s.style.font,
    color: s.style.color,
    w,
    h,
  }
  s.setTool('select')
  s.add([el], { select: true, animate: s.settings.animate ? Math.min(3200, 300 + text.length * 45) : undefined })
}

function buildCommands(): Cmd[] {
  const s = useStore.getState()
  const theme = THEMES[s.settings.theme]
  const cmds: Cmd[] = []
  cmds.push({ id: 'text', label: 'Escribir texto aquí', group: 'Acciones', hint: 'Enter', keywords: 'texto escribir teclado', icon: <Type size={16} />, run: quickText })
  for (const t of TOOLS) {
    const Icon = t.icon
    cmds.push({ id: `tool-${t.id}`, label: t.name, group: 'Herramientas', hint: t.key, keywords: 'herramienta', icon: <Icon size={16} />, run: () => s.setTool(t.id) })
  }
  for (const st of STAMPS) {
    cmds.push({
      id: `stamp-${st.id}`,
      label: `Insertar ${st.name.toLowerCase()}`,
      group: 'Dibujos',
      keywords: `${st.tags} dibujo sello insertar`,
      icon: <StampPreview def={st} theme={theme} size={22} />,
      run: () => insertStamp(st.id),
    })
  }
  COLOR_ORDER.forEach((c, i) =>
    cmds.push({
      id: `color-${c}`,
      label: `Color ${COLOR_NAMES[c].toLowerCase()}`,
      group: 'Estilo',
      hint: String(i === 9 ? 0 : i + 1),
      icon: <span className="swatch-dot" style={{ background: theme.palette[c] }} />,
      run: () => {
        s.setStyle({ color: c })
        applyStyleToSelection({ color: c })
      },
    }),
  )
  SIZES.forEach((sz, i) => cmds.push({ id: `size-${i}`, label: `Grosor ${sz.label}`, group: 'Estilo', keywords: 'tamaño', run: () => { s.setStyle({ size: i }); applyStyleToSelection({ size: i }) } }))
  for (const k of FONT_ORDER) {
    cmds.push({
      id: `font-${k}`,
      label: `Letra ${FONTS[k].name.toLowerCase()}`,
      group: 'Estilo',
      keywords: 'fuente tipografia',
      icon: <span style={{ fontFamily: `"${FONTS[k].family}"` }}>Aa</span>,
      run: () => { s.setStyle({ font: k }); applyStyleToSelection({ font: k }) },
    })
  }
  for (const k of Object.keys(THEMES) as ThemeKey[]) {
    cmds.push({
      id: `theme-${k}`,
      label: `Fondo ${THEMES[k].name.toLowerCase()}`,
      group: 'Pizarra',
      keywords: 'tema color fondo oscuro claro',
      icon: <span className="swatch-dot" style={{ background: THEMES[k].bg, boxShadow: 'inset 0 0 0 1px rgba(128,128,128,.5)' }} />,
      run: () => s.setSettings({ theme: k }),
    })
  }
  const patterns: [Pattern, string][] = [['none', 'liso'], ['dots', 'con puntos'], ['grid', 'cuadriculado'], ['lines', 'con renglones']]
  for (const [p, name] of patterns) cmds.push({ id: `pattern-${p}`, label: `Fondo ${name}`, group: 'Pizarra', keywords: 'patron', run: () => s.setSettings({ pattern: p }) })
  const actions: Omit<Cmd, 'group'>[] = [
    { id: 'pad', label: 'Lupa de escritura', hint: 'Z', keywords: 'zoom escribir letra ordenada', run: togglePad },
    { id: 'library', label: 'Biblioteca de dibujos', hint: 'B', run: () => s.setUI({ library: true }) },
    { id: 'paste-image', label: 'Pegar imagen', hint: 'Ctrl+V', keywords: 'captura foto screenshot portapapeles', run: pasteImage },
    { id: 'undo', label: 'Deshacer', hint: 'Ctrl+Z', run: s.undo },
    { id: 'redo', label: 'Rehacer', hint: 'Ctrl+Y', run: s.redo },
    { id: 'all', label: 'Seleccionar todo', hint: 'Ctrl+A', run: selectAll },
    { id: 'fit', label: 'Ver todo el contenido', hint: 'Shift+1', keywords: 'zoom ajustar', run: zoomToFit },
    { id: 'zoom100', label: 'Zoom al 100%', hint: 'Ctrl+0', run: resetZoom },
    { id: 'full', label: 'Pantalla completa', hint: 'F', run: toggleFullscreen },
    { id: 'hide', label: 'Ocultar interfaz (modo grabación)', hint: '.', keywords: 'grabar video limpio', run: () => s.setUI({ hidden: true }) },
    { id: 'png', label: 'Exportar PNG', hint: 'Ctrl+Shift+E', keywords: 'imagen descargar', run: async () => toast((await exportPng()) ? 'PNG exportado' : 'No hay nada que exportar') },
    { id: 'copy', label: 'Copiar como imagen', hint: 'Ctrl+Shift+C', run: async () => toast((await copyPng()) ? 'Imagen copiada' : 'No se pudo copiar') },
    { id: 'save', label: 'Guardar archivo', hint: 'Ctrl+S', run: saveFile },
    { id: 'open', label: 'Abrir archivo', hint: 'Ctrl+O', run: openFile },
    { id: 'clear', label: 'Limpiar pizarra', keywords: 'borrar todo nuevo', run: () => { clearBoard(); toast('Pizarra limpia · Ctrl+Z para deshacer') } },
    { id: 'help', label: 'Atajos y gestos', hint: '?', keywords: 'ayuda', run: () => s.setUI({ help: true }) },
  ]
  for (const a of actions) cmds.push({ ...a, group: 'Acciones' })
  return cmds
}

export function CommandPalette() {
  const open = useStore((s) => s.ui.palette)
  // Cada apertura monta la paleta de cero: búsqueda vacía y foco inmediato.
  return open ? <PaletteBody /> : null
}

function PaletteBody() {
  const setUI = useStore((s) => s.setUI)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const all = useMemo(buildCommands, [])
  const results = useMemo(() => {
    const words = normalize(q).split(/\s+/).filter(Boolean)
    const matched = words.length
      ? all.filter((c) => {
          const hay = normalize(`${c.label} ${c.keywords ?? ''} ${c.group}`)
          return words.every((w) => hay.includes(w))
        })
      : all.filter((c) => c.group !== 'Dibujos' || ['persona', 'arbol', 'servidor', 'db', 'laptop', 'nube'].includes(c.id.slice(6)))
    const write: Cmd[] = q.trim()
      ? [{ id: 'write', label: `Escribir “${q.trim()}”`, group: 'Texto', hint: 'Shift+Enter', icon: <CornerDownLeft size={16} />, run: () => insertWrittenText(q.trim()) }]
      : []
    return matched.length ? [...matched.slice(0, 60), ...write] : write
  }, [all, q])

  useEffect(() => {
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  const close = () => setUI({ palette: false })
  const run = (c?: Cmd) => {
    if (!c) return
    close()
    c.run()
  }

  let lastGroup = ''
  return (
    <div className="overlay" onPointerDown={close}>
      <div className="palette panel" onPointerDown={(e) => e.stopPropagation()}>
        <label className="search big">
          <Search size={18} />
          <input
            autoFocus
            value={q}
            placeholder="Busca una acción o dibujo… o escribe un texto y Shift+Enter"
            onChange={(e) => {
              setQ(e.target.value)
              setIdx(0)
            }}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Escape') close()
              else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIdx((i) => Math.min(results.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIdx((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (e.shiftKey && q.trim()) run(results.find((c) => c.id === 'write'))
                else run(results[idx])
              }
            }}
          />
        </label>
        <div className="palette-list" ref={listRef}>
          {results.map((c, i) => {
            const header = c.group !== lastGroup ? <div className="palette-group">{c.group}</div> : null
            lastGroup = c.group
            return (
              <div key={c.id}>
                {header}
                <button className={`palette-item ${i === idx ? 'active' : ''}`} onMouseEnter={() => setIdx(i)} onClick={() => run(c)}>
                  <span className="palette-icon">{c.icon}</span>
                  <span className="palette-label">{c.label}</span>
                  {c.hint && <kbd>{c.hint}</kbd>}
                </button>
              </div>
            )
          })}
          {results.length === 0 && <p className="muted empty">Escribe algo…</p>}
        </div>
      </div>
    </div>
  )
}
