import { Shapes, ScanText } from 'lucide-react'
import { Fragment } from 'react'
import { commitEditing } from '../actions'
import { useStore } from '../store'
import { TOOL_GROUPS, TOOL_MAP } from '../tools'
import { togglePad } from './ZoomPad'

export function Toolbar() {
  const tool = useStore((s) => s.tool)
  const library = useStore((s) => s.ui.library)
  const pad = useStore((s) => s.ui.pad)
  const setTool = useStore((s) => s.setTool)
  const setUI = useStore((s) => s.setUI)

  return (
    <div className="toolbar panel" onMouseDown={(e) => e.preventDefault()}>
      {TOOL_GROUPS.map((group, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <span className="sep" />}
          {group.map((id) => {
            const t = TOOL_MAP.get(id)!
            const Icon = t.icon
            return (
              <button
                key={id}
                className={`icon-btn tool ${tool === id ? 'active' : ''}`}
                title={`${t.name} — ${t.key}`}
                aria-label={t.name}
                aria-pressed={tool === id}
                onClick={() => {
                  if (id !== 'text') commitEditing()
                  setTool(id)
                }}
              >
                <Icon size={19} strokeWidth={1.9} />
                <kbd>{t.key}</kbd>
              </button>
            )
          })}
        </Fragment>
      ))}
      <span className="sep" />
      <button
        className={`icon-btn tool ${library ? 'active' : ''}`}
        title="Biblioteca de dibujos — B"
        aria-label="Biblioteca de dibujos"
        onClick={() => setUI({ library: !library })}
      >
        <Shapes size={19} strokeWidth={1.9} />
        <kbd>B</kbd>
      </button>
      <button
        className={`icon-btn tool ${pad ? 'active' : ''}`}
        title="Lupa de escritura — Z (escribe grande, queda chico y ordenado)"
        aria-label="Lupa de escritura"
        onClick={togglePad}
      >
        <ScanText size={19} strokeWidth={1.9} />
        <kbd>Z</kbd>
      </button>
    </div>
  )
}
