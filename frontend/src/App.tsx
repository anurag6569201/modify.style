import { AppProvider } from './context/AppContext'
import WebsiteViewer from './components/WebsiteViewer'
import './App.css'

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
