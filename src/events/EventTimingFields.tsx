import { useState } from 'react'
import BrazilianDateTimeField from '../components/BrazilianDateTimeField'
import { brasilInstant } from '../time'
import { DEFAULT_DURATION_NS, HALF_HOUR_NS, durationLabel, endForDuration, eventDuration } from './event-duration'
import type { RecordFields } from './record-form'
import type { EventRecord } from './record-api'

export default function EventTimingFields({fields,before,change}:{fields:RecordFields;before:EventRecord|null;change:(fields:RecordFields)=>void}) {
 const duration=fields.durationNs??(fields.startsAt&&fields.endsAt?eventDuration(brasilInstant(fields.startsAt),brasilInstant(fields.endsAt)):DEFAULT_DURATION_NS)
 const standard=Array.from({length:48},(_,i)=>String(HALF_HOUR_NS*BigInt(i+1)))
 const [custom,setCustom]=useState(false),[error,setError]=useState('')
 const update=(start:string,next:string)=>{
  try{const endsAt=start?endForDuration(start,next,before?.startsAt):'';setError('');change({...fields,startsAt:start,endsAt,durationNs:next});return true}
  catch{setError('Confira a data de início e a duração informadas.');return false}
 }
 return <><div className="record-grid">
  <label>Início<BrazilianDateTimeField required step="1" value={fields.startsAt} disabled={Boolean(before?.recurrenceRuleId)} onChange={e=>update(e.target.value,duration)}/></label>
  <label>Duração<select required disabled={Boolean(before?.recurrenceRuleId)} value={custom?'custom':duration} onChange={e=>{if(e.target.value==='custom'){setCustom(true);return}setCustom(false);update(fields.startsAt,e.target.value)}}>
   {standard.map(v=><option key={v} value={v}>{durationLabel(v)}</option>)}
   {!standard.includes(duration)&&<option value={duration}>{durationLabel(duration)} · duração existente</option>}
   <option value="custom">Mais de 24 horas…</option>
  </select></label>
 </div>{custom&&<label>Duração em minutos<input required type="number" min="1470" step="30" disabled={Boolean(before?.recurrenceRuleId)} onChange={e=>{const minutes=Number(e.target.value);const valid=Number.isSafeInteger(minutes)&&minutes>=1470&&minutes%30===0;e.target.setCustomValidity(valid&&update(fields.startsAt,String(BigInt(minutes)*60_000_000_000n))?'':'Informe uma duração válida em intervalos de 30 minutos.')}}/></label>}
 {error&&<p role="alert">{error}</p>}<p>Horário de Brasília · 24 horas. A duração define automaticamente o término.</p></>
}
