import { NavLink, useLocation } from 'react-router-dom'
import { IconHome, IconCamera, IconSearch, IconBell, IconUser } from './Icons.jsx'

const leftTabs = [
  { to: '/add', label: 'Scan Receipt', Icon: IconCamera },
  { to: '/price-finder', label: 'Price Finder', Icon: IconSearch },
]

const rightTabs = [
  { to: '/alerts', label: 'Protection', Icon: IconBell },
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
  const { pathname } = useLocation()
  // The center slot used to duplicate the left "Scan Receipt" tab — now
  // that scanning has its own tab, this takes over as the way back to the
  // dashboard + full purchase list (merged into Home.jsx, see that file).
  // "/purchases" renders the same merged component (kept as a route so
  // existing /purchases?filter=... links still work), so it counts as
  // "home" here too — a plain NavLink `end` match would only catch "/".
  const isHomeActive = pathname === '/' || pathname === '/purchases'

  return (
    <nav className="bottom-nav">
      {leftTabs.map((tab) => (
        <Tab key={tab.to} {...tab} />
      ))}
      <NavLink to="/" className={'bottom-nav__scan' + (isHomeActive ? ' is-active' : '')} aria-label="Home">
        <IconHome width={24} height={24} />
      </NavLink>
      {rightTabs.map((tab) => (
        <Tab key={tab.to} {...tab} />
      ))}
    </nav>
  )
}
