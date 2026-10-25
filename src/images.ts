/**
 * Imágenes pegadas (capturas, fotos). El contenido va aparte de los elementos, en IndexedDB:
 * así el autoguardado de los trazos sigue siendo liviano y no revienta el cupo de localStorage.
 */
import { create } from 'zustand'
import { commitEditing, pointerState, viewCenterWorld, viewportSize } from './actions'
import { toast } from './components/Toast'
import { newId, screenToWorld, useStore } from './store'
import type { El, ImageEl, Vec } from './types'

interface Files {
  /** id → data URL */
  files: Record<string, string>
  /** ya se leyó lo guardado; antes de eso, una imagen sin contenido solo está cargando */
  ready: boolean
}

export const useFiles = create<Files>()(() => ({ files: {}, ready: false }))

// ——— IndexedDB ———

const STORE = 'files'
let dbp: Promise<IDBDatabase> | null = null

function db() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('pizarra', 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

export function addFile(id: string, src: string) {
  useFiles.setState((s) => ({ files: { ...s.files, [id]: src } }))
  db()
    .then((d) => d.transaction(STORE, 'readwrite').objectStore(STORE).put(src, id))
    .catch(() => {
      // sin IndexedDB la imagen dura lo que dure la pestaña (o hasta guardar a archivo)
    })
}

/** Lee las imágenes guardadas y borra las que ya no usa ningún elemento. */
export async function loadFiles() {
  try {
    const d = await db()
    const used = new Set(usedFiles(useStore.getState().elements))
    const found: Record<string, string> = {}
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction(STORE, 'readwrite')
      const req = tx.objectStore(STORE).openCursor()
      req.onsuccess = () => {
        const c = req.result
        if (!c) return
        const id = String(c.key)
        if (used.has(id)) found[id] = c.value as string
        // Lo pegado mientras se leía ya está en memoria: no es basura.
        else if (!(id in useFiles.getState().files)) c.delete()
        c.continue()
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    useFiles.setState((s) => ({ files: { ...found, ...s.files } }))
  } catch {
    // almacenamiento bloqueado: las imágenes guardadas no se pueden recuperar
  }
  useFiles.setState({ ready: true })
}

export const usedFiles = (els: El[]) => els.flatMap((e) => (e.type === 'image' ? [e.file] : []))

export function loadImage(src: string) {
  const img = new Image()
  img.src = src
  return img.decode().then(() => img)
}

// ——— Insertar ———

/** Más grande que esto se reduce (y se recomprime), para no guardar fotos de 20 MB. */
const MAX_SIDE = 3840
const MAX_BYTES = 2 * 1024 * 1024

function readDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function encode(blob: Blob, img: HTMLImageElement) {
  const { naturalWidth: w, naturalHeight: h } = img
  if (blob.size <= MAX_BYTES && Math.max(w, h) <= MAX_SIDE) return readDataUrl(blob)
  const k = Math.min(1, MAX_SIDE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * k)
  canvas.height = Math.round(h * k)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/webp', 0.9)
}

export async function insertImage(blob: Blob) {
  const url = URL.createObjectURL(blob)
  let img: HTMLImageElement
  let src: string
  try {
    img = await loadImage(url)
    src = await encode(blob, img)
  } catch {
    return toast('No se pudo leer la imagen')
  } finally {
    URL.revokeObjectURL(url)
  }

  const s = useStore.getState()
  const z = s.camera.z
  const [vw, vh] = viewportSize()
  // Una captura se ve a su tamaño real en pantalla, pero sin pasar del 70% de la vista.
  const k = Math.min(1 / devicePixelRatio, (vw * 0.7) / img.naturalWidth, (vh * 0.7) / img.naturalHeight) / z
  const w = img.naturalWidth * k
  const h = img.naturalHeight * k
  // Donde está el puntero, pero con margen a los bordes: si no, la manilla de giro queda bajo la barra.
  const [x0, y0] = screenToWorld(s.camera, [vw * 0.15, vh * 0.15])
  const [x1, y1] = screenToWorld(s.camera, [vw * 0.85, vh * 0.85])
  const at: Vec = pointerState.overBoard && pointerState.world ? pointerState.world : viewCenterWorld()
  const cx = Math.min(Math.max(at[0], x0 + w / 2), x1 - w / 2)
  const cy = Math.min(Math.max(at[1], y0 + h / 2), y1 - h / 2)

  const file = newId()
  addFile(file, src)
  commitEditing()
  const el: ImageEl = { id: newId(), type: 'image', file, x: cx - w / 2, y: cy - h / 2, w, h, color: 'ink' }
  s.setTool('select')
  s.add([el], { select: true, animate: s.settings.animate ? 450 : undefined })
}

export function imageFromClipboard(data: DataTransfer | null): File | null {
  for (const item of data?.items ?? []) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile()
  }
  return null
}

/** Para pegar sin teclado (desde la paleta): lee el portapapeles directamente. */
export async function pasteImage() {
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((t) => t.startsWith('image/'))
      if (type) return await insertImage(await item.getType(type))
    }
    toast('No hay ninguna imagen copiada')
  } catch {
    toast('No se pudo leer el portapapeles')
  }
}
