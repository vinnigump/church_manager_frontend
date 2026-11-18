import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../api'
import { isUuid, isInstant } from '../validation'
interface Option { id: string; name: string; scope: string | null }
interface Options { endsAt?: string | null; accounts: Option[]; profiles: Option[]; units: Option[] }
export default function AssignmentGrantForm({ denominationId, delegationId, onGranted }: { denominationId: string; delegationId?: string; onGranted: () => void }) {
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<Options>()
  const [userId, setUserId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const base = `/security/denominations/${denominationId}/assignments`
  async function find(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setOptions(undefined); setUserId(''); setProfileId(''); setUnitId('')
    try {
      const result = await api.request<Options>(`${base}/options?search=${encodeURIComponent(search.trim())}${delegationId ? `&delegationId=${delegationId}` : ''}`)
      if (![result.accounts, result.profiles, result.units].every(items => Array.isArray(items) && items.every(item => typeof item.id === 'string' && isUuid(item.id) && typeof item.name === 'string' && item.name.trim().length > 0))) throw new Error('Resposta de acesso inválida.')
      if (result.endsAt != null && !isInstant(result.endsAt)) throw new Error('Vigência de acesso inválida.')
      setOptions(result)
      if (delegationId) { setProfileId(result.profiles[0]?.id ?? ''); setUnitId(result.units[0]?.id ?? '') }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível pesquisar.') } finally { setBusy(false) }
  }
  async function grant(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('')
    try {
      await api.request(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(delegationId ? { userId, delegationId, endsAt: options?.endsAt ?? null } : { userId, profileId, organizationUnitId: unitId }) }, 201)
      setSuccess('Acesso concedido.'); setOptions(undefined); setUserId(''); onGranted()
    } catch (failure) {
      const uncertain = !(failure instanceof ApiError) || failure.status === 0 || failure.status >= 500
      if (uncertain) { setBlocked(true); onGranted() }
      setError(uncertain ? 'Não foi possível confirmar a concessão. Confira as atribuições atualizadas antes de abrir uma nova concessão.' : failure.message)
    } finally { setBusy(false) }
  }
  const profile = options?.profiles.find(item => item.id === profileId)
  return <details><summary>Conceder acesso</summary>
    <p>Pesquise uma conta vinculada à igreja. As permissões e limites são validados pelo servidor.</p>
    <form onSubmit={find}><label>Nome da pessoa<input required minLength={2} maxLength={120} value={search} onChange={event => setSearch(event.target.value)}/></label><button disabled={busy}>Pesquisar contas</button></form>
    {options && <form onSubmit={grant}>
      {!options.accounts.length ? <p>Nenhuma conta ativa encontrada. O primeiro acesso deve ser concluído antes da concessão.</p> : <>
        <label>Pessoa<select required value={userId} onChange={event => setUserId(event.target.value)}><option value="">Selecione</option>{options.accounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Perfil<select required disabled={!!delegationId} value={profileId} onChange={event => { setProfileId(event.target.value); setUnitId('') }}><option value="">Selecione</option>{options.profiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Contexto<select required disabled={!!delegationId} value={unitId} onChange={event => setUnitId(event.target.value)}><option value="">Selecione</option>{options.units.filter(item => !profile || item.scope === profile.scope).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <p>Vigência: a partir da concessão{options.endsAt ? ' até o fim da fonte de delegação' : ', sem fim definido'}.</p>
        <button disabled={busy || blocked || !userId || !profileId || !unitId}>Confirmar concessão</button>
      </>}
    </form>}
    {error && <p role="alert">{error}</p>}{success && <p role="status">{success}</p>}
  </details>
}
