import { FONTS, FONT_ORDER, LINE_HEIGHT, fontCss } from './theme'
import type { FontKey } from './types'

let ctx: CanvasRenderingContext2D | null = null
const getCtx = () => (ctx ??= document.createElement('canvas').getContext('2d')!)

/** Tamaño CSS real (cada fuente se normaliza con su `scale`). */
export const cssSize = (font: FontKey, fontSize: number) => fontSize * FONTS[font].scale
export const lineHeight = (font: FontKey, fontSize: number) => cssSize(font, fontSize) * LINE_HEIGHT

export function fontString(font: FontKey, fontSize: number) {
  const f = FONTS[font]
  return `${f.weight} ${cssSize(font, fontSize)}px ${fontCss(f)}`
}

const baselineCache = new Map<FontKey, number>()

/**
 * Distancia desde el borde superior de una línea hasta su línea base, igual a como la ubica CSS
 * (mitad del interlineado + ascenso de la fuente). Así el SVG calza exacto con el <textarea>.
 */
export function baselineOffset(font: FontKey, fontSize: number) {
  let ratio = baselineCache.get(font)
  if (ratio === undefined) {
    const c = getCtx()
    c.font = fontString(font, 100)
    const m = c.measureText('Hg')
    const a = m.fontBoundingBoxAscent ?? 80
    const d = m.fontBoundingBoxDescent ?? 20
    const size = cssSize(font, 100)
    const lh = size * LINE_HEIGHT
    ratio = ((lh - (a + d)) / 2 + a) / 100
    baselineCache.set(font, ratio)
  }
  return ratio * fontSize
}

export function measureText(text: string, font: FontKey, fontSize: number) {
  const c = getCtx()
  c.font = fontString(font, fontSize)
  const lines = text.split('\n')
  let w = 0
  for (const line of lines) w = Math.max(w, c.measureText(line).width)
  return { w: Math.max(w, fontSize * 0.3), h: lines.length * lineHeight(font, fontSize) }
}

/** Carga todas las fuentes manuscritas antes de medir (si no, las medidas salen con la fuente de respaldo). */
export async function loadFonts() {
  await Promise.all(FONT_ORDER.map((k) => document.fonts.load(fontString(k, 32), 'Hola áéíóúñ')))
  baselineCache.clear()
}
