import { create } from 'zustand'
import type { Pattern, ThemeKey } from './theme'
import type { Camera, ColorKey, El, FillStyle, FontKey, Roughness, Tool, Vec } from './types'

export interface Style {
  color: ColorKey
  size: number
  fill: FillStyle
  rough: Roughness
  font: FontKey
}

export interface Settings {
  theme: ThemeKey
  pattern: Pattern
  /** 0..1: cuánto se estabiliza el trazo (más = letra más pareja, un poco más de "retraso") */
  smoothing: number
  /** mantener el dedo quieto al final de un trazo lo convierte en forma */
  quickShape: boolean
  /** los elementos insertados aparecen dibujándose */
  animate: boolean
}

export interface UI {
  hidden: boolean
  palette: boolean
  library: boolean
  help: boolean
  menu: boolean
  pad: boolean
  stylePanel: boolean
}

export interface EditingText {
  /** id del texto existente que se está editando (si no, es uno nuevo) */
  id?: string
  x: number
  y: number
  text: string
  fontSize: number
  font: FontKey
  color: ColorKey
}

export interface PadTarget {
  /** esquina superior izquierda de la zona de escritura, en el mundo */
  x: number
  y: number
  /** ancho de la zona (el alto sale de la proporción del panel) */
  w: number
  /** x donde empiezan las líneas (para "nueva línea") */
  lineStartX: number
}

interface State {
  elements: El[]
  past: El[][]
  future: El[][]
  selection: string[]
  tool: Tool
  style: Style
  settings: Settings
  camera: Camera
  ui: UI
  editing: EditingText | null
  /** ids recién insertados que deben animarse al aparecer → duración en ms */
  anim: Record<string, number>
  pad: PadTarget | null
  /** última posición del puntero sobre la pizarra (mundo), para insertar cosas ahí */
  pointer: Vec | null
}

interface Actions {
  /** Reemplaza los elementos guardando el estado anterior en el historial. */
  commit: (next: El[]) => void
  /** Cambia los elementos sin tocar el historial (gestos en curso). */
  setElements: (next: El[]) => void
  /** Guarda un estado anterior en el historial (al terminar un gesto). */
  pushHistory: (before: El[]) => void
  add: (els: El[], opts?: { select?: boolean; animate?: number }) => void
  removeIds: (ids: string[]) => void
  undo: () => void
  redo: () => void
  setTool: (t: Tool) => void
  setStyle: (s: Partial<Style>) => void
  setSettings: (s: Partial<Settings>) => void
  setCamera: (c: Camera) => void
  setUI: (u: Partial<UI>) => void
  select: (ids: string[]) => void
  setEditing: (e: EditingText | null) => void
  setPad: (p: PadTarget | null) => void
}

const HISTORY = 200

export const DEFAULT_STYLE: Style = { color: 'ink', size: 1, fill: 'none', rough: 1, font: 'marker' }
export const DEFAULT_SETTINGS: Settings = {
  theme: 'graphite',
  pattern: 'dots',
  smoothing: 0.5,
  quickShape: true,
  animate: true,
}

export const useStore = create<State & Actions>()((set, get) => ({
  elements: [],
  past: [],
  future: [],
  selection: [],
  tool: 'pen',
  style: DEFAULT_STYLE,
  settings: DEFAULT_SETTINGS,
  camera: { x: 0, y: 0, z: 1 },
  ui: { hidden: false, palette: false, library: false, help: false, menu: false, pad: false, stylePanel: true },
  editing: null,
  anim: {},
  pad: null,
  pointer: null,

  commit: (next) =>
    set((s) => ({ past: [...s.past.slice(-HISTORY + 1), s.elements], future: [], elements: next })),
  setElements: (next) => set({ elements: next }),
  pushHistory: (before) =>
    set((s) => (before === s.elements ? {} : { past: [...s.past.slice(-HISTORY + 1), before], future: [] })),
  add: (els, opts = {}) => {
    const s = get()
    s.commit([...s.elements, ...els])
    if (opts.select) set({ selection: els.map((e) => e.id) })
    if (opts.animate) {
      const ms = opts.animate
      const anim = { ...get().anim }
      for (const e of els) anim[e.id] = ms
      set({ anim })
      setTimeout(() => {
        const a = { ...get().anim }
        for (const e of els) delete a[e.id]
        set({ anim: a })
      }, ms + 400)
    }
  },
  removeIds: (ids) => {
    if (ids.length === 0) return
    const kill = new Set(ids)
    const s = get()
    s.commit(s.elements.filter((e) => !kill.has(e.id)))
    set({ selection: s.selection.filter((id) => !kill.has(id)) })
  },
  undo: () =>
    set((s) => {
      if (s.past.length === 0) return {}
      const prev = s.past[s.past.length - 1]
      return { past: s.past.slice(0, -1), future: [s.elements, ...s.future], elements: prev, selection: [] }
    }),
  redo: () =>
    set((s) => {
      if (s.future.length === 0) return {}
      const [next, ...rest] = s.future
      return { past: [...s.past, s.elements], future: rest, elements: next, selection: [] }
    }),
  setTool: (tool) => set({ tool, selection: tool === 'select' ? get().selection : [] }),
  setStyle: (st) => set((s) => ({ style: { ...s.style, ...st } })),
  setSettings: (st) => set((s) => ({ settings: { ...s.settings, ...st } })),
  setCamera: (camera) => set({ camera }),
  setUI: (u) => set((s) => ({ ui: { ...s.ui, ...u } })),
  select: (selection) => set({ selection }),
  setEditing: (editing) => set({ editing }),
  setPad: (pad) => set({ pad }),
}))

let counter = 0
export const newId = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 7)}`
export const newSeed = () => Math.floor(Math.random() * 2 ** 31)

export const screenToWorld = (c: Camera, p: Vec): Vec => [(p[0] - c.x) / c.z, (p[1] - c.y) / c.z]
export const worldToScreen = (c: Camera, p: Vec): Vec => [p[0] * c.z + c.x, p[1] * c.z + c.y]

/** Zoom manteniendo fijo el punto `at` (en pantalla). */
export function zoomAt(c: Camera, at: Vec, nextZ: number): Camera {
  const z = Math.min(8, Math.max(0.1, nextZ))
  const w = screenToWorld(c, at)
  return { x: at[0] - w[0] * z, y: at[1] - w[1] * z, z }
}
