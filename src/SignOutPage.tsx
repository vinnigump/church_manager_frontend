import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
export default function SignOutPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const exit = useRef(logout)
  const started = useRef(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (started.current) return
    started.current = true
    Promise.resolve(exit.current()).then(() => navigate('/', { replace: true })).catch(() => {
      setError('Não foi possível confirmar a saída no servidor. Tente novamente antes de deixar este dispositivo.')
      started.current = false
    })
  }, [navigate, retry])
  return error ? <><p role="alert">{error}</p><button onClick={() => { setError(''); setRetry(value => value + 1) }}>Tentar sair novamente</button></> : <p role="status">Saindo…</p>
}
