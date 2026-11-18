import '@fontsource-variable/inter'
import './style.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'
import { ChurchContextProvider } from './church-context'


const router=createBrowserRouter([{path:'*',element:<AuthProvider><ChurchContextProvider><App /></ChurchContextProvider></AuthProvider>}])
createRoot(document.getElementById('root')!).render(<StrictMode><RouterProvider router={router}/></StrictMode>)
