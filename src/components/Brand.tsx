import rioLogo from '../assets/rio-logo.png'

export default function Brand() {
  return <span className="app-brand">
    <img src={rioLogo} alt="RIO" width={1108} height={505} />
    <span className="app-brand-name">Church Manager</span>
  </span>
}
