import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { Pagination, ReadResult, useRead } from '../security/SecurityPages'
import { readOccurrenceSpace, readPlanningOverlaps, type PlanningOutcome } from './planning-api'
import './events.css'
import './planning.css'

const outcomeLabel: Record<PlanningOutcome, string> = {
  OUTSIDE_SCOPE: 'Fora do escopo', UNDETERMINED: 'Indeterminado', NONE: 'Sem sobreposições identificadas',
  PREVENTIVE: 'Alerta preventivo de planejamento', MODERATE: 'Sobreposição moderada', CRITICAL: 'Sobreposição crítica',
}
function PlanningRecords({ churchId, occurrenceId }: { churchId: string; occurrenceId: string }) {
  const [page, setPage] = useState(0)
  const load = useCallback(async (signal: AbortSignal) => {
    const [space, assessment] = await Promise.all([readOccurrenceSpace(churchId, occurrenceId, signal), readPlanningOverlaps(churchId, occurrenceId, page, signal)])
    return { space, assessment }
  }, [churchId, occurrenceId, page])
  const query = useRead(`${churchId}:${occurrenceId}:${page}`, load)
  return <ReadResult query={query} label="planejamento">{({ space, assessment }) => <>
    <section aria-labelledby="planning-space"><h2 id="planning-space">Espaço da ocorrência</h2>
      <p>{space.label}</p><dl><dt>Código exato na igreja</dt><dd>{space.code ?? 'Não definido'}</dd><dt>Nome de exibição</dt><dd>{space.name ?? 'Não informado'}</dd><dt>Revisão consultada</dt><dd>{space.revision}</dd></dl>
      <p>O código diferencia maiúsculas e minúsculas. O nome serve somente para exibição. Esta tela não mantém cadastro de locais.</p>
    </section>
    <section aria-labelledby="planning-assessment"><h2 id="planning-assessment">Avaliação global do planejamento</h2>
      <p className="planning-outcome" role="status" data-outcome={assessment.outcome}>{outcomeLabel[assessment.outcome]}</p>
      <p>O resumo cobre todas as páginas, não apenas os candidatos visíveis. Limite informado pelo servidor: {assessment.limitSeconds} segundos.</p>
      {assessment.hasUnresolvedSpaces && <p role="note">Há espaços indefinidos na avaliação. Resultado vazio ou zero candidatos não comprova ausência de conflitos nem disponibilidade.</p>}
      {assessment.outcome === 'PREVENTIVE' && <p>Sobreposição envolvendo rascunho gera alerta preventivo. O rascunho não cria reserva, bloqueio ou exigência de exceção.</p>}
      {assessment.outcome === 'NONE' && <p>Nenhuma sobreposição identificada nesta consulta; isso não confirma disponibilidade, reserva ou autorização de publicação.</p>}
      <p>As consultas de espaço e sobreposições são independentes. Uma alteração concorrente pode ocorrer entre elas; atualize para consultar novamente. O servidor deve reavaliar no momento de qualquer operação futura.</p>
    </section>
    <section aria-labelledby="planning-candidates"><h2 id="planning-candidates">Candidatos sobrepostos</h2><p>Página {assessment.page + 1} · {assessment.total} candidatos.</p>
      {assessment.items.length ? <ul className="event-list">{assessment.items.map(v => <li key={v.occurrenceId}><h3>Ocorrência {v.occurrenceId}</h3>
        <p>Estado registrado: {v.status}</p><p>{outcomeLabel[v.outcome]}</p>
        <p>Início: <time dateTime={v.startsAt}>{v.startsAt}</time><br/>Término: <time dateTime={v.endsAt}>{v.endsAt}</time></p>
        <p>Interseção (duração ISO 8601): {v.overlap ?? 'Indeterminada por espaço não definido'}</p>
      </li>)}</ul> : <p>Nenhum candidato nesta página. Consulte o resumo global e os avisos de espaços indefinidos.</p>}
      <Pagination page={page} total={assessment.total} setPage={setPage} label="Páginas dos candidatos sobrepostos"/>
    </section>
  </>}</ReadResult>
}
export default function PlanningPage() {
  const { churchId = '', occurrenceId = '' } = useParams()
  const { account } = useAuth()
  return <div className="planning"><h1 data-page-title="Espaço e sobreposições">Espaço e sobreposições de planejamento</h1><Link to="/eventos">Voltar a Eventos</Link>
    <p>Consulta administrativa de registros guardados. Não confirma ocupação operacional, reserva ou decisão de publicar. Não concede permissão para ignorar conflitos.</p>
    {!isUuid(churchId) || !isUuid(occurrenceId) ? <p role="alert">O acesso ao planejamento é inválido. Abra novamente o acesso autorizado da ocorrência.</p> :
      <ResourceAccess permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={churchId}>
        <p><Link to={`/eventos/igrejas/${churchId}/catalogo`}>Catálogo da igreja</Link></p>
        <PlanningRecords key={`${account?.id}:${churchId}:${occurrenceId}`} churchId={churchId} occurrenceId={occurrenceId}/>
      </ResourceAccess>}
  </div>
}
