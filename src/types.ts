export type Vec = [number, number]

/** Claves de color: cada tema las traduce a un hex distinto (así el dibujo se ve bien en fondo oscuro y claro). */
export type ColorKey =
  | 'ink'
  | 'gray'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'blue'
  | 'violet'
  | 'pink'

export type FillStyle = 'none' | 'soft' | 'hachure'

export type FontKey = 'marker' | 'notebook' | 'chalk' | 'casual' | 'clean'

/** 0 = limpio, 1 = a mano, 2 = boceto */
export type Roughness = 0 | 1 | 2

interface Base {
  id: string
  color: ColorKey
}

export interface StrokeEl extends Base {
  type: 'stroke'
  /** [x, y, presión] en coordenadas del mundo */
  points: number[][]
  width: number
  highlighter?: boolean
  /** true si viene de un lápiz con presión real; si no, la presión se simula por velocidad */
  pressure?: boolean
}

export interface BoxEl extends Base {
  type: 'rect' | 'ellipse' | 'diamond'
  cx: number
  cy: number
  w: number
  h: number
  /** radianes */
  angle: number
  width: number
  fill: FillStyle
  rough: Roughness
  seed: number
}

export interface LineEl extends Base {
  type: 'line'
  points: Vec[]
  arrowStart?: boolean
  arrowEnd?: boolean
  width: number
  rough: Roughness
  seed: number
}

export interface PolyEl extends Base {
  type: 'poly'
  points: Vec[]
  width: number
  fill: FillStyle
  rough: Roughness
  seed: number
}

export interface TextEl extends Base {
  type: 'text'
  x: number
  y: number
  text: string
  fontSize: number
  font: FontKey
  w: number
  h: number
  /** radianes, alrededor del centro */
  angle?: number
}

export interface StampEl extends Base {
  type: 'stamp'
  stamp: string
  x: number
  y: number
  w: number
  h: number
  width: number
  rough: Roughness
  seed: number
  /** radianes, alrededor del centro */
  angle?: number
}

/** Imagen pegada (captura, foto). El contenido se guarda aparte, ver images.ts. */
export interface ImageEl extends Base {
  type: 'image'
  /** id del contenido en el almacén de imágenes */
  file: string
  x: number
  y: number
  w: number
  h: number
  /** radianes, alrededor del centro */
  angle?: number
}

export type El = StrokeEl | BoxEl | LineEl | PolyEl | TextEl | StampEl | ImageEl

export type Tool =
  | 'select'
  | 'hand'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'diamond'
  | 'arrow'
  | 'line'
  | 'laser'

export interface Camera {
  x: number
  y: number
  z: number
}

export interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Caja que puede estar girada (marco de selección). */
export interface Frame {
  cx: number
  cy: number
  w: number
  h: number
  /** radianes */
  angle: number
}

/** Resultado del reconocedor de formas (antes de convertirse en elemento). */
export type RecognizedShape =
  | { kind: 'line'; points: Vec[]; arrowEnd?: boolean }
  | { kind: 'rect' | 'ellipse' | 'diamond'; cx: number; cy: number; w: number; h: number; angle: number }
  | { kind: 'poly'; points: Vec[] }
