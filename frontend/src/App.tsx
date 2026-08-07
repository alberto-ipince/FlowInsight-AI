import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, Link } from 'react-router-dom'
import { ActiveDatasetProvider } from '@/contexts/ActiveDatasetContext'
import MainLayout from '@/layouts/MainLayout'
import AnalyticsPage from '@/pages/AnalyticsPage'
import DataPreparationPage from '@/pages/DataPreparationPage'
import { getHealth } from '@/services/healthService'

function HomePage() {
  return (
    <div className="animate-fade-in space-y-16 py-12">
      {/* Hero */}
      <section className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900">
          Analiza tus datos con{' '}
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Inteligencia Artificial
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-500">
          Sube tus datos, limpia, analiza y visualiza con dashboards inteligentes
          generados automáticamente por IA. Sin código, sin configuraciones complejas.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            to="/preparation"
            className="btn-primary inline-flex items-center gap-2 px-6 py-3"
          >
            🚀 Comenzar
          </Link>
          <Link
            to="/analytics"
            className="btn-secondary inline-flex items-center gap-2 px-6 py-3"
          >
            📊 Ver Analytics
          </Link>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="card-hover rounded-xl border border-gray-200 bg-white p-8 shadow-md">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl">
            ⚡
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-800">ETL Inteligente</h3>
          <p className="text-sm leading-relaxed text-gray-500">
            Limpia duplicados, valores nulos y normaliza texto automáticamente.
            Pipeline configurable sin escribir código.
          </p>
        </div>

        <div className="card-hover rounded-xl border border-gray-200 bg-white p-8 shadow-md">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-2xl">
            🤖
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-800">Dashboard IA</h3>
          <p className="text-sm leading-relaxed text-gray-500">
            DeepSeek diseña automáticamente el dashboard ideal para tus datos.
            Barras, líneas, scatter y más, sin configuración manual.
          </p>
        </div>

        <div className="card-hover rounded-xl border border-gray-200 bg-white p-8 shadow-md">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-2xl">
            💬
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-800">Chat IA</h3>
          <p className="text-sm leading-relaxed text-gray-500">
            Haz preguntas sobre tus datos y obtén respuestas inmediatas.
            La IA analiza tu dataset y responde en lenguaje natural.
          </p>
        </div>
      </section>

      {/* Why FlowInsight */}
      <section className="rounded-xl border border-gray-200 bg-white p-10 shadow-md">
        <h2 className="mb-8 text-center text-2xl font-bold text-gray-800">
          ¿Por qué FlowInsight AI?
        </h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {[
            { icon: '🚀', title: 'Sin código', desc: 'Sube tu archivo y obtén análisis en segundos.' },
            { icon: '🧠', title: 'IA Avanzada', desc: 'DeepSeek analiza y recomienda visualizaciones.' },
            { icon: '📊', title: 'Dashboards automáticos', desc: 'Gráficos generados según tus datos.' },
            { icon: '🔒', title: 'Tus datos, tu control', desc: 'Procesamiento local. Sin compartir datos.' },
          ].map((item) => (
            <div key={item.title} className="flex gap-4">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function App() {
  useEffect(() => {
    getHealth().then((data) => {
      console.log(data)
    })
  }, [])

  return (
    <BrowserRouter>
      <ActiveDatasetProvider>
        <MainLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/preparation" element={<DataPreparationPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Routes>
        </MainLayout>
      </ActiveDatasetProvider>
    </BrowserRouter>
  )
}

export default App