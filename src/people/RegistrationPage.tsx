import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError } from '../api'
import { ResourceAccess } from '../authorization'
import { isUuid } from '../validation'
import { PersonForm, type PersonCreationResult } from './PersonViews'
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
  return <><h1>Cadastrar pessoa</h1><p>Cadastro com associação à igreja deste contexto, sem criar membresia ou conta.</p>
    <p>Cadastro sem associação à igreja indisponível enquanto a autorização global não estiver definida.</p>
    {!isUuid(churchId) ? <p role="alert">Contexto inválido. Abra um recurso autorizado.</p>
      : <ResourceAccess permissionCode="identity:person:contextual:create" resourceType="CHURCH" resourceId={churchId}>
        <Registration key={churchId}/>
      </ResourceAccess>}
  </>
}
