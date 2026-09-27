import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './components/home/HomePage.css'
import './styles.css'
import './loading-skeleton.css'
import './branded-loader.js'

createRoot(document.getElementById('root')).render(<App />)
