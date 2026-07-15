import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { App } from './App'
import { queryClient, queryPersister } from './lib/queryClient'
import { registerMutationDefaults } from './features/offline/mutationDefaults'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

// Must run before the persister restores paused mutations (PRD F12): it gives
// rehydrated offline writes a mutationFn to resume with.
registerMutationDefaults(queryClient)

createRoot(rootElement).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister }}
      // Once the cache (incl. any paused offline mutations) is restored, replay
      // them — the tunnel-then-reload case. Within a session, reconnecting
      // resumes them automatically via onlineManager.
      onSuccess={() => {
        void queryClient.resumePausedMutations()
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
)
