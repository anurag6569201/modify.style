/**
 * Main application component.
 * Provides the app context and renders the website viewer.
 */

import { AppProvider } from './context/AppContext'
import { WebsiteViewer } from './components'
import './assets/css/App.css'

function App() {
  return (
    <AppProvider>
      <div className="app">
        <WebsiteViewer />
      </div>
    </AppProvider>
  )
}

export default App
