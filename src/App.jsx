import { HashRouter, Routes, Route } from 'react-router-dom'
import { UserProvider } from './context/UserContext'
import NavBar       from './components/NavBar'
import TrailBrowser from './pages/TrailBrowser'
import TrailDetail  from './pages/TrailDetail'
import Leaderboard  from './pages/Leaderboard'
import AdminSync    from './pages/AdminSync'

export default function App() {
  return (
    <HashRouter>
      <UserProvider>
        <NavBar />
        <Routes>
          <Route path="/"           element={<TrailBrowser />} />
          <Route path="/trail/:id"  element={<TrailDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/admin"      element={<AdminSync />} />
        </Routes>
      </UserProvider>
    </HashRouter>
  )
}
