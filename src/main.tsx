import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import 'leaflet/dist/leaflet.css'
import { registerSW } from 'virtual:pwa-register'
import { installConsoleFilters } from '@/lib/consoleFilters'
import { useToastStore } from '@/stores/toastStore'

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .catch(() => undefined)
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      useToastStore.getState().push({
        type: 'info',
        title: 'Aggiornamento disponibile',
        message: 'È pronta una nuova versione. Se noti problemi, chiudi e riapri l’app o ricarica la pagina.',
      })
    },
  })

  ;(window as unknown as { __lifepet_updateSW?: () => void }).__lifepet_updateSW = () => {
    void updateSW?.(true)
  }
}

installConsoleFilters()

const strictEnabled = String(import.meta.env.VITE_REACT_STRICT_MODE || '') === '1'

createRoot(document.getElementById('root')!).render(strictEnabled ? (
  <StrictMode>
    <App />
  </StrictMode>
) : (
  <App />
))
