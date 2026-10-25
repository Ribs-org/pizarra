import { elementBox, unionBox } from './geometry'
import { addFile, loadImage, useFiles, usedFiles } from './images'
import { drawElement } from './render'
import { useStore } from './store'
import { THEMES } from './theme'
import type { El } from './types'

type Rot = [number, number, number] | undefined

function rotateCtx(ctx: CanvasRenderingContext2D, rot: Rot) {
  if (!rot) return
  ctx.translate(rot[1], rot[2])
  ctx.rotate((rot[0] * Math.PI) / 180)
  ctx.translate(-rot[1], -rot[2])
}

/** Dibuja elementos en un canvas (mismas primitivas que la pizarra). */
export async function renderToCanvas(elements: El[], opts: { scale?: number; background?: boolean; padding?: number } = {}) {
  const { scale = 2, background = true, padding = 32 } = opts
  const theme = THEMES[useStore.getState().settings.theme]
  const box = unionBox(elements.map(elementBox))
  if (!box) return null
  // Las imágenes tienen que estar decodificadas antes de dibujar (el resto es sincrónico).
  const files = useFiles.getState().files
  const images = new Map<string, HTMLImageElement>()
  await Promise.all(
    usedFiles(elements).map(async (id) => {
      if (files[id]) images.set(id, await loadImage(files[id]).catch(() => new Image()))
    }),
  )
  const w = Math.ceil((box.maxX - box.minX + padding * 2) * scale)
  const h = Math.ceil((box.maxY - box.minY + padding * 2) * scale)
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(w, 16000)
  canvas.height = Math.min(h, 16000)
  const ctx = canvas.getContext('2d')!
  if (background) {
    ctx.fillStyle = theme.bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.scale(scale, scale)
  ctx.translate(padding - box.minX, padding - box.minY)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const el of elements) {
    const drawn = drawElement(el, theme)
    for (const im of drawn.images ?? []) {
      const img = images.get(im.file)
      if (!img?.naturalWidth) continue
      ctx.save()
      rotateCtx(ctx, im.rot)
      ctx.drawImage(img, im.x, im.y, im.w, im.h)
      ctx.restore()
    }
    for (const p of drawn.paths) {
      ctx.save()
      rotateCtx(ctx, p.rot)
      ctx.globalAlpha = p.opacity ?? 1
      const path = new Path2D(p.d)
      if (p.fill && p.fill !== 'none') {
        ctx.fillStyle = p.fill
        ctx.fill(path)
      }
      if (p.stroke && p.stroke !== 'none') {
        ctx.strokeStyle = p.stroke
        ctx.lineWidth = p.sw ?? 1
        ctx.stroke(path)
      }
      ctx.restore()
    }
    for (const t of drawn.texts) {
      ctx.save()
      rotateCtx(ctx, t.rot)
      ctx.fillStyle = t.fill
      ctx.font = `${t.weight} ${t.size}px "${t.family}", cursive`
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(t.text, t.x, t.y)
      ctx.restore()
    }
  }
  return canvas
}

function targetElements() {
  const s = useStore.getState()
  const ids = new Set(s.selection)
  return ids.size ? s.elements.filter((e) => ids.has(e.id)) : s.elements
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function exportPng(background = true) {
  const canvas = await renderToCanvas(targetElements(), { background })
  if (!canvas) return false
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) return false
  download(blob, `pizarra-${stamp()}.png`)
  return true
}

export async function copyPng(background = true) {
  const canvas = await renderToCanvas(targetElements(), { background })
  if (!canvas) return false
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) return false
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}

export function saveFile() {
  const s = useStore.getState()
  // El archivo lleva adentro las imágenes que usa, para abrirlo en otro computador.
  const all = useFiles.getState().files
  const files = Object.fromEntries(usedFiles(s.elements).flatMap((id) => (all[id] ? [[id, all[id]]] : [])))
  const data = JSON.stringify({ app: 'pizarra', version: 1, elements: s.elements, files }, null, 0)
  download(new Blob([data], { type: 'application/json' }), `pizarra-${stamp()}.pizarra.json`)
}

export function openFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!Array.isArray(data.elements)) throw new Error('formato')
      for (const [id, src] of Object.entries(data.files ?? {})) if (typeof src === 'string') addFile(id, src)
      const s = useStore.getState()
      s.commit(data.elements as El[])
      s.select([])
    } catch {
      alert('No se pudo abrir el archivo: no parece una pizarra válida.')
    }
  }
  input.click()
}
