import { useNavigate } from 'react-router-dom'

export function useSignOut() {
  const navigate = useNavigate()
  return () => navigate('/sair', { replace: true })
}
