import { Link, type LinkProps } from 'react-router-dom'
import './item-link.css'

/** Primary navigation fills the containing card; secondary controls remain independent. */
export default function ItemLink({ className = '', ...props }: LinkProps) {
  return <Link {...props} className={`item-primary-link ${className}`.trim()}/>
}
