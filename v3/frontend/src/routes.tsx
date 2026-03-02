import { Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Dashboard from './pages/Dashboard'
import SignalFeed from './pages/SignalFeed'
import OpportunityList from './pages/OpportunityList'
import KolConfig from './pages/config/KolConfig'
import WalletConfig from './pages/config/WalletConfig'
import TelegramConfig from './pages/config/TelegramConfig'
import SystemConfig from './pages/config/SystemConfig'

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="signals" element={<SignalFeed />} />
        <Route path="opportunities" element={<OpportunityList />} />
        <Route path="config/kols" element={<KolConfig />} />
        <Route path="config/wallets" element={<WalletConfig />} />
        <Route path="config/telegram" element={<TelegramConfig />} />
        <Route path="config/system" element={<SystemConfig />} />
      </Route>
    </Routes>
  )
}
