/** Acciones compartidas por la pizarra, los atajos de teclado, la paleta de comandos y la UI. */
import { elementBox, frameOf, translateEl, unionBox } from './geometry'
import { STAMP_MAP } from './stamps'
import { newId, newSeed, screenToWorld, useStore, zoomAt } from './store'
import { lineHeight, measureText } from './text'
import { SIZES } from './theme'
import type { El, Frame, TextEl, Vec } from './types'

/** Última posición del puntero sobre la pizarra (mundo). La actualiza el controlador. */
export const pointerState: { world: Vec | null; overBoard: boolean } = { world: null, overBoard: false }

export function viewportSize(): Vec {
  return [window.innerWidth, window.innerHeight]
}

export function viewCenterWorld(): Vec {
  const [w, h] = viewportSize()
  return screenToWorld(useStore.getState().camera, [w / 2, h / 2])
}

// ——— Texto ———

export function startText(at: Vec, existing?: TextEl) {
  const s = useStore.getState()
  commitEditing()
  if (existing) {
    s.setEditing({
      id: existing.id,
      x: existing.x,
      y: existing.y,
      text: existing.text,
      fontSize: existing.fontSize,
      font: existing.font,
      color: existing.color,
      angle: existing.angle,
    })
    s.select([])
    return
  }
  const fontSize = SIZES[s.style.size].text
  s.setEditing({
    x: at[0],
    y: at[1] - lineHeight(s.style.font, fontSize) / 2,
    text: '',
    fontSize,
    font: s.style.font,
    color: s.style.color,
  })
}

export function commitEditing() {
  const s = useStore.getState()
  const ed = s.editing
  if (!ed) return
  s.setEditing(null)
  const text = ed.text.replace(/\s+$/, '')
  if (ed.id) {
    const prev = s.elements.find((e) => e.id === ed.id)
    if (!prev || prev.type !== 'text') return
    if (!text) return s.removeIds([ed.id])
    if (text === prev.text && ed.font === prev.font && ed.color === prev.color && ed.fontSize === prev.fontSize) return
    const { w, h } = measureText(text, ed.font, ed.fontSize)
    s.commit(s.elements.map((e) => (e.id === ed.id ? { ...prev, text, w, h, font: ed.font, color: ed.color, fontSize: ed.fontSize } : e)))
  } else if (text) {
    const { w, h } = measureText(text, ed.font, ed.fontSize)
    s.add([{ id: newId(), type: 'text', x: ed.x, y: ed.y, text, fontSize: ed.fontSize, font: ed.font, color: ed.color, w, h }])
  }
}

/**
 * "Escribir rápido" (Enter): abre un texto donde está el puntero; si no, debajo del último
 * texto (para ir anotando líneas seguidas); si no, al centro de la vista.
 */
export function quickText() {
  const s = useStore.getState()
  if (pointerState.overBoard && pointerState.world) return startText(pointerState.world)
  const lastText = [...s.elements].reverse().find((e): e is TextEl => e.type === 'text')
  if (lastText) {
    const [w, h] = viewportSize()
    const sc = [lastText.x * s.camera.z + s.camera.x, (lastText.y + lastText.h) * s.camera.z + s.camera.y]
    if (sc[0] > 0 && sc[0] < w && sc[1] > 0 && sc[1] < h - 60) {
      const lh = lineHeight(s.style.font, SIZES[s.style.size].text)
      return startText([lastText.x, lastText.y + lastText.h + lh * 0.35 + lh / 2])
    }
  }
  startText(viewCenterWorld())
}

// ——— Sellos ———

let cascade = 0

export function insertStamp(stampId: string, at?: Vec) {
  const def = STAMP_MAP.get(stampId)
  if (!def) return
  const s = useStore.getState()
  commitEditing()
  const heights = [70, 110, 160, 240]
  const h = heights[s.style.size] ?? 110
  const k = h / def.box[1]
  const w = def.box[0] * k
  let c = at
  if (!c) {
    const center = viewCenterWorld()
    const off = (cascade++ % 6) * 22
    c = [center[0] + off, center[1] + off]
  }
  const el: El = {
    id: newId(),
    type: 'stamp',
    stamp: stampId,
    x: c[0] - w / 2,
    y: c[1] - h / 2,
    w,
    h: def.box[1] * k,
    width: SIZES[s.style.size].shape,
    rough: s.style.rough,
    seed: newSeed(),
    color: s.style.color,
  }
  s.setTool('select')
  s.add([el], { select: true, animate: s.settings.animate ? 1100 : undefined })
}

