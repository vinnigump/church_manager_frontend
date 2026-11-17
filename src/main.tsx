import '@fontsource-variable/inter'
import './style.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'
import { ChurchContextProvider } from './church-context'


createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><AuthProvider><ChurchContextProvider><App /></ChurchContextProvider></AuthProvider></BrowserRouter></StrictMode>)
