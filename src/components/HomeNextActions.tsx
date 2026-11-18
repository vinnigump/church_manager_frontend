import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { listMine } from '../tasks/work-item-api'
import { listOwnTrails } from '../trails/own-trail-api'
import { ReadResult, useRead } from '../security/SecurityPages'

export default function HomeNextActions() {
 const {account}=useAuth()
 const load=useCallback(async(signal:AbortSignal)=>{
  const [assigned,open,trails]=await Promise.allSettled([listMine(account!.id,0,'ASSIGNED',signal),listMine(account!.id,0,'OPEN',signal),listOwnTrails(0,signal)])
  return {tasks:[...(assigned.status==='fulfilled'?assigned.value.items:[]),...(open.status==='fulfilled'?open.value.items:[])].slice(0,3),trails:trails.status==='fulfilled'?trails.value.items.filter(v=>['IN_PROGRESS','NOT_STARTED','PAUSED'].includes(v.status)).slice(0,2):[],partial:[assigned,open,trails].some(v=>v.status==='rejected')}
 },[account])
 const query=useRead(account!.id,load)
 return <section className="home-next-actions"><h2>Seus próximos passos</h2><ReadResult query={query} label="próximas ações">{data=><>
  {data.partial&&<p>Parte do resumo não pôde ser atualizada. Seus acessos completos continuam nos atalhos abaixo.</p>}
  {data.tasks.length>0&&<ul>{data.tasks.map(v=><li key={v.id}><span>{v.state==='OPEN'?'Disponível para assumir':'Sua tarefa'}</span><Link to={`/minhas-tarefas/${v.id}`}>{v.title}</Link></li>)}</ul>}
  {data.trails.length>0&&<ul>{data.trails.map(v=><li key={v.id}><span>{v.completedTaskCount} de {v.taskCount} etapas concluídas</span><Link to={`/minhas-trilhas/${v.id}`}>Acompanhar {v.name}</Link></li>)}</ul>}
  {!data.partial&&!data.tasks.length&&!data.trails.length&&<p>Nenhuma atividade aparece neste resumo. Consulte suas tarefas e trilhas para ver todo o histórico.</p>}
  <p><Link to="/minhas-tarefas">Todas as minhas tarefas</Link> · <Link to="/minhas-trilhas">Todas as minhas trilhas</Link></p>
 </>}</ReadResult></section>
}