// ——— Selección ———

export function selectionFrame(): Frame | null {
  const s = useStore.getState()
  const ids = new Set(s.selection)
  return frameOf(s.elements.filter((e) => ids.has(e.id)))
}

export function deleteSelection() {
  const s = useStore.getState()
  s.removeIds(s.selection)
}

export function duplicateSelection() {
  const s = useStore.getState()
  const ids = new Set(s.selection)
  if (ids.size === 0) return
  const copies = s.elements.filter((e) => ids.has(e.id)).map((e) => ({ ...translateEl(e, 24, 24), id: newId() }))
  s.add(copies, { select: true })
}

export function selectAll() {
  const s = useStore.getState()
  s.setTool('select')
  s.select(s.elements.map((e) => e.id))
}

export function reorderSelection(toFront: boolean) {
  const s = useStore.getState()
  const ids = new Set(s.selection)
  if (ids.size === 0) return
  const sel = s.elements.filter((e) => ids.has(e.id))
  const rest = s.elements.filter((e) => !ids.has(e.id))
  s.commit(toFront ? [...rest, ...sel] : [...sel, ...rest])
}

/** Cambia color/estilo: si hay selección, también se aplica a lo seleccionado. */
export function applyStyleToSelection(patch: Partial<Pick<El, 'color'>> & { size?: number; fill?: string; rough?: number; font?: string }) {
  const s = useStore.getState()
  const ids = new Set(s.selection)
  if (s.editing) {
    const ed = s.editing
    s.setEditing({
      ...ed,
      color: patch.color ?? ed.color,
      font: (patch.font as TextEl['font']) ?? ed.font,
      fontSize: patch.size !== undefined ? SIZES[patch.size].text : ed.fontSize,
    })
  }
  if (ids.size === 0) return
  const next = s.elements.map((e) => {
    if (!ids.has(e.id)) return e
    let n: El = { ...e }
    if (patch.color) n.color = patch.color
    if (patch.rough !== undefined && 'rough' in n) n = { ...n, rough: patch.rough as 0 | 1 | 2 }
    if (patch.fill && 'fill' in n) n = { ...n, fill: patch.fill as 'none' | 'soft' | 'hachure' }
    if (patch.size !== undefined) {
      const preset = SIZES[patch.size]
      if (n.type === 'stroke') n = { ...n, width: n.highlighter ? preset.highlighter : preset.pen }
      else if (n.type === 'text') {
        const { w, h } = measureText(n.text, n.font, preset.text)
        n = { ...n, fontSize: preset.text, w, h }
      } else if (n.type !== 'image') n = { ...n, width: preset.shape }
    }
    if (patch.font && n.type === 'text') {
      const font = patch.font as TextEl['font']
      const { w, h } = measureText(n.text, font, n.fontSize)
      n = { ...n, font, w, h }
    }
    return n
  })
  s.commit(next)
}

// ——— Cámara ———

export function zoomBy(factor: number) {
  const s = useStore.getState()
  const [w, h] = viewportSize()
  s.setCamera(zoomAt(s.camera, [w / 2, h / 2], s.camera.z * factor))
}

export function resetZoom() {
  const s = useStore.getState()
  const [w, h] = viewportSize()
  s.setCamera(zoomAt(s.camera, [w / 2, h / 2], 1))
}

export function zoomToFit() {
  const s = useStore.getState()
  const box = unionBox(s.elements.map(elementBox))
  if (!box) return s.setCamera({ x: 0, y: 0, z: 1 })
  const [w, h] = viewportSize()
  const pad = 80
  const z = Math.min(3, Math.max(0.1, Math.min((w - pad * 2) / (box.maxX - box.minX || 1), (h - pad * 2) / (box.maxY - box.minY || 1))))
  s.setCamera({ x: w / 2 - ((box.minX + box.maxX) / 2) * z, y: h / 2 - ((box.minY + box.maxY) / 2) * z, z })
}

export function clearBoard() {
  const s = useStore.getState()
  commitEditing()
  if (s.elements.length === 0) return
  s.commit([])
  s.select([])
}

export function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void document.documentElement.requestFullscreen?.().catch(() => {})
}
