import { Route, Routes } from 'react-router-dom'
import { Home } from './routes/Home'
import { Add } from './routes/Add'
import { Transactions } from './routes/Transactions'
import { Goals } from './routes/Goals'
import { Insights } from './routes/Insights'
import { KitchenSink } from './routes/KitchenSink'
import { ToastProvider } from './components/ui/Toast'

export function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/add" element={<Add />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/insights" element={<Insights />} />
        {/* Direct-URL only, not in the tab bar — the primitive-kit visual QA surface. */}
        <Route path="/kitchen-sink" element={<KitchenSink />} />
      </Routes>
    </ToastProvider>
  )
}
