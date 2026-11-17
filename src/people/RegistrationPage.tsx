import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { PersonForm, type PersonCreationResult } from './PersonViews'
import PeoplePageHeader from './PeoplePageHeader'
import { registerPerson, type RegistrationDraft } from './registration-api'

function Registration() {
  const { churchId = '' } = useParams()
  const request = useRef<AbortController | null>(null)
  const [denied, setDenied] = useState(false)
  useEffect(() => () => request.current?.abort(), [])
  async function submit(draft: RegistrationDraft): Promise<PersonCreationResult> {
    const controller = new AbortController()
    request.current = controller
    try {
      const person = await registerPerson(draft, churchId, controller.signal)
      if (controller.signal.aborted) return { kind: 'error' }
      return { kind: 'confirmed', person }
    } catch (error) {
      if (!controller.signal.aborted && error instanceof ApiError && error.status === 403) setDenied(true)
      return { kind: error instanceof ApiError && error.status === 409 ? 'conflict' : 'error' }
    }
  }
  return denied ? <p role="alert">Acesso indisponível. Os dados deste contexto foram descartados.</p> : <PersonForm administrative onSubmit={submit}/>
}

export default function RegistrationPage() {
  const { churchId = '' } = useParams()
  return <div className="people-page"><PeoplePageHeader title="Cadastrar pessoa" description="Identificação básica e dados de contato da pessoa nesta igreja."/><Link className="people-back-link" to="/pessoas">← Voltar a Pessoas</Link><div className="people-form-layout"><aside className="people-context-card"><span className="people-card-eyebrow">Sobre o cadastro</span><h2>Um registro, diferentes vínculos</h2><p>O cadastro associa a pessoa à igreja deste contexto.</p><p>A conta de acesso e a membresia são etapas independentes.</p></aside>
    {!isUuid(churchId) ? <p role="alert">Contexto inválido. Abra um recurso autorizado.</p>
      : <ResourceAccess preserveDuringRecheck permissionCode="identity:person:contextual:create" resourceType="CHURCH" resourceId={churchId}>
        <Registration key={churchId}/>
      </ResourceAccess>}
  </div></div>
}
