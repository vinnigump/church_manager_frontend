import EventEditorReadAccess from './EventEditorReadAccess'
import { formatDateTime } from '../time'
import './stitch-events.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { useRead, ReadResult } from '../security/SecurityPages'
import { isUuid } from '../validation'
import { readPublicSetting, togglePublicSetting, visitorOption, registerVisitor, type PublicSetting, type VisitorInput, type VisitorConfirmation } from './visitor-api'
export default function VisitorRegistrationPage() {
 const { churchId='',occurrenceId='' }=useParams()
 return !isUuid(churchId)||!isUuid(occurrenceId)?<p role="alert">Endereço de evento inválido.</p>:<VisitorForm key={`${churchId}:${occurrenceId}`} church={churchId} event={occurrenceId}/>
}
function VisitorForm({church,event}:{church:string;event:string}) {
 const {account}=useAuth(), load=useCallback((signal:AbortSignal)=>visitorOption(church,event,signal),[church,event]), query=useRead(JSON.stringify([church,event]),load)
 const [fullName,setName]=useState(''),[birthDate,setBirth]=useState(''),[cpf,setCpf]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState('')
 const [frozen,setFrozen]=useState<VisitorInput|null>(null),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState<VisitorConfirmation|null>(null)
 const pending=useRef<AbortController|null>(null)
 useEffect(()=>()=>pending.current?.abort(),[])
 async function submit(){
  if(pending.current||done||blocked)return
  const input=frozen??{requestId:crypto.randomUUID(),person:{fullName:fullName.trim(),birthDate,cpf:cpf.trim()||null,email:email.trim()||null,phone:phone.trim()||null}}
  if(!input.person.email&&!input.person.phone){setMessage('Informe e-mail ou telefone.');return}
  setFrozen(input);const controller=new AbortController();pending.current=controller;setBusy(true);setMessage('')
  try{const result=await registerVisitor(church,event,input,controller.signal);if(!controller.signal.aborted){setDone(result);setFrozen(null);setName('');setBirth('');setCpf('');setEmail('');setPhone('')}}
  catch(error){if(!controller.signal.aborted){const rejected=error instanceof ApiError&&[400,401,403,404,409,422].includes(error.status);if(rejected){setBlocked(true);setMessage('Inscrição indisponível. Confira os dados com a equipe da igreja antes de iniciar outra solicitação.')}else setMessage('Não foi possível confirmar o resultado. Você pode repetir a mesma solicitação abaixo; os dados ficarão preservados para evitar duplicidade.')}}
  finally{pending.current=null;if(!controller.signal.aborted)setBusy(false)}
 }
 return <section className="events-panel visitor-registration"><h1 data-page-title="Inscrição pública">Inscrição pública</h1>
 {done?<><p role="status">Sua inscrição está confirmada. Ela não representa presença nem membresia.</p>{done.firstAccess?<><p>Crie seu acesso para acompanhar a inscrição. Este link é individual e só pode ser utilizado uma vez.</p><Link to={done.firstAccess.relativeUrl}>Criar meu acesso</Link><p>Válido até {formatDateTime(done.firstAccess.expiresAt)}.</p></>:<p>A solicitação já havia sido concluída. Use o link de primeiro acesso recebido anteriormente ou procure a equipe para receber outro.</p>}</>:account?<><p>Você já está conectado. Use a inscrição vinculada ao seu cadastro.</p><Link to={`/eventos/participar/igrejas/${church}`}>Participar com meu cadastro</Link></>:<ReadResult query={query} label="evento público">{value=><><h2>{value.name}</h2><p>{formatDateTime(value.startsAt)} (horário de Brasília)</p><p>Para quem ainda não possui cadastro. Se você já tem cadastro, entre com sua conta ou procure a equipe. Não informe dados de outra pessoa.</p><Link to="/entrar">Já tenho acesso</Link>
 <form onSubmit={e=>{e.preventDefault();void submit()}}><fieldset disabled={busy||blocked||frozen!==null}><legend>Meus dados</legend>
 <label>Nome completo<input required maxLength={180} autoComplete="name" value={fullName} onChange={e=>setName(e.target.value)}/></label>
 <label>Nascimento<input required type="date" autoComplete="bday" value={birthDate} onChange={e=>setBirth(e.target.value)}/></label>
 <label>CPF (opcional)<input maxLength={20} value={cpf} onChange={e=>setCpf(e.target.value)}/></label>
 <label>E-mail<input type="email" maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>Telefone<input type="tel" maxLength={30} autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
 <p>Informe pelo menos um contato. Este formulário atende maiores de 18 anos; para menores, procure a equipe.</p><button>Confirmar minha inscrição</button></fieldset></form>
 {frozen&&!busy&&!blocked&&<button onClick={()=>void submit()}>Repetir a mesma solicitação</button>}
 </>}</ReadResult>}{busy&&<p role="status">Confirmando inscrição…</p>}{message&&<p role="alert">{message}</p>}
 </section>
}
export function PublicRegistrationSettingsPage(){
 const {churchId='',occurrenceId=''}=useParams()
 return <section className="visitor-registration"><h1 data-page-title="Inscrição pública">Inscrição sem cadastro prévio</h1>{!isUuid(churchId)||!isUuid(occurrenceId)?<p role="alert">Evento inválido.</p>:<EventEditorReadAccess church={churchId}><Settings key={`${churchId}:${occurrenceId}`} church={churchId} event={occurrenceId}/></EventEditorReadAccess>}</section>
}
function Settings({church,event}:{church:string;event:string}){
 const [epoch,setEpoch]=useState(0),[busy,setBusy]=useState(false),[attempted,setAttempted]=useState(false),[message,setMessage]=useState('')
 const pending=useRef<AbortController|null>(null);useEffect(()=>()=>pending.current?.abort(),[])
 const load=useCallback((signal:AbortSignal)=>readPublicSetting(church,event,signal),[church,event]),query=useRead(JSON.stringify([church,event,epoch]),load)
 async function toggle(before:PublicSetting){if(pending.current||attempted)return;const controller=new AbortController();pending.current=controller;setBusy(true);setAttempted(true)
 try{await togglePublicSetting(church,event,before,controller.signal);if(!controller.signal.aborted){setMessage('Configuração atualizada.');setEpoch(v=>v+1)}}catch{if(!controller.signal.aborted)setMessage('Não foi possível confirmar a alteração. Consulte a configuração antes de repetir.')}finally{pending.current=null;if(!controller.signal.aborted)setBusy(false)}}
 return <><Link to={`/eventos/igrejas/${church}/cadastro/${event}`}>Voltar ao evento</Link><p>Pessoas sem cadastro poderão se inscrever como visitantes. Isso não cria membresia nem registra presença.</p>
 <button disabled={busy} onClick={()=>{setAttempted(false);setMessage('');setEpoch(v=>v+1)}}>Consultar configuração</button><ReadResult query={query} label="configuração pública">{v=><><p>Inscrição sem cadastro: {v.enabled?'habilitada':'desabilitada'}.</p>{!v.compatible&&<p>Para habilitar, o evento deve exigir inscrição e ter audiência pública sem restrições de vínculo ou grupos.</p>}
 <ResourceAccess permissionCode="EVENT_EDIT" resourceType="CHURCH" resourceId={church} optional preserveDuringRecheck><button disabled={busy||attempted||(!v.enabled&&!v.compatible)} onClick={()=>void toggle(v)}>{v.enabled?'Desabilitar':'Habilitar'} inscrição sem cadastro</button></ResourceAccess>
 {v.enabled&&<label>Link para compartilhar<input readOnly onFocus={e=>e.target.select()} value={`${window.location.origin}/eventos-publicos/igrejas/${church}/eventos/${event}/inscricao`}/></label>}</>}</ReadResult>{busy&&<p role="status">Salvando…</p>}{message&&<p role="status">{message}</p>}</>
}
