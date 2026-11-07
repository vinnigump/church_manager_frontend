import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './auth'

export default function SignOutPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const completed = useRef(false)
  useEffect(() => {
    if (completed.current) return
    completed.current = true
    // This route is outside Guard: clearing auth cannot capture the old
    // protected page as a competing return destination.
    logout()
    navigate('/', { replace: true })
  }, [logout, navigate])
  return <p role="status">Saindo…</p>
}
