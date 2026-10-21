import { useEffect } from 'react'
import {
  applyStyleToSelection,
  commitEditing,
  deleteSelection,
  duplicateSelection,
  quickText,
  resetZoom,
  selectAll,
  toggleFullscreen,
  zoomBy,
  zoomToFit,
} from './actions'
import { boardController } from './components/Board'
import { toast } from './components/Toast'
import { padNewLine, togglePad } from './components/ZoomPad'
import { copyPng, exportPng, openFile, saveFile } from './export'
import { useStore } from './store'
import { COLOR_ORDER, SIZES } from './theme'
import { TOOLS } from './tools'

const TOOL_KEYS = new Map(TOOLS.map((t) => [t.key.toLowerCase(), t.id]))

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

export function useKeyboard() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'Control' || e.key === 'Meta') && boardController) boardController.multiSelect = true
      if (isTyping(e)) return
      const s = useStore.getState()
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()

      if (e.key === ' ' && !e.repeat) {
        if (boardController) boardController.spaceDown = true
        e.preventDefault()
        return
      }

      if (mod) {
        const handled = (() => {
          if (k === 'z' && !e.shiftKey) return s.undo(), true
          if ((k === 'z' && e.shiftKey) || k === 'y') return s.redo(), true
          if (k === 'a') return selectAll(), true
          if (k === 'd') return duplicateSelection(), true
          if (k === 'k') return s.setUI({ palette: true }), true
          if (k === 's') return saveFile(), true
          if (k === 'o') return openFile(), true
          if (k === '0') return resetZoom(), true
          if (k === '=' || k === '+') return zoomBy(1.25), true
          if (k === '-') return zoomBy(1 / 1.25), true
          if (e.shiftKey && k === 'e') return void exportPng().then((ok) => toast(ok ? 'PNG exportado' : 'No hay nada que exportar')), true
          if (e.shiftKey && k === 'c') return void copyPng().then((ok) => toast(ok ? 'Imagen copiada' : 'No se pudo copiar')), true
          return false
        })()
        if (handled) e.preventDefault()
        return
      }
      if (e.altKey) return

      if (e.key === 'Escape') {
        if (s.ui.palette || s.ui.help || s.ui.menu) return s.setUI({ palette: false, help: false, menu: false })
        if (s.selection.length) return s.select([])
        if (s.ui.library) return s.setUI({ library: false })
        if (s.ui.pad) return s.setUI({ pad: false })
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey && s.ui.pad) return padNewLine()
        return quickText()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') return deleteSelection()
      if (e.key === '/' || e.key === '?') {
        e.preventDefault()
        return s.setUI(e.key === '?' ? { help: !s.ui.help } : { palette: true })
      }
      if (e.key === '!' || (e.shiftKey && e.code === 'Digit1')) return zoomToFit()
      if (e.key === '.') return s.setUI({ hidden: !s.ui.hidden, menu: false })
      if (k === 'f') return toggleFullscreen()
      if (k === 'b') return s.setUI({ library: !s.ui.library })
      if (k === 'z') return togglePad()
      if (e.key === '[' || e.key === ']') {
        const size = Math.max(0, Math.min(SIZES.length - 1, s.style.size + (e.key === ']' ? 1 : -1)))
        s.setStyle({ size })
        return applyStyleToSelection({ size })
      }
      if (/^[0-9]$/.test(e.key)) {
        const i = e.key === '0' ? 9 : Number(e.key) - 1
        const color = COLOR_ORDER[i]
        s.setStyle({ color })
        return applyStyleToSelection({ color })
      }
      const tool = TOOL_KEYS.get(k)
      if (tool) {
        commitEditing()
        s.setTool(tool)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ' && boardController) boardController.spaceDown = false
      if ((e.key === 'Control' || e.key === 'Meta') && boardController) boardController.multiSelect = false
    }
    // Si se suelta Ctrl fuera de la ventana (Alt+Tab, etc.) no llega el keyup.
    const blur = () => {
      if (boardController) boardController.multiSelect = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])
}
