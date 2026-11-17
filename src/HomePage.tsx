import { Link } from 'react-router-dom'
import { useAuth } from './auth'
import LoginPage from './LoginPage'
import AuthorizedResources from './AuthorizedResources'
import OwnServiceRosters from './rosters/OwnServiceRosters'
import OwnUpcomingEvents from './events/OwnUpcomingEvents'
import UiIcon, {type IconKind} from './components/UiIcon'
import './home.css'
const shortcuts: {to:string;icon:IconKind;title:string;description:string}[]=[
 {to:'/eventos',icon:'events',title:'Ver eventos',description:'Acesse a área de eventos.'},
 {to:'/minhas-trilhas',icon:'church',title:'Minhas trilhas',description:'Acompanhe suas etapas e percursos.'},
 {to:'/minhas-tarefas',icon:'task',title:'Minhas tarefas',description:'Consulte, assuma e conclua suas atividades.'},
 {to:'/conta',icon:'account',title:'Acessar minha conta',description:'Consulte seu acesso e altere sua senha.'},
]
export default function HomePage(){
 const {account}=useAuth()
 if(!account)return <LoginPage/>
 return <section className="home-page" aria-labelledby="home-title">
  <header className="home-welcome"><div><div className="home-welcome-meta"><span className="home-community-pill">Sua comunidade</span><span>{new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric'}).format(new Date())}</span></div>
   <h1 id="home-title" data-page-title="Início">Bem-vindo</h1><p className="home-description">Acompanhe seus eventos, suas atuações e os próximos passos da sua caminhada.</p><p className="home-account">Conectado como {account.login}.</p>
  </div><span className="home-welcome-symbol" aria-hidden="true"><UiIcon kind="church"/></span></header>
  <div className="home-workspace"><div className="home-main-column"><OwnUpcomingEvents/><OwnServiceRosters/></div>
   <aside className="home-quick-panel" aria-label="Acessos rápidos"><div className="home-panel-title"><UiIcon kind="task"/><h2>Acessos rápidos</h2></div><p>O que você precisa fazer hoje?</p>
    <div className="home-shortcuts">{shortcuts.map(v=><Link key={v.to} className="home-shortcut" to={v.to}><span className="home-shortcut-icon"><UiIcon kind={v.icon}/></span><span className="home-shortcut-copy"><strong>{v.title}</strong><span>{v.description}</span></span><UiIcon kind="arrow"/></Link>)}</div>
    <div className="home-community-note"><UiIcon kind="church"/><p>Um espaço para conectar pessoas e acompanhar a vida da igreja.</p></div>
   </aside>
  </div>
  <details className="home-administration"><summary>Administração da equipe</summary><AuthorizedResources/></details>
 </section>
}
