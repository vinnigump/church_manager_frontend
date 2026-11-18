import { brasilInstant, wallTimeBR } from '../time'

export const HALF_HOUR_NS = 1800_000_000_000n
export const DEFAULT_DURATION_NS = String(HALF_HOUR_NS * 2n)
function nanos(value: string): bigint {
 const match = /^(.*:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value)
 if (!match) throw new Error('Data e hora inválidas.')
 const ms = Date.parse(match[1]+match[3])
 if (!Number.isFinite(ms)) throw new Error('Data e hora inválidas.')
 return BigInt(ms)*1_000_000n + BigInt((match[2]??'').padEnd(9,'0'))
}
export function eventDuration(start: string, end: string): string {
 const duration = nanos(end)-nanos(start)
 if (duration<=0n) throw new Error('A duração deve ser maior que zero.')
 return String(duration)
}
export function durationLabel(duration: string): string {
 let ns=BigInt(duration)
 const units: [bigint,string][]=[[86400_000_000_000n,'dia'],[3600_000_000_000n,'h'],[60_000_000_000n,'min']]
 const parts:string[]=[]
 for (const [size,label] of units) {const count=ns/size;ns%=size;if(count)parts.push(`${count} ${label==='dia'&&count>1n?'dias':label}`)}
 if(ns)parts.push(`${String(ns/1_000_000_000n)}${ns%1_000_000_000n?'.'+String(ns%1_000_000_000n).padStart(9,'0').replace(/0+$/,''):''} s`)
 return parts.join(' ') || '0 min'
}
export function eventDurationLabel(start:string,end:string):string {
 return durationLabel(eventDuration(start,end))
}
export function endForDuration(startWall:string,duration:string,originalStart?:string):string {
 const start=originalStart && wallTimeBR(originalStart)===startWall ? originalStart : brasilInstant(startWall)
 const ns=nanos(start)+BigInt(duration), seconds=ns>=0n?ns/1_000_000_000n:(ns-999_999_999n)/1_000_000_000n, fraction=ns-seconds*1_000_000_000n
 const date=new Date(Number(seconds)*1000)
 if(!Number.isFinite(date.getTime()))throw new Error('Duração fora do período permitido.')
 const instant=date.toISOString().slice(0,19)+(fraction?'.'+String(fraction).padStart(9,'0').replace(/0+$/,''):'')+'Z'
 return wallTimeBR(instant)+(fraction?'.'+String(fraction).padStart(9,'0').replace(/0+$/,''):'')
}
