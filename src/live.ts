import { create } from 'zustand'
import type { Box, El, StrokeEl } from './types'

/** Estado efímero de lo que se está dibujando (separado para no re-renderizar toda la pizarra). */
interface Live {
  stroke: StrokeEl | null
  /** forma en construcción (herramientas de forma) o trazo ya "arreglado" */
  preview: El | null
  /** se acaba de convertir el trazo en forma (para el destello) */
  snapped: number
  marquee: Box | null
  erasing: string[]
  /** estelas del puntero láser en coordenadas del mundo: [x, y, t] */
  laser: [number, number, number][][]
  set: (p: Partial<Omit<Live, 'set'>>) => void
}

export const useLive = create<Live>()((set) => ({
  stroke: null,
  preview: null,
  snapped: 0,
  marquee: null,
  erasing: [],
  laser: [],
  set: (p) => set(p),
}))
