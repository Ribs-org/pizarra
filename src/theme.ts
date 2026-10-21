import type { ColorKey, FontKey } from './types'

export type ThemeKey = 'graphite' | 'midnight' | 'chalkboard' | 'white' | 'paper'
export type Pattern = 'none' | 'dots' | 'grid' | 'lines'

type Palette = Record<ColorKey, string>

/** Colores pensados para video: saturados pero suaves, con buen contraste en su fondo. */
const DARK: Palette = {
  ink: '#ECEAE4',
  gray: '#8F8F99',
  red: '#FF6B6B',
  orange: '#FFA94D',
  yellow: '#FFD43B',
  green: '#69DB7C',
  teal: '#3BC9DB',
  blue: '#5CB4FF',
  violet: '#A98BFF',
  pink: '#F783AC',
}

const LIGHT: Palette = {
  ink: '#1E1E24',
  gray: '#868E96',
  red: '#E03131',
  orange: '#E8590C',
  yellow: '#F59F00',
  green: '#2F9E44',
  teal: '#0C8599',
  blue: '#1971C2',
  violet: '#6741D9',
  pink: '#C2255C',
}

export interface Theme {
  key: ThemeKey
  name: string
  bg: string
  /** color del patrón de puntos/cuadrícula */
  pattern: string
  ui: 'dark' | 'light'
  palette: Palette
}

export const THEMES: Record<ThemeKey, Theme> = {
  graphite: { key: 'graphite', name: 'Grafito', bg: '#141417', pattern: 'rgba(255,255,255,0.07)', ui: 'dark', palette: DARK },
  midnight: { key: 'midnight', name: 'Noche', bg: '#0D1526', pattern: 'rgba(148,180,255,0.09)', ui: 'dark', palette: DARK },
  chalkboard: {
    key: 'chalkboard',
    name: 'Pizarrón',
    bg: '#1F3A30',
    pattern: 'rgba(255,255,255,0.06)',
    ui: 'dark',
    palette: { ...DARK, ink: '#F1EFE6' },
  },
  white: { key: 'white', name: 'Blanco', bg: '#FCFCFA', pattern: 'rgba(0,0,0,0.09)', ui: 'light', palette: LIGHT },
  paper: {
    key: 'paper',
    name: 'Papel',
    bg: '#F5EFE1',
    pattern: 'rgba(120,90,40,0.13)',
    ui: 'light',
    palette: { ...LIGHT, ink: '#2B2833' },
  },
}

export const COLOR_ORDER: ColorKey[] = ['ink', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'pink', 'gray']

export const COLOR_NAMES: Record<ColorKey, string> = {
  ink: 'Tinta',
  gray: 'Gris',
  red: 'Rojo',
  orange: 'Naranjo',
  yellow: 'Amarillo',
  green: 'Verde',
  teal: 'Turquesa',
  blue: 'Azul',
  violet: 'Violeta',
  pink: 'Rosado',
}

export interface FontDef {
  name: string
  family: string
  weight: number
  /** Normaliza el tamaño aparente entre fuentes (Caveat se ve más chica, por ejemplo). */
  scale: number
}

export const FONTS: Record<FontKey, FontDef> = {
  marker: { name: 'Marcador', family: 'Shantell Sans', weight: 500, scale: 1 },
  notebook: { name: 'Cuaderno', family: 'Caveat', weight: 600, scale: 1.3 },
  chalk: { name: 'Imprenta', family: 'Patrick Hand', weight: 400, scale: 1.12 },
  casual: { name: 'Plumón', family: 'Kalam', weight: 400, scale: 1.05 },
  clean: { name: 'Limpia', family: 'Inter Variable', weight: 500, scale: 0.95 },
}

export const FONT_ORDER: FontKey[] = ['marker', 'notebook', 'chalk', 'casual', 'clean']

export const fontCss = (f: FontDef) => `"${f.family}", "Segoe Print", cursive`

export const LINE_HEIGHT = 1.25

export interface SizePreset {
  label: string
  pen: number
  highlighter: number
  shape: number
  text: number
}

export const SIZES: SizePreset[] = [
  { label: 'S', pen: 3, highlighter: 14, shape: 1.5, text: 20 },
  { label: 'M', pen: 5, highlighter: 22, shape: 2.5, text: 28 },
  { label: 'L', pen: 8, highlighter: 32, shape: 4, text: 42 },
  { label: 'XL', pen: 13, highlighter: 46, shape: 6, text: 64 },
]

export function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
