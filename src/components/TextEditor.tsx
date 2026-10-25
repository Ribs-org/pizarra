import { useEffect, useRef } from 'react'
import { commitEditing } from '../actions'
import { useStore } from '../store'
import { cssSize, measureText } from '../text'
import { FONTS, LINE_HEIGHT, THEMES } from '../theme'

/** Caja de texto que flota exactamente sobre donde quedará el texto en la pizarra. */
export function TextEditor() {
  const editing = useStore((s) => s.editing)
  const camera = useStore((s) => s.camera)
  const themeKey = useStore((s) => s.settings.theme)
  const setEditing = useStore((s) => s.setEditing)
  const ref = useRef<HTMLTextAreaElement>(null)
  const key = editing ? `${editing.id ?? 'new'}:${editing.x}:${editing.y}` : ''

  useEffect(() => {
    if (!key) return
    const t = ref.current
    if (!t) return
    t.focus({ preventScroll: true })
    t.setSelectionRange(t.value.length, t.value.length)
  }, [key])

  if (!editing) return null
  const theme = THEMES[themeKey]
  const f = FONTS[editing.font]
  const size = cssSize(editing.font, editing.fontSize) * camera.z
  const lh = size * LINE_HEIGHT
  const lines = editing.text.split('\n').length
  const { w } = measureText(editing.text || 'M', editing.font, editing.fontSize)

  return (
    <textarea
      ref={ref}
      className="text-editor"
      value={editing.text}
      spellCheck={false}
      autoCapitalize="off"
      placeholder="Escribe…"
      onChange={(e) => setEditing({ ...editing, text: e.target.value })}
      onBlur={() => commitEditing()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault()
          commitEditing()
        }
      }}
      style={{
        left: editing.x * camera.z + camera.x,
        top: editing.y * camera.z + camera.y,
        width: w * camera.z + size * 1.2,
        height: lines * lh,
        // Gira alrededor del centro que tendrá el texto al confirmarse (así calza con como queda).
        transform: editing.angle ? `rotate(${editing.angle}rad)` : undefined,
        transformOrigin: `${(w * camera.z) / 2}px ${(lines * lh) / 2}px`,
        fontFamily: `"${f.family}", cursive`,
        fontWeight: f.weight,
        fontSize: size,
        lineHeight: `${lh}px`,
        color: theme.palette[editing.color],
        caretColor: theme.palette[editing.color],
      }}
    />
  )
}
