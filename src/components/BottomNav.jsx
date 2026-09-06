import { NavLink } from 'react-router-dom'
import { IconHome, IconList, IconCamera, IconBell, IconUser } from './Icons.jsx'

const leftTabs = [
  { to: '/', label: 'Home', Icon: IconHome, end: true },
  { to: '/purchases', label: 'Purchases', Icon: IconList },
]

const rightTabs = [
  { to: '/alerts', label: 'Alerts', Icon: IconBell },
  { to: '/profile', label: 'Profile', Icon: IconUser },
]

function Tab({ to, label, Icon, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => 'bottom-nav__item' + (isActive ? ' is-active' : '')}>
      <Icon />
      <span>{label}</span>
    </NavLink>
  )
}

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {leftTabs.map((tab) => (
        <Tab key={tab.to} {...tab} />
      ))}
      <NavLink
        to="/add"
        className={({ isActive }) => 'bottom-nav__scan' + (isActive ? ' is-active' : '')}
        aria-label="Scan Receipt"
      >
        <IconCamera width={24} height={24} />
      </NavLink>
      {rightTabs.map((tab) => (
        <Tab key={tab.to} {...tab} />
      ))}
    </nav>
  )
}
