import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { useDefaultChurch } from '../church-context'
import { discoverResources, type AuthorizedResource } from '../AuthorizedResources'
import { consultAuthorization } from '../authorization'
import NavigationIcon from './UiIcon'
type Area = 'home' | 'people' | 'events' | 'ministries' | 'reception'
type Action = { label: string; permission?: string[]; scope?: 'CHURCH' | 'DENOMINATION'; path: (id: string, permissions?: string[]) => string; fallback: string; personal?: boolean }
const action = (label: string, permission: string[], path: Action['path'], fallback: string, scope: Action['scope'] = 'CHURCH'): Action => ({ label, permission, path, fallback, scope })
const areas = [ ['home','/','Início','home'], ['people','/pessoas','Pessoas','account'], ['events','/eventos','Eventos','events'], ['ministries','/ministerios','Ministérios','ministries'], ['reception','/recepcao','Recepção','reception'] ] as const
const definitions: Record<Area, Action[]> = {
 home: [['Meu resumo','/'],['Minhas tarefas','/minhas-tarefas'],['Minhas trilhas','/minhas-trilhas'],['Minhas escalas','/minhas-escalas'],['Minhas inscrições','/minhas-inscricoes']].map(([label,path]) => ({ label, path: () => path, fallback:path, personal:true })),
 people: [action('Consultar pessoas',['identity:person:contextual:read'],id=>`/pessoas/igrejas/${id}`,'/pessoas?selecionar=1'),action('Cadastrar pessoa',['identity:person:contextual:create'],id=>`/pessoas/igrejas/${id}/cadastrar`,'/pessoas?acao=cadastrar&selecionar=1'),action('Primeiro acesso',['identity:first-access:issue'],id=>`/pessoas/primeiro-acesso/igrejas/${id}`,'/pessoas/primeiro-acesso?selecionar=1')],
 events: [action('Calendário e lista',['EVENT_VIEW'],id=>`/eventos/igrejas/${id}/cadastro`,'/eventos?selecionar=1'),action('Criar evento',['EVENT_CREATE'],id=>`/eventos/igrejas/${id}/cadastro/novo`,'/eventos?acao=criar&selecionar=1'),action('Presenças nos eventos',['EVENT_ATTENDANCE_MANAGE'],id=>'/eventos?acao=presencas&igreja='+id,'/eventos?acao=presencas')],
 ministries: [action('Ministérios e departamentos',['GROUP_MEMBERSHIP_MANAGE','GROUP_MEMBERSHIP_MANAGE_LED'],id=>`/ministerios/igrejas/${id}`,'/ministerios?selecionar=1'),action('Organizar estrutura',['MINISTRY_UNIT_MANAGE'],id=>`/ministerios/estrutura/igrejas/${id}`,'/ministerios/estrutura?selecionar=1'),action('Grupos de trabalho',['CHURCH_GROUP_MANAGE'],id=>`/grupos/igrejas/${id}`,'/grupos?selecionar=1'),action('Escalas',['SERVICE_ROSTER_VIEW','SERVICE_ROSTER_MANAGE'],(id,p=[])=>`/ministerios/igrejas/${id}/escalas${p.includes('SERVICE_ROSTER_VIEW')?'':'/nova'}`,'/ministerios/escalas?selecionar=1'),action('Criar escala',['SERVICE_ROSTER_MANAGE'],id=>`/ministerios/igrejas/${id}/escalas/nova`,'/ministerios/escalas?acao=criar&selecionar=1')],
 reception: ['Entregar crachá','Devolver ou registrar perda','Crachás e QR Codes'].map((label,i)=>action(label,['BADGE_MANAGE'],id=>`/recepcao/igrejas/${id}?aba=${['entregar','devolver','crachas'][i]}`,`/recepcao?aba=${['entregar','devolver','crachas'][i]}&selecionar=1`))
}
const management = [action('Tarefas da equipe',['TASK_VIEW','TASK_CREATE'],(id,p=[])=>`/tarefas/igrejas/${id}${p.includes('TASK_VIEW')?'':'/nova'}`,'/minhas-tarefas?selecionar=1'),action('Trilhas',['TRAIL_MANAGE'],id=>`/trilhas/igrejas/${id}`,'/trilhas/gestao?selecionar=1'),action('Questionários',['QUESTIONNAIRE_MANAGE','QUESTIONNAIRE_RESPONSE_READ','QUESTIONNAIRE_GRADE','QUESTIONNAIRE_EXPORT'],(id,p=[])=>`/questionarios/igrejas/${id}/${p.includes('QUESTIONNAIRE_MANAGE')?'gerenciar':(p.includes('QUESTIONNAIRE_RESPONSE_READ')||p.includes('QUESTIONNAIRE_GRADE'))?'respostas':'exportar'}`,'/questionarios?selecionar=1'),action('Relatórios',['REPORT_VIEW'],id=>`/relatorios/igrejas/${id}`,'/relatorios?selecionar=1')]
const settings = [action('Tipos de evento da igreja',['EVENT_VIEW','EVENT_CREATE','EVENT_EDIT'],id=>`/eventos/igrejas/${id}/catalogo`,'/eventos?acao=tipos&selecionar=1'),action('Modelos de evento da denominação',['EVENT_TEMPLATE_MANAGE'],id=>`/eventos/denominacoes/${id}/catalogo`,'/eventos','DENOMINATION'),action('Perfis e permissões',['security:profile:manage'],id=>`/seguranca/denominacoes/${id}/perfis`,'/conta','DENOMINATION'),action('Acessos da equipe',['security:assignment:manage'],id=>`/seguranca/denominacoes/${id}/atribuicoes`,'/conta','DENOMINATION'),action('Auditoria',['security:audit:read'],id=>`/seguranca/denominacoes/${id}/auditoria`,'/conta','DENOMINATION')]
function currentArea(path: string): Area | null {
 if (path==='/' || /^\/(minhas-tarefas|minhas-trilhas|minhas-escalas|minhas-inscricoes)(\/|$)/.test(path)) return 'home'
 if(path.startsWith('/pessoas'))return 'people'
 if(path.startsWith('/eventos'))return 'events'
 if(path.startsWith('/ministerios')||path.startsWith('/grupos')||/^\/igrejas\/[^/]+\/grupos(?:\/|$)/.test(path))return 'ministries'
 if(path.startsWith('/recepcao'))return 'reception'
 return null
}
type Resolved = { label: string; path: string }[]
export default function SidebarNavigation() {
 const { account }=useAuth(),{defaultChurchId,churches,ready}=useDefaultChurch(),{pathname}=useLocation()
 const [mobile,setMobile]=useState(()=>typeof window.matchMedia==='function' && window.matchMedia('(max-width:767px)').matches)
 useEffect(()=>{
  if(typeof window.matchMedia!=='function')return
  const query=window.matchMedia('(max-width:767px)'),change=()=>setMobile(query.matches)
  query.addEventListener('change',change)
  return ()=>query.removeEventListener('change',change)
 },[])
 const area=currentArea(pathname),[expanded,setExpanded]=useState<'management'|'settings'|null>(null)
 const specs=[...(area?definitions[area]:[]),...(expanded==='management'?management:expanded==='settings'?settings:[])]
 const moduleChurchId=pathname.match(/\/igrejas\/([0-9a-f-]{36})(?:\/|$)/i)?.[1]??null
 const contextId=moduleChurchId??defaultChurchId
 const key=JSON.stringify([area,expanded,defaultChurchId,moduleChurchId,ready])
 const [snapshot,setSnapshot]=useState<{account:typeof account;key:string;links:Resolved;churchLabel?:string}>({account:null,key:'',links:[]})
 useEffect(()=>{
  const controller=new AbortController()
  const resolve=async()=>{
   const staff=ready?specs.filter(v=>!v.personal):[]
   const resources=staff.length?await discoverResources(controller.signal):[]
   const checks=new Map<string,Promise<boolean>>()
   const allowed=(r:AuthorizedResource,p:string)=>{const k=r.resourceType+':'+r.resourceId+':'+p;if(!checks.has(k))checks.set(k,consultAuthorization({permissionCode:p,resourceType:r.resourceType,resourceId:r.resourceId},controller.signal));return checks.get(k)!}
   const links=(await Promise.all(specs.filter(spec=>spec.personal||ready).map(async spec=>{
    if(spec.personal)return [{label:spec.label,path:spec.fallback}]
    const candidates=resources.filter(r=>r.resourceType===spec.scope)
    const decisions=await Promise.all(candidates.map(async r=>{const permissions=spec.permission!;const checks=await Promise.all(permissions.map(p=>allowed(r,p)));return {...r,permissions:permissions.filter((_p,i)=>checks[i])}}))
    const permitted=decisions.filter(v=>v.permissions.length)
    if(!permitted.length)return []
    if(spec.scope==='DENOMINATION')return permitted.map(r=>({label:permitted.length>1?spec.label+' · '+r.label:spec.label,path:spec.path(r.resourceId,r.permissions)}))
    const moduleMatch=area && definitions[area].includes(spec)?pathname.match(/\/igrejas\/([0-9a-f-]{36})(?:\/|$)/i)?.[1]:null
    const preferred=permitted.find(r=>r.resourceId===(moduleMatch??defaultChurchId))
    return [{label:spec.label,path:preferred?spec.path(preferred.resourceId,preferred.permissions):spec.fallback}]
   }))).flat()
   if(!controller.signal.aborted)setSnapshot({account,key,links,churchLabel:resources.find(r=>r.resourceType==='CHURCH'&&r.resourceId===contextId)?.label})
  }
  if(account)void resolve().catch(()=>{if(!controller.signal.aborted)setSnapshot({account,key,links:specs.filter(v=>v.personal).map(v=>({label:v.label,path:v.fallback}))})})
  return ()=>controller.abort()
 // Definitions and specs are immutable projections of this key.
 },[account,key])
 const links=snapshot.account===account&&snapshot.key===key?snapshot.links:[]
 const render=(items:Action[])=>items.flatMap(spec=>links.filter(v=>v.label===spec.label||v.label.startsWith(spec.label+' · '))).map(v=><Link key={v.label} to={v.path}>{v.label}</Link>)
 const submenu=area?<div className="app-area-submenu">{render(definitions[area])}</div>:null
 const secondary=<div className="app-secondary-navigation"><span>Acessos da equipe</span>{([['management','Gestão da igreja',management],['settings','Configurações',settings]] as const).map(([id,label,items])=><div key={id}><button type="button" aria-expanded={expanded===id} onClick={()=>setExpanded(expanded===id?null:id)}>{label}<span aria-hidden="true">{expanded===id?'−':'+'}</span></button>{expanded===id&&<div className="app-secondary-links">{render([...items])}</div>}</div>)}</div>
 const churchLabel=snapshot.account===account&&snapshot.key===key?snapshot.churchLabel??churches.find(c=>c.churchId===contextId)?.name:churches.find(c=>c.churchId===contextId)?.name
 return <><nav className="app-navigation" aria-label="Principal">{churchLabel&&<div className="app-navigation-context"><span>Igreja deste acesso</span><strong>{churchLabel}</strong></div>}{areas.map(([id,path,label,icon])=><div className="app-area" key={id}><Link aria-current={area===id?'page':undefined} className={area===id?'app-area-link app-area-link--active':'app-area-link'} to={path}><NavigationIcon kind={icon}/><span>{label}</span></Link>{!mobile&&area===id&&submenu}</div>)}{!mobile&&secondary}</nav>{mobile&&<div className="app-mobile-area-menu">{submenu}{secondary}</div>}</>
}
