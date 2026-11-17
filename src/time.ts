export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo'
export const BRAZIL_OFFSET = '-03:00'
export function formatDateTime(value: string | Date, options: Intl.DateTimeFormatOptions = {}): string {
 return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',...options,timeZone:DEFAULT_TIME_ZONE,hourCycle:'h23'}).format(new Date(value))
}
export function wallTimeBR(instant: string): string {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:DEFAULT_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant))
 const part=(key:string)=>parts.find(p=>p.type===key)?.value??''
 return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`
}
export function brasilInstant(wall: string): string {return `${wall.length===16?wall+':00':wall}${BRAZIL_OFFSET}`}
export function inputDateTime(wall: string): string {
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,9})?)?$/.test(wall))return ''
 return `${wall.slice(8,10)}/${wall.slice(5,7)}/${wall.slice(0,4)} ${wall.slice(11)}`
}
export function parseInputDateTime(text: string): string {
 const iso=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d)(\.\d{1,9})?)?$/.exec(text)
 const br=/^(\d\d)\/(\d\d)\/(\d{4}) (\d\d):(\d\d)(?::(\d\d)(\.\d{1,9})?)?$/.exec(text)
 if(!iso&&!br)return ''
 const [y,m,d,h,min,sec]=iso?[iso[1],iso[2],iso[3],iso[4],iso[5],iso[6]??'00']:[br![3],br![2],br![1],br![4],br![5],br![6]??'00']
 const date=new Date(0);date.setUTCFullYear(+y,+m-1,+d);date.setUTCHours(+h,+min,+sec,0)
 if(+y<1||date.getUTCFullYear()!==+y||date.getUTCMonth()!==+m-1||date.getUTCDate()!==+d||date.getUTCHours()!==+h||date.getUTCMinutes()!==+min||date.getUTCSeconds()!==+sec)return ''
 return `${y}-${m}-${d}T${h}:${min}${text.length===16?'':':'+sec+(iso?.[7]??br?.[7]??'')}`
}

export function formatDate(value:string|Date):string {
 if(typeof value==='string' && /^\d{4}-\d\d-\d\d$/.test(value))return `${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}`
 return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:DEFAULT_TIME_ZONE}).format(new Date(value))
}
