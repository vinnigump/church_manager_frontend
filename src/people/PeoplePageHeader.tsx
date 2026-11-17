import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './people.css'
export default function PeoplePageHeader({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
return <header className="people-page-header"><nav aria-label="Navegação de Pessoas"><Link to="/pessoas">Pessoas</Link><span aria-hidden="true">/</span><span>{title}</span></nav><div className="people-heading-row"><div><h1 data-page-title={title}>{title}</h1><p>{description}</p></div>{children && <div className="people-header-actions">{children}</div>}</div></header>
}
