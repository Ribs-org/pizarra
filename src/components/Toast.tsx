import { useEffect, useState } from 'react'

type Listener = (msg: string) => void
const listeners = new Set<Listener>()

/** Mensajito breve abajo al centro ("PNG exportado", etc.). */
export function toast(msg: string) {
  for (const l of listeners) l(msg)
}

export function Toaster() {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null)
  useEffect(() => {
    const l: Listener = (text) => setMsg({ text, key: Date.now() })
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2200)
    return () => clearTimeout(t)
  }, [msg])
  if (!msg) return null
  return (
    <div key={msg.key} className="toast panel">
      {msg.text}
    </div>
  )
}
