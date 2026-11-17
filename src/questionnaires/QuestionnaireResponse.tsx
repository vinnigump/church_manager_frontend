import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ResourceAccess } from '../authorization'
import { grade, readApplication, saveApplication, type Answer, type Application, type Question } from './questionnaires-api'
import { gradePermission, questionnaireStatus, ResponseReadAccess, ScopedRead } from './shared'
import { useQuestionnaireCommand } from './useQuestionnaireCommand'
function AnswerField({ question: q, answer, change, disabled }: { question: Question; answer: Answer; change: (value: Answer) => void; disabled: boolean }) {
  return <fieldset className="questionnaire-answer-card" disabled={disabled}><legend>{q.statement}</legend>
    {q.type === 'MULTIPLE_CHOICE' ? q.options.map(o => <label key={o.id}><input type="checkbox" checked={answer.optionIds.includes(o.id)} onChange={e => change({ ...answer, optionIds: e.target.checked ? [...answer.optionIds, o.id] : answer.optionIds.filter(v => v !== o.id) })}/>{o.label}</label>)
      : q.type === 'TEXT' ? <label>Resposta<textarea required maxLength={10000} value={answer.value ?? ''} onChange={e => change({ ...answer, value: e.target.value })}/></label>
        : q.type === 'SCALE' ? <label>Resposta entre {q.scaleMin} e {q.scaleMax}<input required type="number" step="1" min={q.scaleMin ?? undefined} max={q.scaleMax ?? undefined} value={answer.value ?? ''} onChange={e => change({ ...answer, value: e.target.value || null })}/></label>
          : <label>Resposta<select required value={answer.value ?? ''} onChange={e => change({ ...answer, value: e.target.value || null })}><option value="">Selecione</option><option value="true">Verdadeiro</option><option value="false">Falso</option></select></label>}
  </fieldset>
}
function AnswersView({ value }: { value: Application }) {
  return <>{value.questionnaire.questions.map(q => {
    const answer = value.answers.find(v => v.questionId === q.id)
    return <section className="questionnaire-answer-card" key={q.id}><h3>{q.statement}</h3><p>{q.type === 'MULTIPLE_CHOICE' ? (answer?.optionIds.map(id => q.options.find(o => o.id === id)?.label).join(', ') || 'Sem resposta') : q.type === 'TRUE_FALSE' ? answer?.value === 'true' ? 'Verdadeiro' : answer?.value === 'false' ? 'Falso' : 'Sem resposta' : answer?.value || 'Sem resposta'}</p>
      {value.feedbackReady && <>{answer?.score !== null && answer?.score !== undefined && <p>Nota: {answer.score}</p>}{answer?.feedback && <p>Devolutiva: {answer.feedback}</p>}</>}
      {value.answerKeyAvailable && q.evaluated && q.type !== 'TEXT' && <p>Gabarito: {q.type === 'MULTIPLE_CHOICE' ? q.options.filter(v => v.correct === true).map(v => v.label).join(', ') : q.type === 'TRUE_FALSE' ? q.correctBoolean === true ? 'Verdadeiro' : 'Falso' : q.correctScale}</p>}
    </section>
  })}</>
}
function Correction({ church, value, completed, reportBusy }: { church: string; value: Application; completed: () => void; reportBusy: (busy: boolean) => void }) {
  const command = useQuestionnaireCommand(), [selected, setSelected] = useState(''), [score, setScore] = useState(''), [feedback, setFeedback] = useState('')
  useEffect(() => { reportBusy(command.busy); return () => reportBusy(false) }, [reportBusy, command.busy])
  const questions = value.questionnaire.questions.filter(q => q.evaluated && q.type === 'TEXT' && value.answers.some(a => a.questionId === q.id && a.score === null))
  if (value.status !== 'SUBMITTED' || !questions.length) return null
  return <ResourceAccess permissionCode={gradePermission} resourceType="CHURCH" resourceId={church} optional preserveDuringRecheck><h3>Corrigir resposta de texto</h3>{command.message && <p role="alert">{command.message}</p>}<form onSubmit={e => { e.preventDefault(); if (!selected || score === '' || !Number.isFinite(Number(score)) || Number(score) < 0 || Number(score) > 100) return; void command.run(signal => grade(church, value, selected, Number(score), feedback, signal), completed) }}><fieldset disabled={command.busy || command.blocked}><label>Pergunta<select required value={selected} onChange={e => setSelected(e.target.value)}><option value="">Selecione</option>{questions.map(q => <option key={q.id} value={q.id}>{q.statement}</option>)}</select></label><label>Nota de 0 a 100<input required type="number" min="0" max="100" step="0.001" value={score} onChange={e => setScore(e.target.value)}/></label><label>Devolutiva<textarea maxLength={2000} value={feedback} onChange={e => setFeedback(e.target.value)}/></label><button>Salvar correção</button></fieldset></form></ResourceAccess>
}
function Loaded({ church, initial, staff, reload }: { church: string; initial: Application; staff: boolean; reload: () => void }) {
  const [before, setBefore] = useState(initial), [answers, setAnswers] = useState<Answer[]>(initial.answers), [notice, setNotice] = useState(''), [correctionBusy, setCorrectionBusy] = useState(false)
  const command = useQuestionnaireCommand(), stale = initial.revision !== before.revision
  function valueFor(q: Question): Answer { return answers.find(a => a.questionId === q.id) ?? { questionId: q.id, value: null, optionIds: [], score: null, feedback: null } }
  function change(value: Answer) { setAnswers(v => [...v.filter(a => a.questionId !== value.questionId), value]); setNotice('') }
  const editable = !staff && before.status === 'STARTED'
  return <><h2>{before.questionnaire.name}</h2><p>Versão {before.questionnaire.versionNumber} · {questionnaireStatus(before.status)}</p><p>{before.questionnaire.attemptLimit === null ? 'Tentativas ilimitadas.' : `Limite: ${before.questionnaire.attemptLimit} tentativa(s) neste questionário, incluindo versões anteriores.`} {before.questionnaire.minimumScore === null ? 'Sem nota mínima.' : `Nota mínima: ${before.questionnaire.minimumScore}.`}</p>
    {before.score !== null && <p>Nota: {before.score}</p>}{before.taskInstanceId && <p>Resposta vinculada à etapa de uma trilha. <Link to="/minhas-trilhas">Voltar às minhas trilhas</Link></p>}
    {command.message && <p role="alert">{command.message}</p>}{notice && <p role="status">{notice}</p>}{stale && <p role="alert">A resposta mudou. Recarregue antes de continuar.</p>}
    <button disabled={command.busy || correctionBusy} onClick={reload}>{editable ? 'Descartar alterações e recarregar resposta' : 'Atualizar resposta'}</button>
    {editable ? <form onSubmit={e => { e.preventDefault(); if (before.questionnaire.questions.some(q => { const a = valueFor(q); return q.type === 'MULTIPLE_CHOICE' ? !a.optionIds.length : !a.value?.trim() })) { setNotice('Responda todas as perguntas antes de enviar.'); return } if (!stale) void command.run(signal => saveApplication(church, before, answers, true, signal), v => { setBefore(v); setAnswers(v.answers); setNotice(v.questionnaire.minimumScore === null ? 'Resposta enviada. O envio conclui o requisito desta etapa, quando vinculada.' : 'Resposta enviada. A conclusão depende da nota mínima após a correção.'); reload() }) }}>
      {before.questionnaire.questions.map(q => <AnswerField key={q.id} question={q} answer={valueFor(q)} change={change} disabled={command.busy || command.blocked || stale}/>)}
      <button type="button" disabled={command.busy || command.blocked || stale} onClick={() => void command.run(signal => saveApplication(church, before, answers, false, signal), v => { setBefore(v); setAnswers(v.answers); setNotice('Rascunho salvo. Você pode retomar depois.'); reload() })}>Salvar rascunho</button> <button disabled={command.busy || command.blocked || stale}>Enviar respostas</button><p>Após enviar, as respostas não poderão ser editadas.</p>
    </form> : <><AnswersView value={before}/>{before.status === 'SUBMITTED' && <p>A resposta foi enviada e aguarda correção. {before.questionnaire.minimumScore === null ? 'Não há nota mínima para concluir a etapa vinculada.' : 'A etapa vinculada exige a nota mínima.'}</p>}{staff && !stale && <Correction church={church} value={before} completed={reload} reportBusy={setCorrectionBusy}/>}</>}
  </>
}
export default function QuestionnaireResponse({ church, applicationId, staff }: { church: string; applicationId: string; staff: boolean }) {
  const [epoch, setEpoch] = useState(0), load = useCallback((signal: AbortSignal) => readApplication(church, applicationId, staff, signal), [church, applicationId, staff])
  const content = <ScopedRead context={`${church}:${applicationId}:${staff}:${epoch}`} load={load} refresh={false} label="resposta do questionário">{value => <Loaded key={`${value.id}:${epoch}`} church={church} initial={value} staff={staff} reload={() => setEpoch(v => v + 1)}/>}</ScopedRead>
  return staff ? <ResponseReadAccess church={church}>{content}</ResponseReadAccess> : content
}
