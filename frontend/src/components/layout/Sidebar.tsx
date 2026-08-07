import { Link, useLocation } from 'react-router-dom'

function Sidebar() {
  const location = useLocation()

  const linkClass = (path: string) =>
    `sidebar-link ${location.pathname === path ? 'sidebar-link-active' : 'sidebar-link-inactive'}`

  return (
    <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="border-b border-gray-100 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-bold text-white shadow-md">
            F
          </div>
          <div>
            <p className="text-base font-bold text-gray-800">FlowInsight AI</p>
            <p className="text-xs text-gray-400">AI Powered Analytics</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Principal
        </p>
        <Link to="/" className={linkClass('/')}>
          <span className="text-lg">🏠</span>
          <span>Inicio</span>
        </Link>

        <p className="mb-2 mt-5 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Datos
        </p>
        <Link to="/preparation" className={linkClass('/preparation')}>
          <span className="text-lg">📁</span>
          <span>Preparación de Datos</span>
        </Link>
        <Link to="/analytics" className={linkClass('/analytics')}>
          <span className="text-lg">📊</span>
          <span>Analytics</span>
        </Link>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 px-5 py-4">
        <p className="text-xs text-gray-400">
          © 2026 FlowInsight AI
        </p>
      </div>
    </aside>
  )
}

export default Sidebar