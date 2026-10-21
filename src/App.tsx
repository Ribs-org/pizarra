import { Board } from './components/Board'
import { BottomLeft, HelpButton, SelectionActions, ShowUIButton, TopRight } from './components/Chrome'
import { CommandPalette } from './components/CommandPalette'
import { Help } from './components/Help'
import { Library } from './components/Library'
import { StylePanel } from './components/StylePanel'
import { TextEditor } from './components/TextEditor'
import { Toaster } from './components/Toast'
import { Toolbar } from './components/Toolbar'
import { ZoomPad } from './components/ZoomPad'
import { useKeyboard } from './keyboard'
import { useStore } from './store'
import { THEMES } from './theme'

export default function App() {
  useKeyboard()
  const hidden = useStore((s) => s.ui.hidden)
  const themeKey = useStore((s) => s.settings.theme)
  const empty = useStore((s) => s.elements.length === 0 && !s.editing && !s.ui.pad)

  return (
    <div className={`app ui-${THEMES[themeKey].ui}`}>
      <Board />
      <TextEditor />
      {hidden ? (
        <ShowUIButton />
      ) : (
        <>
          {empty && <EmptyHint />}
          <Toolbar />
          <StylePanel />
          <TopRight />
          <BottomLeft />
          <HelpButton />
          <SelectionActions />
          <Library />
        </>
      )}
      <ZoomPad />
      <CommandPalette />
      <Help />
      <Toaster />
    </div>
  )
}

function EmptyHint() {
  return (
    <div className="empty-hint">
      <p className="hint-title">Dibuja o escribe con el dedo</p>
      <p>
        Mantén el dedo quieto al terminar un círculo, caja o flecha y se arregla solo · <kbd>Enter</kbd> para escribir con teclado ·{' '}
        <kbd>Z</kbd> lupa de escritura · <kbd>Ctrl K</kbd> para todo lo demás
      </p>
    </div>
  )
}
