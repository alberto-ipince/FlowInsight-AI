import { Link, useLocation } from 'react-router-dom'

function Sidebar() {
  const location = useLocation()

  const linkClass = (path: string) =>
    `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      location.pathname === path
        ? 'bg-blue-100 text-blue-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`

  return (
    <aside className="w-60 border-r border-gray-200 bg-white p-4">
      <nav className="space-y-1">
        <Link to="/" className={linkClass('/')}>
          🏠 Inicio
        </Link>
        <Link to="/preparation" className={linkClass('/preparation')}>
          📁 Preparación de Datos
        </Link>
        <Link to="/analytics" className={linkClass('/analytics')}>
          📊 Analytics
        </Link>
      </nav>
    </aside>
  )
}

export default Sidebar