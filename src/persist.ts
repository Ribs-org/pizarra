import { DEFAULT_SETTINGS, DEFAULT_STYLE, useStore } from './store'
import { measureText } from './text'
import type { El } from './types'

const KEY = 'pizarra:v1'

export function loadSaved() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return
    const d = JSON.parse(raw)
    useStore.setState({
      elements: Array.isArray(d.elements) ? (d.elements as El[]) : [],
      style: { ...DEFAULT_STYLE, ...d.style },
      settings: { ...DEFAULT_SETTINGS, ...d.settings },
      camera: d.camera && typeof d.camera.z === 'number' ? d.camera : { x: 0, y: 0, z: 1 },
    })
  } catch {
    // almacenamiento bloqueado o dañado: se parte con la pizarra vacía
  }
}

function save() {
  const s = useStore.getState()
  try {
    localStorage.setItem(KEY, JSON.stringify({ elements: s.elements, style: s.style, settings: s.settings, camera: s.camera }))
  } catch {
    // sin espacio o sin permiso: no es grave, se puede guardar a archivo
  }
}

export function startAutosave() {
  let t = 0
  useStore.subscribe((s, prev) => {
    if (s.elements === prev.elements && s.style === prev.style && s.settings === prev.settings && s.camera === prev.camera) return
    clearTimeout(t)
    t = window.setTimeout(save, 400)
  })
  window.addEventListener('beforeunload', save)
}

/** Tras cargar las fuentes, re-mide los textos (las medidas previas usaban la fuente de respaldo). */
export function remeasureTexts() {
  const s = useStore.getState()
  if (!s.elements.some((e) => e.type === 'text')) return
  s.setElements(s.elements.map((e) => (e.type === 'text' ? { ...e, ...measureText(e.text, e.font, e.fontSize) } : e)))
}
