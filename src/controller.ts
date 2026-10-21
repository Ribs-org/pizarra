/**
 * Entrada de la pizarra: dedo, lápiz, mouse y rueda.
 *
 * Gestos táctiles:
 *  - 1 dedo: usa la herramienta activa
 *  - 2 dedos: mover y hacer zoom (pellizco)
 *  - toque con 2 dedos: deshacer · toque con 3 dedos: rehacer
 */
import { commitEditing, pointerState, selectionBox, startText } from './actions'
import { boxContains, dist, elementBox, hitDistance, scaleEl, translateEl } from './geometry'
import { InkSession } from './ink'
import { useLive } from './live'
import { snapAngle } from './recognize'
import { newId, newSeed, screenToWorld, useStore, zoomAt } from './store'
import { SIZES } from './theme'
import type { Box, Camera, El, TextEl, Tool, Vec } from './types'

type ShapeTool = Extract<Tool, 'rect' | 'ellipse' | 'diamond' | 'line' | 'arrow'>

type Gesture =
  | { k: 'none' }
  | { k: 'ink'; id: number; session: InkSession }
  | { k: 'shape'; id: number; tool: ShapeTool; start: Vec; seed: number; elId: string }
  | { k: 'pan'; id: number; last: Vec }
  | { k: 'pinch'; a: number; b: number; startDist: number; startMid: Vec; startCam: Camera }
  | { k: 'move'; id: number; start: Vec; before: El[]; ids: Set<string>; moved: boolean; tapId?: string }
  | { k: 'scale'; id: number; anchor: Vec; startDist: number; before: El[]; ids: Set<string> }
  | { k: 'marquee'; id: number; start: Vec; base: string[] }
  | { k: 'erase'; id: number; last: Vec; hits: Set<string> }
  | { k: 'laser'; id: number }

const SHAPE_TOOLS = new Set<Tool>(['rect', 'ellipse', 'diamond', 'line', 'arrow'])
const TAP_SLOP = 10

interface TapGroup {
  start: number
  max: number
  moved: boolean
  downs: Map<number, Vec>
}

export class BoardController {
  private g: Gesture = { k: 'none' }
  private touches = new Map<number, Vec>()
  private tapGroup: TapGroup | null = null
  /** tras un pellizco, ignorar dedos hasta que se levanten todos */
  private suppressTouch = false
  private lastTap: { t: number; p: Vec } | null = null
  private downAt: { p: Vec; t: number } | null = null
  spaceDown = false
  private readonly el: SVGSVGElement

  constructor(el: SVGSVGElement) {
    this.el = el
  }

  // ——— utilidades ———

  private screen(e: PointerEvent | WheelEvent): Vec {
    const r = this.el.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  private world(p: Vec): Vec {
    return screenToWorld(useStore.getState().camera, p)
  }

  private get z() {
    return useStore.getState().camera.z
  }

  // ——— eventos ———

  onPointerDown = (e: PointerEvent) => {
    const p = this.screen(e)
    const s = useStore.getState()

    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, p)
      this.trackTapDown(e.pointerId, p)
      if (this.touches.size >= 2) {
        if (this.g.k !== 'pinch') {
          this.cancelGesture()
          this.startPinch()
        }
        return
      }
      if (this.suppressTouch) return
    }

    if (e.button === 2) return
    e.preventDefault()
    this.el.setPointerCapture(e.pointerId)
    this.downAt = { p, t: performance.now() }

    // Si se estaba escribiendo, el toque afuera confirma el texto (y no dibuja nada).
    if (s.editing) {
      commitEditing()
      if (s.tool !== 'text') return
    }
    useStore.getState().setUI({ menu: false })

