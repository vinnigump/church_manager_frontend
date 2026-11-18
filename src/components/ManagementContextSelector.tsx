import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { discoverResources } from '../AuthorizedResources'
import { consultAuthorization } from '../authorization'
import { useAuth } from '../auth'
import { useDefaultChurch } from '../church-context'

type ContextRoute={type:'CHURCH'|'DENOMINATION';permissions:string[];path:(id:string,allowed:string[])=>string}
const church=(permissions:string[],path:ContextRoute['path']):ContextRoute=>({type:'CHURCH',permissions,path})
const denomination=(permissions:string[],path:ContextRoute['path']):ContextRoute=>({type:'DENOMINATION',permissions,path})
/** Switches scope, never carries an entity ID or draft from another church. */
export function managementContextRoute(path:string,search=''):ContextRoute|null {
  const params=new URLSearchParams(search)
  if(path.startsWith('/seguranca/denominacoes/')){
    const section=path.split('/')[4]??'perfis'
    const permission=section==='auditoria'?'security:audit:read':section==='perfis'||section==='permissoes'?'security:profile:manage':section==='delegacoes'?'security:delegation:manage':'security:assignment:manage'
    return denomination([permission],id=>`/seguranca/denominacoes/${id}/${section}`)
  }
  if(path.startsWith('/eventos/denominacoes/'))return denomination(['EVENT_TEMPLATE_MANAGE'],id=>`/eventos/denominacoes/${id}/catalogo`)
  if(path.startsWith('/trilhas/denominacoes/'))return denomination(['TRAIL_MANAGE'],id=>`/trilhas/denominacoes/${id}`)
  if(path.startsWith('/pessoas/primeiro-acesso'))return church(['identity:first-access:issue'],id=>`/pessoas/primeiro-acesso/igrejas/${id}`)
  if(path.startsWith('/pessoas'))return path.endsWith('/cadastrar')?church(['identity:person:contextual:create'],id=>`/pessoas/igrejas/${id}/cadastrar`):church(['identity:person:contextual:read'],id=>`/pessoas/igrejas/${id}`)
  if(path.startsWith('/eventos')&&!path.startsWith('/eventos/participar')&&!path.startsWith('/eventos-publicos')){
    if(params.get('acao')==='presencas')return church(['EVENT_ATTENDANCE_MANAGE'],id=>`/eventos?acao=presencas&igreja=${id}`)
    if(path.endsWith('/novo')||params.get('acao')==='criar')return church(['EVENT_CREATE'],id=>`/eventos/igrejas/${id}/cadastro/novo`)
    if(path.includes('/catalogo'))return church(['EVENT_VIEW','EVENT_CREATE','EVENT_EDIT'],id=>`/eventos/igrejas/${id}/catalogo`)
    return church(['EVENT_VIEW','EVENT_CREATE'],(id,p)=>`/eventos/igrejas/${id}/cadastro${p.includes('EVENT_VIEW')?'':'/novo'}`)
  }
  if(path.startsWith('/ministerios/estrutura'))return church(['MINISTRY_UNIT_MANAGE'],id=>`/ministerios/estrutura/igrejas/${id}`)
  if(path.startsWith('/ministerios')&&path.includes('/escalas'))return path.endsWith('/nova')?church(['SERVICE_ROSTER_MANAGE'],id=>`/ministerios/igrejas/${id}/escalas/nova`):church(['SERVICE_ROSTER_VIEW','SERVICE_ROSTER_MANAGE'],(id,p)=>`/ministerios/igrejas/${id}/escalas${p.includes('SERVICE_ROSTER_VIEW')?'':'/nova'}`)
  if(path.startsWith('/ministerios')||/^\/igrejas\/[^/]+\/grupos\//.test(path))return church(['GROUP_MEMBERSHIP_MANAGE','GROUP_MEMBERSHIP_MANAGE_LED'],id=>`/ministerios/igrejas/${id}`)
  if(path.startsWith('/grupos'))return church(['CHURCH_GROUP_MANAGE'],id=>`/grupos/igrejas/${id}`)
  if(path.startsWith('/recepcao'))return church(['BADGE_MANAGE'],id=>`/recepcao/igrejas/${id}${['entregar','devolver','crachas'].includes(params.get('aba')??'')?'?aba='+params.get('aba'):''}`)
  if(path.startsWith('/tarefas'))return path.endsWith('/nova')?church(['TASK_CREATE'],id=>`/tarefas/igrejas/${id}/nova`):church(['TASK_VIEW','TASK_CREATE'],(id,p)=>`/tarefas/igrejas/${id}${p.includes('TASK_VIEW')?'':'/nova'}`)
  if(path.startsWith('/trilhas'))return church(['TRAIL_MANAGE'],id=>`/trilhas/igrejas/${id}`)
  if(path.startsWith('/questionarios')&&/\/(gerenciar|novo|versoes|historico|respostas|exportar)(\/|$)/.test(path))return church(['QUESTIONNAIRE_MANAGE','QUESTIONNAIRE_RESPONSE_READ','QUESTIONNAIRE_GRADE','QUESTIONNAIRE_EXPORT'],(id,p)=>`/questionarios/igrejas/${id}/${p.includes('QUESTIONNAIRE_MANAGE')?'gerenciar':p.includes('QUESTIONNAIRE_RESPONSE_READ')||p.includes('QUESTIONNAIRE_GRADE')?'respostas':'exportar'}`)
  if(path.startsWith('/relatorios'))return church(['REPORT_VIEW'],id=>`/relatorios/igrejas/${id}`)
  return null
}
type Option={id:string;label:string;path:string}
export default function ManagementContextSelector(){
  const {account}=useAuth(),{pathname,search}=useLocation(),navigate=useNavigate()
  const {ready:contextReady,defaultChurchId,selectedChurchId,selectChurch}=useDefaultChurch()
  const config=managementContextRoute(pathname,search),key=config?JSON.stringify([config.type,config.permissions,config.path('__context__',config.permissions)]):''
  const [attempt,setAttempt]=useState(0),[snapshot,setSnapshot]=useState<{account:typeof account;key:string;options:Option[];error:boolean}>({account:null,key:'',options:[],error:false})
  useEffect(()=>{const refresh=()=>setAttempt(v=>v+1);window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh)},[])
  useEffect(()=>{
    if(!account||!contextReady||!config)return
    const controller=new AbortController()
    void discoverResources(controller.signal).then(async resources=>{
      const options=(await Promise.all(resources.filter(v=>v.resourceType===config.type).map(async v=>{
        const decisions=await Promise.all(config.permissions.map(permissionCode=>consultAuthorization({permissionCode,resourceType:config.type,resourceId:v.resourceId},controller.signal)))
        const allowed=config.permissions.filter((_p,i)=>decisions[i])
        return allowed.length?{id:v.resourceId,label:v.label,path:config.path(v.resourceId,allowed)}:null
      }))).filter((v):v is Option=>v!==null).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'))
      if(!controller.signal.aborted)setSnapshot({account,key,options,error:false})
    }).catch(()=>{if(!controller.signal.aborted)setSnapshot({account,key,options:[],error:true})})
    return ()=>controller.abort()
  // The route key fully describes the immutable permission/path projection.
  },[account,contextReady,key,attempt])
  const ready=snapshot.account===account&&snapshot.key===key,options=ready?snapshot.options:[]
  const routeId=pathname.match(/\/(?:igrejas|denominacoes)\/([0-9a-f-]{36})(?:\/|$)/i)?.[1]??new URLSearchParams(search).get('igreja')??undefined
  const current=routeId??(config?.type==='CHURCH'?(selectedChurchId??defaultChurchId):null)??''
  useEffect(()=>{if(config?.type==='CHURCH'&&routeId&&options.some(v=>v.id===routeId))selectChurch?.(routeId)},[config?.type,routeId,options,selectChurch])
  if(!account||!contextReady||!config)return null
  if(!ready)return <div className="management-context" role="status">Carregando contexto de gestão…</div>
  if(snapshot.error)return <div className="management-context"><span role="alert">Não foi possível carregar os contextos autorizados.</span><button onClick={()=>setAttempt(v=>v+1)}>Tentar novamente</button></div>
  if(!options.length)return null
  const label=config.type==='CHURCH'?'Igreja':'Denominação'
  return <section className="management-context" aria-label="Contexto de gestão">{options.length===1&&options[0].id===current?<p><span>{label}</span><strong>{options[0].label}</strong></p>:<label>{label}<select aria-label={`${label} da gestão`} value={options.some(v=>v.id===current)?current:''} onChange={e=>{const option=options.find(v=>v.id===e.target.value);if(option)navigate(option.path)}}><option value="" disabled>Selecione {config.type==='CHURCH'?'a igreja':'a denominação'}</option>{options.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>}</section>
}
