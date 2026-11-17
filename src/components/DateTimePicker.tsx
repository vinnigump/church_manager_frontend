import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { inputDateTime, parseInputDateTime, wallTimeBR } from '../time'
import './date-time-picker.css'

const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const pad = (n: number) => String(n).padStart(2,'0')
function civilDate(year: number, month: number, day: number) {
 const date = new Date(0); date.setUTCFullYear(year,month,day); date.setUTCHours(0,0,0,0); return date
}
export default function DateTimePicker({ value, min, max, confirm, close }: {
 value: string; min?: string | number; max?: string | number; confirm: (value: string) => void; close: () => void
}) {
 const initial = parseInputDateTime(value) || wallTimeBR(new Date().toISOString()).slice(0,16)
 const [day,setDay] = useState(initial.slice(0,10)), [hour,setHour] = useState(initial.slice(11,13)), [minute,setMinute] = useState(initial.slice(14,16))
 const [month,setMonth] = useState(Number(initial.slice(5,7))-1), [year,setYear] = useState(Number(initial.slice(0,4)))
 const dialog = useRef<HTMLDialogElement>(null), title = useId()
 useEffect(() => {
  const node = dialog.current!, previous = document.activeElement
  if (typeof node.showModal === 'function') node.showModal(); else node.setAttribute('open','')
  return () => { if (node.open && typeof node.close === 'function') node.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
 }, [])
 const first = (civilDate(year,month,1).getUTCDay()+6)%7, count = civilDate(year,month+1,0).getUTCDate()
 const monthKey = `${String(year).padStart(4,'0')}-${pad(month+1)}`
 const candidate = `${day}T${hour}:${minute}${initial.slice(16)}`
 const valid = Boolean(parseInputDateTime(candidate)) && !(min && candidate < String(min)) && !(max && candidate > String(max))
 const move = (delta: number) => { const date = civilDate(year,month+delta,1); setYear(date.getUTCFullYear()); setMonth(date.getUTCMonth()) }
 const today = () => { const date = wallTimeBR(new Date().toISOString()); setDay(date.slice(0,10)); setYear(Number(date.slice(0,4))); setMonth(Number(date.slice(5,7))-1) }
 return createPortal(<dialog ref={dialog} className="br-datetime-dialog" aria-labelledby={title} onCancel={e=>{e.preventDefault();close()}}>
  <h2 id={title}>Selecionar data e hora</h2><p>Horário de Brasília · 24 horas</p>
  <div className="br-calendar-heading">
   <button type="button" aria-label="Mês anterior" disabled={year===1&&month===0} onClick={()=>move(-1)}>‹</button>
   <strong aria-live="polite">{months[month]} de {year}</strong>
   <button type="button" aria-label="Próximo mês" disabled={year===9999&&month===11} onClick={()=>move(1)}>›</button>
  </div>
  <div className="br-calendar-days" role="group" aria-label={`${months[month]} de ${year}`}>
   {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(v=><span className="br-weekday" key={v}>{v}</span>)}
   {Array.from({length:first},(_,i)=><span key={`blank${i}`} aria-hidden="true"/>)}
   {Array.from({length:count},(_,i)=>{const date=`${monthKey}-${pad(i+1)}`;return <button type="button" key={date} aria-label={`${i+1} de ${months[month].toLowerCase()} de ${year}`} aria-pressed={day===date} onClick={()=>setDay(date)}>{i+1}</button>})}
  </div>
  <div className="br-clock-fields"><label>Hora<select value={hour} onChange={e=>setHour(e.target.value)}>{Array.from({length:24},(_,i)=><option key={i}>{pad(i)}</option>)}</select></label><span aria-hidden="true">:</span><label>Minuto<select value={minute} onChange={e=>setMinute(e.target.value)}>{Array.from({length:60},(_,i)=><option key={i}>{pad(i)}</option>)}</select></label><button type="button" onClick={today}>Hoje</button></div>
  <output className="br-datetime-summary" aria-live="polite">{inputDateTime(candidate)}</output>
  {!valid&&<p role="status">Escolha um horário dentro do período permitido.</p>}
  <div className="br-datetime-actions"><button type="button" onClick={close}>Cancelar</button><button type="button" disabled={!valid} onClick={()=>confirm(candidate)}>Aplicar</button></div>
 </dialog>,document.body)
}
