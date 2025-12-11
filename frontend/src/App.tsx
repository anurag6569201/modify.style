import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import apiService from './services/api'

function App() {
  const [count, setCount] = useState(0)
  const [backendStatus, setBackendStatus] = useState<string>('Checking...')
  const [apiInfo, setApiInfo] = useState<any>(null)

  useEffect(() => {
    // Test backend connection on component mount
    const checkBackend = async () => {
      try {
        const health = await apiService.healthCheck()
        setBackendStatus(health.message || 'Connected!')
        
        const info = await apiService.getApiInfo()
        setApiInfo(info)
      } catch (error) {
        setBackendStatus('Backend not connected. Make sure Django server is running on port 8000.')
        console.error('Backend connection error:', error)
      }
    }

    checkBackend()
  }, [])

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React + Django</h1>
      
      <div className="card">
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#1a1a1a', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0 }}>Backend Status</h3>
          <p style={{ color: backendStatus.includes('not connected') ? '#ff6b6b' : '#51cf66' }}>
            {backendStatus}
          </p>
          {apiInfo && (
            <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
              <p><strong>API:</strong> {apiInfo.name} v{apiInfo.version}</p>
            </div>
          )}
        </div>

        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
