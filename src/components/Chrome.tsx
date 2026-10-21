/** Controles de las esquinas: menú, deshacer/rehacer, zoom, ayuda, ocultar interfaz. */
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CircleQuestionMark,
  ClipboardCopy,
  Command,
  Copy,
  Eye,
  EyeOff,
  FileDown,
  FileUp,
  ImageDown,
  Maximize,
  Menu,
  Minus,
  Plus,
  Redo2,
  Trash,
  Undo2,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearBoard, deleteSelection, duplicateSelection, reorderSelection, resetZoom, toggleFullscreen, zoomBy } from '../actions'
import { copyPng, exportPng, openFile, saveFile } from '../export'
import { elementBox, unionBox } from '../geometry'
import { useStore } from '../store'
import { THEMES, type Pattern, type ThemeKey } from '../theme'
import { toast } from './Toast'

export function TopRight() {
  const ui = useStore((s) => s.ui)
  const setUI = useStore((s) => s.setUI)
  return (
    <div className="top-right" onMouseDown={(e) => e.preventDefault()}>
      <div className="panel row">
        <button className="icon-btn" title="Paleta de comandos — Ctrl+K" onClick={() => setUI({ palette: true })}>
          <Command size={18} />
        </button>
        <button className="icon-btn" title="Pantalla completa — F" onClick={toggleFullscreen}>
          <Maximize size={18} />
        </button>
        <button className="icon-btn" title="Ocultar interfaz para grabar — ." onClick={() => setUI({ hidden: true, menu: false })}>
          <EyeOff size={18} />
        </button>
        <button className={`icon-btn ${ui.menu ? 'active' : ''}`} title="Menú" onClick={() => setUI({ menu: !ui.menu })}>
          <Menu size={18} />
        </button>
      </div>
      {ui.menu && <MainMenu />}
    </div>
  )
}

const PATTERNS: { id: Pattern; name: string }[] = [
  { id: 'none', name: 'Liso' },
  { id: 'dots', name: 'Puntos' },
  { id: 'grid', name: 'Cuadros' },
  { id: 'lines', name: 'Renglones' },
]

function MainMenu() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const setUI = useStore((s) => s.setUI)
  const close = () => setUI({ menu: false })

  return (
    <div className="menu panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel-label">Fondo</div>
      <div className="themes">
        {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
          <button
            key={k}
            className={`theme-chip ${settings.theme === k ? 'active' : ''}`}
            style={{ background: THEMES[k].bg, color: THEMES[k].palette.ink }}
            onClick={() => setSettings({ theme: k })}
            title={THEMES[k].name}
          >
            <span>Aa</span>
            <small>{THEMES[k].name}</small>
          </button>
        ))}
      </div>
      <div className="seg wide">
        {PATTERNS.map((p) => (
          <button key={p.id} className={settings.pattern === p.id ? 'active' : ''} onClick={() => setSettings({ pattern: p.id })}>
            {p.name}
          </button>
        ))}
      </div>

      <div className="panel-label">
        Suavizado del trazo <span className="muted">{Math.round(settings.smoothing * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={settings.smoothing}
        onChange={(e) => setSettings({ smoothing: Number(e.target.value) })}
      />
      <label className="toggle">
        <input type="checkbox" checked={settings.quickShape} onChange={(e) => setSettings({ quickShape: e.target.checked })} />
        <span>
          <b>Mantener para formas</b>
          <small>Dibuja un círculo, caja o flecha y deja el dedo quieto: se arregla solo.</small>
        </span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={settings.animate} onChange={(e) => setSettings({ animate: e.target.checked })} />
        <span>
          <b>Animar al insertar</b>
          <small>Los dibujos de la biblioteca aparecen trazándose.</small>
        </span>
      </label>

      <div className="menu-sep" />
      <MenuItem icon={<ImageDown size={16} />} label="Exportar PNG" hint="Ctrl+Shift+E" onClick={async () => { close(); toast((await exportPng()) ? 'PNG exportado' : 'No hay nada que exportar') }} />
      <MenuItem icon={<ClipboardCopy size={16} />} label="Copiar como imagen" hint="Ctrl+Shift+C" onClick={async () => { close(); toast((await copyPng()) ? 'Imagen copiada' : 'No se pudo copiar') }} />
      <MenuItem icon={<FileDown size={16} />} label="Guardar archivo" hint="Ctrl+S" onClick={() => { close(); saveFile() }} />
      <MenuItem icon={<FileUp size={16} />} label="Abrir archivo" hint="Ctrl+O" onClick={() => { close(); openFile() }} />
      <MenuItem icon={<CircleQuestionMark size={16} />} label="Atajos y gestos" hint="?" onClick={() => setUI({ menu: false, help: true })} />
      <div className="menu-sep" />
      <MenuItem
        icon={<Trash size={16} />}
        label="Limpiar pizarra"
        danger
        onClick={() => {
          close()
          clearBoard()
          toast('Pizarra limpia · Ctrl+Z para deshacer')
        }}
      />
    </div>
  )
}

