import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import AppRoutes from './routes'

function App() {
  return (
    <ConfigProvider theme={{ token: { borderRadius: 6, colorPrimary: '#1677ff' } }}>
      <AntApp>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}

export default App
