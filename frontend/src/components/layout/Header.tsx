function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
      <div className="flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-sm">
            F
          </div>
          <span className="text-lg font-semibold text-gray-800">FlowInsight AI</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 flex items-center justify-center text-xs font-bold text-white shadow-sm">
            U
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header