function MenuItem(props: { icon: ReactNode; label: string; hint?: string; danger?: boolean; onClick: () => void }) {
  return (
    <button className={`menu-item ${props.danger ? 'danger' : ''}`} onClick={props.onClick}>
      {props.icon}
      <span>{props.label}</span>
      {props.hint && <kbd>{props.hint}</kbd>}
    </button>
  )
}

export function BottomLeft() {
  const z = useStore((s) => s.camera.z)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  return (
    <div className="bottom-left" onMouseDown={(e) => e.preventDefault()}>
      <div className="panel row">
        <button className="icon-btn" disabled={!canUndo} title="Deshacer — Ctrl+Z · toque con 2 dedos" onClick={undo}>
          <Undo2 size={18} />
        </button>
        <button className="icon-btn" disabled={!canRedo} title="Rehacer — Ctrl+Y · toque con 3 dedos" onClick={redo}>
          <Redo2 size={18} />
        </button>
      </div>
      <div className="panel row">
        <button className="icon-btn" title="Alejar — Ctrl+-" onClick={() => zoomBy(1 / 1.25)}>
          <Minus size={18} />
        </button>
        <button className="zoom-label" title="Volver a 100% — Ctrl+0" onClick={resetZoom}>
          {Math.round(z * 100)}%
        </button>
        <button className="icon-btn" title="Acercar — Ctrl+=" onClick={() => zoomBy(1.25)}>
          <Plus size={18} />
        </button>
      </div>
    </div>
  )
}

export function HelpButton() {
  const setUI = useStore((s) => s.setUI)
  return (
    <button className="panel icon-btn help-btn" title="Atajos y gestos — ?" onClick={() => setUI({ help: true })}>
      <CircleQuestionMark size={18} />
    </button>
  )
}

/** Botón casi invisible para volver a mostrar la interfaz (no se nota en la grabación). */
export function ShowUIButton() {
  const setUI = useStore((s) => s.setUI)
  return (
    <button className="show-ui" title="Mostrar interfaz — ." onClick={() => setUI({ hidden: false })}>
      <Eye size={16} />
    </button>
  )
}

/** Acciones flotantes sobre la selección (pensadas para el dedo: no hace falta teclado). */
export function SelectionActions() {
  const selection = useStore((s) => s.selection)
  const elements = useStore((s) => s.elements)
  const camera = useStore((s) => s.camera)
  const editing = useStore((s) => s.editing)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const down = () => setDragging(true)
    const up = () => setDragging(false)
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  const box = useMemo(() => {
    const ids = new Set(selection)
    return unionBox(elements.filter((e) => ids.has(e.id)).map(elementBox))
  }, [selection, elements])

  if (!box || editing || dragging) return null
  const cx = ((box.minX + box.maxX) / 2) * camera.z + camera.x
  let top = box.minY * camera.z + camera.y - 58
  if (top < 64) top = box.maxY * camera.z + camera.y + 16

  return (
    <div className="selection-actions panel row" style={{ left: cx, top }} onPointerDown={(e) => e.stopPropagation()}>
      <button className="icon-btn" title="Duplicar — Ctrl+D" onClick={duplicateSelection}>
        <Copy size={17} />
      </button>
      <button className="icon-btn" title="Traer al frente" onClick={() => reorderSelection(true)}>
        <ArrowUpToLine size={17} />
      </button>
      <button className="icon-btn" title="Enviar al fondo" onClick={() => reorderSelection(false)}>
        <ArrowDownToLine size={17} />
      </button>
      <button className="icon-btn danger" title="Eliminar — Supr" onClick={deleteSelection}>
        <Trash size={17} />
      </button>
    </div>
  )
}
