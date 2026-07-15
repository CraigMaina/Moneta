import { Route, Routes } from 'react-router-dom'
import { Home } from './routes/Home'
import { Add } from './routes/Add'
import { Transactions } from './routes/Transactions'
import { Goals } from './routes/Goals'
import { Insights } from './routes/Insights'
import { Settings } from './routes/Settings'
import { Recurring } from './routes/Recurring'
import { Budgets } from './routes/Budgets'
import { StatementImport } from './routes/StatementImport'
import { KitchenSink } from './routes/KitchenSink'
import { ToastProvider } from './components/ui/Toast'
import { OfflineBanner } from './features/offline/OfflineBanner'
import { SessionGate } from './features/auth/SessionGate'
import { OnboardingGate } from './features/onboarding/OnboardingGate'
import { LockGate } from './features/security/LockGate'

export function App() {
  return (
    <ToastProvider>
      <OfflineBanner />
      <Routes>
        {/* Direct-URL only, not in the tab bar — the primitive-kit visual QA
            surface. Kept outside the session gate so primitives can be reviewed
            without a login. */}
        <Route path="/kitchen-sink" element={<KitchenSink />} />
        <Route
          path="/*"
          element={
            <SessionGate>
              <LockGate>
              <OnboardingGate>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/add" element={<Add />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/recurring" element={<Recurring />} />
                <Route path="/budgets" element={<Budgets />} />
                <Route path="/import" element={<StatementImport />} />
              </Routes>
              </OnboardingGate>
              </LockGate>
            </SessionGate>
          }
        />
      </Routes>
    </ToastProvider>
  )
}
