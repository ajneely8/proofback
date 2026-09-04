import { NavLink } from 'react-router-dom'
import { IconHome, IconList, IconTarget, IconUser } from './Icons.jsx'

const tabs = [
  { to: '/', label: 'Home', Icon: IconHome, end: true },
  { to: '/purchases', label: 'Purchases', Icon: IconList },
  { to: '/opportunities', label: 'Opportunities', Icon: IconTarget },
  { to: '/profile', label: 'Profile', Icon: IconUser },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => 'bottom-nav__item' + (isActive ? ' is-active' : '')}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
