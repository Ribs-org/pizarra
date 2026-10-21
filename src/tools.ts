import {
  Circle,
  Diamond,
  Eraser,
  Hand,
  Highlighter,
  Minus,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Square,
  Type,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import type { Tool } from './types'

export interface ToolDef {
  id: Tool
  name: string
  key: string
  icon: LucideIcon
}

export const TOOLS: ToolDef[] = [
  { id: 'select', name: 'Seleccionar', key: 'V', icon: MousePointer2 },
  { id: 'hand', name: 'Mover la vista', key: 'H', icon: Hand },
  { id: 'pen', name: 'Lápiz', key: 'P', icon: Pencil },
  { id: 'highlighter', name: 'Destacador', key: 'M', icon: Highlighter },
  { id: 'eraser', name: 'Borrador', key: 'E', icon: Eraser },
  { id: 'text', name: 'Texto', key: 'T', icon: Type },
  { id: 'rect', name: 'Rectángulo', key: 'R', icon: Square },
  { id: 'ellipse', name: 'Elipse', key: 'O', icon: Circle },
  { id: 'diamond', name: 'Rombo', key: 'D', icon: Diamond },
  { id: 'arrow', name: 'Flecha', key: 'A', icon: MoveUpRight },
  { id: 'line', name: 'Línea', key: 'L', icon: Minus },
  { id: 'laser', name: 'Puntero láser', key: 'K', icon: WandSparkles },
]

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.id, t]))

export const TOOL_GROUPS: Tool[][] = [
  ['select', 'hand'],
  ['pen', 'highlighter', 'eraser', 'text'],
  ['rect', 'ellipse', 'diamond', 'arrow', 'line'],
  ['laser'],
]
