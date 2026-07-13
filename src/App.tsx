import { Route, Routes } from 'react-router-dom'
import { Home } from './routes/Home'
import { Add } from './routes/Add'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/add" element={<Add />} />
    </Routes>
  )
}
