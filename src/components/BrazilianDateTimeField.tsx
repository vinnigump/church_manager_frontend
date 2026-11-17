import {useEffect,useRef,useState,type InputHTMLAttributes} from 'react'
import {inputDateTime,parseInputDateTime} from '../time'
import DateTimePicker from './DateTimePicker'
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'type'|'value'|'onChange'> & {value:string;onChange:(event:{target:{value:string}})=>void}
function masked(text:string){
 if(!/^[\d /:]*$/.test(text))return text
 const digits=text.replace(/\D/g,'');if(digits.length>14)return text
 let result=digits.slice(0,2)
 if(digits.length>2)result+='/'+digits.slice(2,4)
 if(digits.length>4)result+='/'+digits.slice(4,8)
 if(digits.length>8)result+=' '+digits.slice(8,10)
 if(digits.length>10)result+=':'+digits.slice(10,12)
 if(digits.length>12)result+=':'+digits.slice(12,14)
 return result
}
/** Explicit Brazilian text entry avoids browser/OS AM-PM widgets. Values remain ISO wall times for existing form adapters. */
export default function BrazilianDateTimeField({value,onChange,min,max,...props}:Props){
 const [edit,setEdit]=useState({source:value,text:inputDateTime(value)})
 const input=useRef<HTMLInputElement>(null)
 const [open,setOpen]=useState(false)
 if(value!==edit.source)setEdit({source:value,text:inputDateTime(value)})
 useEffect(()=>{const parsed=parseInputDateTime(edit.text);const outside=parsed&&((min&&parsed<String(min))||(max&&parsed>String(max)));input.current?.setCustomValidity(edit.text&&(!parsed||outside)?'Informe uma data válida e o horário de 00 a 23, no formato dd/mm/aaaa hh:mm.':'')},[edit.text,min,max])
 return <span className="br-datetime-field"><input {...props} ref={input} type="text" inputMode="numeric" placeholder={props.placeholder??'dd/mm/aaaa hh:mm'} aria-description="Horário de Brasília, em formato de 24 horas." value={edit.text} onChange={e=>{const text=masked(e.target.value),normalized=parseInputDateTime(text);e.target.setCustomValidity(text&&!normalized?'Informe uma data e hora válidas, no formato dd/mm/aaaa hh:mm.':'');setEdit({source:normalized,text});onChange({target:{value:normalized}})}} onBlur={e=>{const normalized=parseInputDateTime(edit.text);if(normalized)setEdit({source:value,text:inputDateTime(normalized)});props.onBlur?.(e)}}/><button className="br-datetime-trigger" type="button" aria-label="Abrir calendário de data e hora" aria-haspopup="dialog" disabled={props.disabled||props.readOnly} onClick={()=>setOpen(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/></svg></button>{open&&!props.disabled&&!props.readOnly&&<DateTimePicker value={value} min={min} max={max} close={()=>setOpen(false)} confirm={next=>{setEdit({source:next,text:inputDateTime(next)});onChange({target:{value:next}});setOpen(false)}}/>}</span>
}
