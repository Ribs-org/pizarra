import { X } from 'lucide-react'
import { useStore } from '../store'
import { TOOLS } from '../tools'

const GESTURES: [string, string][] = [
  ['1 dedo', 'Dibuja / usa la herramienta'],
  ['2 dedos', 'Mover y hacer zoom (pellizco)'],
  ['Toque con 2 dedos', 'Deshacer'],
  ['Toque con 3 dedos', 'Rehacer'],
  ['Mantén quieto al final', 'Convierte el trazo en forma limpia (círculo, caja, flecha, línea…)'],
  ['Después de enderezar una línea', 'Sigue moviendo el dedo para ajustar su punta'],
  ['Doble toque (seleccionar)', 'Editar texto / texto nuevo'],
]

const KEYS: [string, string][] = [
  ['Enter', 'Escribir texto donde está el cursor (o bajo el último texto)'],
  ['Ctrl+K  o  /', 'Paleta de comandos (insertar dibujos, cambiar fondo…)'],
  ['Shift+Enter en la paleta', 'Insertar el texto escrito, animado'],
  ['1 … 0', 'Colores'],
  ['[  ]', 'Grosor más delgado / más grueso'],
  ['Z', 'Lupa de escritura'],
  ['B', 'Biblioteca de dibujos'],
  ['.', 'Ocultar / mostrar interfaz (para grabar)'],
  ['F', 'Pantalla completa'],
  ['Espacio + arrastrar', 'Mover la vista'],
  ['Ctrl+Z / Ctrl+Y', 'Deshacer / rehacer'],
  ['Ctrl+D · Supr', 'Duplicar · eliminar selección'],
  ['Ctrl+A', 'Seleccionar todo'],
  ['Shift+1', 'Ver todo el contenido'],
  ['Ctrl+0 / Ctrl+= / Ctrl+-', 'Zoom 100% / acercar / alejar'],
  ['Ctrl+Shift+E · Ctrl+Shift+C', 'Exportar PNG · copiar imagen'],
  ['Ctrl+S · Ctrl+O', 'Guardar · abrir archivo'],
  ['Esc', 'Terminar texto / deseleccionar / cerrar'],
]

export function Help() {
  const open = useStore((s) => s.ui.help)
  const setUI = useStore((s) => s.setUI)
  if (!open) return null
  return (
    <div className="overlay" onPointerDown={() => setUI({ help: false })}>
      <div className="help panel" onPointerDown={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span>Atajos y gestos</span>
          <button className="icon-btn small" onClick={() => setUI({ help: false })}>
            <X size={16} />
          </button>
        </div>
        <div className="help-cols">
          <section>
            <h3>Pantalla táctil</h3>
            <dl>
              {GESTURES.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <h3>Herramientas</h3>
            <dl className="tools-list">
              {TOOLS.map((t) => (
                <div key={t.id}>
                  <dt>
                    <kbd>{t.key}</kbd>
                  </dt>
                  <dd>{t.name}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <h3>Teclado</h3>
            <dl>
              {KEYS.map(([k, v]) => (
                <div key={k}>
                  <dt>
                    <kbd>{k}</kbd>
                  </dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
        <p className="muted tip">
          Tip para la letra: abre la <b>Lupa (Z)</b> y escribe grande con el dedo sobre el renglón; en la pizarra queda chico y parejo. Si
          tiembla mucho, sube el <b>Suavizado</b> en el menú.
        </p>
      </div>
    </div>
  )
}
