import { useState, type FormEvent } from 'react'
import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Guard, useAuth } from './auth'
import EventsPage from './events/EventViews'

function Layout() {
  const { account, logout } = useAuth()
  return <><a className="skip" href="#conteudo">Ir para o conteúdo</a><header><Link to="/">Church Manager</Link><nav aria-label="Principal">{account && <Link to="/eventos">Eventos</Link>}<Link to="/conta">Minha conta</Link>{account ? <button onClick={logout}>Sair</button> : <Link to="/entrar">Entrar</Link>}</nav></header><main id="conteudo" tabIndex={-1}><Outlet /></main></>
}
function Login() {
  const { account, login, expired } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (account) return <Navigate to="/conta" replace />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true); setError('')
    try { await login(String(data.get('login')), String(data.get('password'))) }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível entrar.') }
    finally { form.reset(); setBusy(false) }
  }
  return <section><h1>Entrar</h1>{expired && <p role="status">Sua sessão expirou. Entre novamente.</p>}<p>Use sua conta cadastrada para acessar.</p><form onSubmit={submit} aria-busy={busy}><label htmlFor="login">Login</label><input id="login" name="login" autoComplete="username" required disabled={busy}/><label htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" required disabled={busy}/>{error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button></form></section>
}
function AccountPage() { const { account } = useAuth(); return <><h1>Minha conta</h1><p>Conectado como {account?.login}.</p></> }
export default function App() {
  return <Routes><Route element={<Layout />}><Route index element={<><h1>Bem-vindo</h1><p>Acesse sua conta para continuar.</p></>}/><Route path="entrar" element={<Login />}/><Route element={<Guard />}><Route path="conta" element={<AccountPage />}/><Route path="eventos" element={<EventsPage />}/><Route element={<Guard permission="organization:manage" scope="global" />}><Route path="admin" element={<h1>Administração</h1>}/></Route></Route><Route path="*" element={<><h1>Página não encontrada</h1><Link to="/">Voltar ao início</Link></>}/></Route></Routes>
}