    const isEraserButton = e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32) !== 0)
    const tool: Tool = isEraserButton ? 'eraser' : e.button === 1 || this.spaceDown ? 'hand' : s.tool
    const w = this.world(p)

    switch (tool) {
      case 'hand':
        this.g = { k: 'pan', id: e.pointerId, last: p }
        break
      case 'pen':
      case 'highlighter': {
        s.select([])
        const preset = SIZES[s.style.size]
        const session = new InkSession((q) => this.world(q), {
          highlighter: tool === 'highlighter',
          color: s.style.color,
          width: tool === 'highlighter' ? preset.highlighter : preset.pen,
          shapeWidth: preset.shape,
          smoothing: e.pointerType === 'mouse' ? s.settings.smoothing * 0.5 : s.settings.smoothing,
          quickShape: s.settings.quickShape,
          rough: s.style.rough,
          fill: s.style.fill,
          worldPerPx: 1 / this.z,
        })
        session.add(p, e.pressure, e.pointerType === 'pen')
        this.g = { k: 'ink', id: e.pointerId, session }
        break
      }
      case 'eraser':
        this.g = { k: 'erase', id: e.pointerId, last: w, hits: new Set() }
        this.eraseAlong(w, w)
        break
      case 'laser':
        this.g = { k: 'laser', id: e.pointerId }
        useLive.getState().set({ laser: [...useLive.getState().laser, [[w[0], w[1], performance.now()]]] })
        break
      case 'text': {
        const hit = this.hitTest(w)
        startText(w, hit?.type === 'text' ? hit : undefined)
        break
      }
      case 'select':
        this.selectDown(e, w)
        break
      default:
        if (SHAPE_TOOLS.has(tool)) {
          s.select([])
          this.g = { k: 'shape', id: e.pointerId, tool: tool as ShapeTool, start: w, seed: newSeed(), elId: newId() }
        }
    }
  }

  onPointerMove = (e: PointerEvent) => {
    const p = this.screen(e)
    pointerState.world = this.world(p)
    pointerState.overBoard = e.target instanceof Node && this.el.contains(e.target)

    if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
      this.touches.set(e.pointerId, p)
      this.trackTapMove(e.pointerId, p)
    }

    const g = this.g
    if (g.k === 'pinch') return this.updatePinch()
    if (!('id' in g) || g.id !== e.pointerId) return

    switch (g.k) {
      case 'ink': {
        const evs = e.getCoalescedEvents?.() ?? []
        if (evs.length > 1) for (const ce of evs) g.session.add(this.screen(ce), ce.pressure, ce.pointerType === 'pen')
        else g.session.add(p, e.pressure, e.pointerType === 'pen')
        break
      }
      case 'pan': {
        const c = useStore.getState().camera
        useStore.getState().setCamera({ ...c, x: c.x + p[0] - g.last[0], y: c.y + p[1] - g.last[1] })
        g.last = p
        break
      }
      case 'shape':
        useLive.getState().set({ preview: this.shapePreview(g, this.world(p), e.shiftKey) })
        break
      case 'move': {
        const w = this.world(p)
        const dx = w[0] - g.start[0]
        const dy = w[1] - g.start[1]
        if (!g.moved && Math.hypot(dx, dy) * this.z < 3) return
        g.moved = true
        useStore.getState().setElements(g.before.map((el) => (g.ids.has(el.id) ? translateEl(el, dx, dy) : el)))
        break
      }
      case 'scale': {
        const w = this.world(p)
        const s = Math.min(20, Math.max(0.05, dist(g.anchor, w) / g.startDist))
        useStore.getState().setElements(g.before.map((el) => (g.ids.has(el.id) ? scaleEl(el, s, g.anchor) : el)))
        break
      }
      case 'marquee': {
        const w = this.world(p)
        const box: Box = {
          minX: Math.min(g.start[0], w[0]),
          minY: Math.min(g.start[1], w[1]),
          maxX: Math.max(g.start[0], w[0]),
          maxY: Math.max(g.start[1], w[1]),
        }
        useLive.getState().set({ marquee: box })
        const inside = useStore
          .getState()
          .elements.filter((el) => boxContains(box, elementBox(el)))
          .map((el) => el.id)
        useStore.getState().select([...new Set([...g.base, ...inside])])
        break
      }
      case 'erase': {
        const w = this.world(p)
        this.eraseAlong(g.last, w)
        g.last = w
        break
      }
      case 'laser': {
        const w = this.world(p)
        const trails = useLive.getState().laser
        if (trails.length === 0) break
        const cur = trails[trails.length - 1]
        useLive.getState().set({ laser: [...trails.slice(0, -1), [...cur, [w[0], w[1], performance.now()]]] })
        break
      }
    }
  }

  onPointerUp = (e: PointerEvent) => {
    const p = this.screen(e)
    if (e.pointerType === 'touch') {
      this.touches.delete(e.pointerId)
      this.trackTapUp()
      if (this.g.k === 'pinch') {
        if (this.touches.size < 2) {
          this.g = { k: 'none' }
          this.suppressTouch = this.touches.size > 0
        }
        return
      }
      if (this.touches.size === 0) this.suppressTouch = false
    }

    const g = this.g
    if (!('id' in g) || g.id !== e.pointerId) return
    this.g = { k: 'none' }
    const s = useStore.getState()
    const isTap = this.downAt ? dist(this.downAt.p, p) < TAP_SLOP && performance.now() - this.downAt.t < 350 : false

    switch (g.k) {
      case 'ink': {
        const el = g.session.finish()
        useLive.getState().set({ stroke: null, preview: null })
        if (el) s.add([el], { animate: g.session.snapped && s.settings.animate ? 260 : undefined })
        break
      }
      case 'shape': {
        const preview = useLive.getState().preview
        useLive.getState().set({ preview: null })
        if (preview && !isTap) s.add([preview])
        break
      }
      case 'move':
        if (g.moved) s.pushHistory(g.before)
        else if (isTap) this.handleTap(p, g.tapId)
        break
      case 'scale':
        s.pushHistory(g.before)
        break
      case 'marquee':
        useLive.getState().set({ marquee: null })
        if (isTap) this.handleTap(p)
        break
      case 'erase':
        useLive.getState().set({ erasing: [] })
        s.removeIds([...g.hits])
        break
    }
  }

  onPointerCancel = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      this.touches.delete(e.pointerId)
      this.tapGroup = null
    }
    const g = this.g
    if (g.k === 'ink' && g.id === e.pointerId) {
      // Windows a veces cancela el toque; mejor guardar lo dibujado que perderlo.
      return this.onPointerUp(e)
    }
    if ('id' in g && g.id === e.pointerId) this.cancelGesture()
    if (g.k === 'pinch' && this.touches.size < 2) this.g = { k: 'none' }
  }

  onPointerLeave = () => {
    pointerState.overBoard = false
  }

  onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const s = useStore.getState()
    const c = s.camera
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
    if (e.ctrlKey || e.metaKey) {
      s.setCamera(zoomAt(c, this.screen(e), c.z * Math.exp(-e.deltaY * k * 0.01)))
    } else {
      const dx = (e.shiftKey ? e.deltaY : e.deltaX) * k
      const dy = (e.shiftKey ? 0 : e.deltaY) * k
      s.setCamera({ ...c, x: c.x - dx, y: c.y - dy })
    }
  }

  // ——— gestos ———

  private cancelGesture() {
    const g = this.g
    const live = useLive.getState()
    if (g.k === 'ink') {
      g.session.cancel()
      live.set({ stroke: null, preview: null })
    } else if (g.k === 'shape') live.set({ preview: null })
    else if (g.k === 'move' || g.k === 'scale') useStore.getState().setElements(g.before)
    else if (g.k === 'marquee') live.set({ marquee: null })
    else if (g.k === 'erase') live.set({ erasing: [] })
    this.g = { k: 'none' }
  }

  private startPinch() {
    const [a, b] = [...this.touches.keys()]
    const pa = this.touches.get(a)!
    const pb = this.touches.get(b)!
    this.g = {
      k: 'pinch',
      a,
      b,
      startDist: Math.max(1, dist(pa, pb)),
      startMid: [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2],
      startCam: useStore.getState().camera,
    }
  }

  private updatePinch() {
    const g = this.g
    if (g.k !== 'pinch') return
    const pa = this.touches.get(g.a)
    const pb = this.touches.get(g.b)
    if (!pa || !pb) return
    const mid: Vec = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2]
    const z = Math.min(8, Math.max(0.1, (g.startCam.z * dist(pa, pb)) / g.startDist))
    // El punto del mundo que estaba bajo el centro del pellizco sigue bajo los dedos.
    const anchor = screenToWorld(g.startCam, g.startMid)
    useStore.getState().setCamera({ x: mid[0] - anchor[0] * z, y: mid[1] - anchor[1] * z, z })
  }

  // ——— toques con varios dedos (deshacer / rehacer) ———

  private trackTapDown(id: number, p: Vec) {
    if (!this.tapGroup || this.touches.size === 1) this.tapGroup = { start: performance.now(), max: 0, moved: false, downs: new Map() }
    this.tapGroup.downs.set(id, p)
    this.tapGroup.max = Math.max(this.tapGroup.max, this.touches.size)
  }

  private trackTapMove(id: number, p: Vec) {
    const t = this.tapGroup
    const d = t?.downs.get(id)
    if (t && d && dist(d, p) > TAP_SLOP * 1.5) t.moved = true
  }

  private trackTapUp() {
    const t = this.tapGroup
    if (!t || this.touches.size > 0) return
    this.tapGroup = null
    if (t.moved || performance.now() - t.start > 400) return
    if (t.max === 2) useStore.getState().undo()
    else if (t.max === 3) useStore.getState().redo()
  }

  // ——— selección ———

  private hitTest(w: Vec): El | null {
    const els = useStore.getState().elements
    const tol = 10 / this.z
    for (let i = els.length - 1; i >= 0; i--) {
      if (hitDistance(els[i], w) <= tol) return els[i]
    }
    return null
  }

  private selectDown(e: PointerEvent, w: Vec) {
    const s = useStore.getState()
    const box = s.selection.length ? selectionBox() : null

    // ¿Tomó una esquina para escalar?
    if (box) {
      const corners: Vec[] = [
        [box.minX, box.minY],
        [box.maxX, box.minY],
        [box.maxX, box.maxY],
        [box.minX, box.maxY],
      ]
      const hitRadius = e.pointerType === 'touch' ? 22 : 12
      const ci = corners.findIndex((c) => dist(c, w) * this.z < hitRadius)
      if (ci !== -1) {
        const anchor = corners[(ci + 2) % 4]
        this.g = {
          k: 'scale',
          id: e.pointerId,
          anchor,
          startDist: Math.max(1e-3, dist(anchor, w)),
          before: s.elements,
          ids: new Set(s.selection),
        }
        return
      }
    }

    const hit = this.hitTest(w)
    if (hit) {
      let sel = s.selection
      if (e.shiftKey) sel = sel.includes(hit.id) ? sel.filter((id) => id !== hit.id) : [...sel, hit.id]
      else if (!sel.includes(hit.id)) sel = [hit.id]
      s.select(sel)
      this.g = { k: 'move', id: e.pointerId, start: w, before: s.elements, ids: new Set(sel), moved: false, tapId: hit.id }
      return
    }
    if (box && w[0] >= box.minX && w[0] <= box.maxX && w[1] >= box.minY && w[1] <= box.maxY) {
      this.g = { k: 'move', id: e.pointerId, start: w, before: s.elements, ids: new Set(s.selection), moved: false }
      return
    }
    const base = e.shiftKey ? s.selection : []
    s.select(base)
    this.g = { k: 'marquee', id: e.pointerId, start: w, base }
  }

  /** Doble toque: sobre un texto lo edita; en el vacío crea un texto nuevo. */
  private handleTap(p: Vec, hitId?: string) {
    const now = performance.now()
    const last = this.lastTap
    this.lastTap = { t: now, p }
    if (!last || now - last.t > 380 || dist(last.p, p) > 24) return
    this.lastTap = null
    const s = useStore.getState()
    const hit = hitId ? s.elements.find((el) => el.id === hitId) : undefined
    if (hit?.type === 'text') startText(this.world(p), hit as TextEl)
    else if (!hit) startText(this.world(p))
  }

  // ——— borrador ———

  private eraseAlong(a: Vec, b: Vec) {
    const g = this.g
    if (g.k !== 'erase') return
    const r = 12 / this.z
    const steps = Math.max(1, Math.ceil(dist(a, b) / (r / 2)))
    const els = useStore.getState().elements
    let changed = false
    for (let i = 0; i <= steps; i++) {
      const q: Vec = [a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps]
      for (const el of els) {
        if (g.hits.has(el.id)) continue
        const bb = elementBox(el)
        if (q[0] < bb.minX - r || q[0] > bb.maxX + r || q[1] < bb.minY - r || q[1] > bb.maxY + r) continue
        if (hitDistance(el, q) <= r) {
          g.hits.add(el.id)
          changed = true
        }
      }
    }
    if (changed) useLive.getState().set({ erasing: [...g.hits] })
  }

  // ——— herramientas de forma ———

  private shapePreview(g: Extract<Gesture, { k: 'shape' }>, w: Vec, constrain: boolean): El | null {
    const s = useStore.getState()
    const a = g.start
    let b = w
    if (dist(a, b) * this.z < 3) return null
    const base = { id: g.elId, color: s.style.color, width: SIZES[s.style.size].shape, rough: s.style.rough, seed: g.seed }
    if (g.tool === 'line' || g.tool === 'arrow') {
      b = constrain ? snapAngle(a, b, 22.5) : snapAngle(a, b, 3)
      return { ...base, type: 'line', points: [a, b], arrowEnd: g.tool === 'arrow' || undefined }
    }
    let dx = b[0] - a[0]
    let dy = b[1] - a[1]
    if (constrain) {
      const m = Math.max(Math.abs(dx), Math.abs(dy))
      dx = Math.sign(dx || 1) * m
      dy = Math.sign(dy || 1) * m
    }
    return {
      ...base,
      type: g.tool,
      cx: a[0] + dx / 2,
      cy: a[1] + dy / 2,
      w: Math.abs(dx),
      h: Math.abs(dy),
      angle: 0,
      fill: s.style.fill,
    }
  }
}
