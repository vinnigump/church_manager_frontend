import { Link } from 'react-router-dom'
import { ResourceAccess } from '../authorization'
import type { AuditResource } from './audit-api'

export default function AuditLink({ denominationId, resourceType, resourceId }: { denominationId: string; resourceType: AuditResource; resourceId: string }) {
  return <ResourceAccess permissionCode="security:audit:read" resourceType="DENOMINATION" resourceId={denominationId} optional>
    <Link to={`/seguranca/denominacoes/${denominationId}/auditoria/${resourceType}/${resourceId}`}>Consultar auditoria deste recurso</Link>
  </ResourceAccess>
}
