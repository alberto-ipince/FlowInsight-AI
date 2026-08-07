import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useActiveDataset } from '@/contexts/ActiveDatasetContext'
import { getAIAnalysis } from '@/services/aiService'
import { sendChatMessage } from '@/services/chatService'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import apiClient from '@/api/apiClient'

interface DatasetRecord {
  id: number; name: string; original_filename: string
  file_path: string; file_size: number; file_type: string; created_at: string
}
interface ProfileData {
  total_rows: number; total_columns: number; column_names: string[]
  column_types: Record<string, string>; missing_values: Record<string, number>
  memory_usage_bytes: number; preview: Record<string, unknown>[]
}
interface QualityData { quality_score: number }
interface AnalyticsData {
  categorical_statistics: { column: string; values: { label: string; count: number }[] }[]
  numeric_statistics: { column: string; min: number; mean: number; median: number; max: number; sum?: number }[]
  correlation_matrix: Record<string, Record<string, number>>; datetime_columns: string[]
}
interface DataResponse {
  records: Record<string, unknown>[]; total_rows: number; filtered_rows: number
  page: number; page_size: number; total_pages: number
}
interface DashboardChart {
  type: string; title: string; x?: string; y?: string; column?: string; aggregation?: string
}
type DashboardMode = 'auto' | 'ai'
const METRICS = ['mean', 'median', 'sum', 'min', 'max'] as const
type MetricType = (typeof METRICS)[number]
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${bytes} bytes`
}
function corrColor(value: number): string {
  const intensity = Math.abs(value)
  if (value > 0) return `rgba(16,185,129,${intensity})`
  if (value < 0) return `rgba(239,68,68,${intensity})`
  return 'rgba(209,213,219,0.3)'
}
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora mismo'
  if (mins < 60) return `hace ${mins} minuto${mins === 1 ? '' : 's'}`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} hora${hrs === 1 ? '' : 's'}`
  const days = Math.floor(hrs / 24)
  return `hace ${days} día${days === 1 ? '' : 's'}`
}

// ---- Log helper ----
const log = (msg: string) => console.log(`[Analytics] ${msg}`)

function AnalyticsPage() {
  const [searchParams] = useSearchParams()
  const paramId = searchParams.get('dataset_id')

  // Use global active dataset context
  const { activeDatasetId: ctxId, setActiveDatasetId: setCtxId } = useActiveDataset()

  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    paramId ? Number(paramId) : ctxId
  )

  const [datasets, setDatasets] = useState<DatasetRecord[]>([])
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [quality, setQuality] = useState<QualityData | null>(null)
  const [loadingKpis, setLoadingKpis] = useState(false)
  const [errorKpis, setErrorKpis] = useState(false)

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [numMetrics, setNumMetrics] = useState<Record<string, MetricType>>({})

  const [tableData, setTableData] = useState<DataResponse | null>(null)
  const [tablePage, setTablePage] = useState(1)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState('asc')
  const [searchText, setSearchText] = useState('')

  const [aiAnalysis, setAiAnalysis] = useState<{
    insights: string[]; warnings: string[]; dashboard_layout?: DashboardChart[]
  } | null>(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('auto')
  const [aiDashboardData, setAiDashboardData] = useState<{
    type: string; title: string; data: Record<string, unknown>[]; error?: string
  }[] | null>(null)

  // Chat
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [generatingReport, setGeneratingReport] = useState(false)
  const [sendingChat, setSendingChat] = useState(false)

  const [histData, setHistData] = useState<{ column: string; bins: string[]; counts: number[] } | null>(null)

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [recentDatasets, setRecentDatasets] = useState<DatasetRecord[]>([])
  const [renameId, setRenameId] = useState<number | null>(null)
  const [renameName, setRenameName] = useState('')

  const currentDs = datasets.find((d) => d.id === selectedDatasetId) ?? null

  // Sync selectedDatasetId with context and URL param
  useEffect(() => {
    const id = paramId ? Number(paramId) : ctxId
    if (id !== selectedDatasetId && id !== null) {
      log(`Dataset sincronizado desde URL/contexto: ID=${id}`)
      setSelectedDatasetId(id)
      setCtxId(id)
    }
  }, [paramId, ctxId])

  // Keep context in sync
  useEffect(() => {
    if (selectedDatasetId !== ctxId && selectedDatasetId !== null) {
      setCtxId(selectedDatasetId)
    }
  }, [selectedDatasetId, ctxId, setCtxId])

  const loadRecent = () => {
    apiClient.get<DatasetRecord[]>('/datasets/recent')
      .then((res) => setRecentDatasets(res.data))
      .catch(() => setRecentDatasets([]))
  }

  // Load dataset list
  useEffect(() => {
    apiClient.get<DatasetRecord[]>('/datasets/')
      .then((res) => setDatasets(res.data))
      .catch(() => setDatasets([]))
  }, [])

  // Load KPIs + profile + quality — ONLY when selectedDatasetId changes
  useEffect(() => {
    if (selectedDatasetId === null) { setProfile(null); setQuality(null); setAnalytics(null); log('Dataset nulo — limpiando dashboard'); return }
    log(`Consultando datos para dataset ID=${selectedDatasetId}`)
    setLoadingKpis(true); setErrorKpis(false)
    Promise.all([
      apiClient.get<ProfileData>(`/datasets/${selectedDatasetId}/profile`),
      apiClient.get<QualityData>(`/datasets/${selectedDatasetId}/quality`),
      apiClient.get<AnalyticsData>(`/datasets/${selectedDatasetId}/analytics`),
    ]).then(([profileRes, qualityRes, analyticsRes]) => {
      setProfile(profileRes.data); setQuality(qualityRes.data); setAnalytics(analyticsRes.data); log('KPIs cargados correctamente')
    }).catch(() => { setErrorKpis(true); setProfile(null); setQuality(null); setAnalytics(null); log('Error cargando KPIs') })
      .finally(() => setLoadingKpis(false))
  }, [selectedDatasetId])

  // Table data
  useEffect(() => {
    if (selectedDatasetId === null) return
    log(`Consultando tabla para dataset ID=${selectedDatasetId}`)
    const params: Record<string, string> = { page: String(tablePage), page_size: '50' }
    if (sortCol) { params.sort_col = sortCol; params.sort_dir = sortDir }
    if (searchText) params.search = searchText
    apiClient.get<DataResponse>(`/datasets/${selectedDatasetId}/data`, { params })
      .then((res) => setTableData(res.data)).catch(() => setTableData(null))
  }, [selectedDatasetId, tablePage, sortCol, sortDir, searchText])

  // IA
  useEffect(() => {
    if (selectedDatasetId === null) { setAiAnalysis(null); setAiError(null); setAiDashboardData(null); return }
    setLoadingAI(true); setAiError(null); log(`Consultando IA para dataset ID=${selectedDatasetId}`)
    Promise.all([
      getAIAnalysis(selectedDatasetId),
      apiClient.get(`/datasets/${selectedDatasetId}/ai-dashboard-data`),
    ])
      .then(([analysis, dashboardRes]) => {
        setAiAnalysis(analysis as typeof aiAnalysis)
        setAiDashboardData((dashboardRes.data as { charts: typeof aiDashboardData }).charts)
        log('IA recibida correctamente')
      })
      .catch(() => { setAiError('No fue posible generar el análisis inteligente.'); log('Error IA') })
      .finally(() => setLoadingAI(false))
  }, [selectedDatasetId])

  // Reset chat when dataset changes
  useEffect(() => {
    setChatMessages([])
    setChatInput('')
  }, [selectedDatasetId])

  const handleGenerateReport = async () => {
    if (!selectedDatasetId) return
    setGeneratingReport(true)
    try {
      const response = await apiClient.get(`/datasets/${selectedDatasetId}/report`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data as BlobPart], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `FlowInsight_Report_${currentDs?.original_filename ?? 'dataset'}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('No se pudo generar el reporte. Intenta de nuevo.')
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleSendChat = async () => {
    if (!chatInput.trim() || selectedDatasetId === null || sendingChat) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setSendingChat(true)
    try {
      const allMessages = [
        ...chatMessages,
        { role: 'user' as const, content: userMsg },
      ]
      const answer = await sendChatMessage(selectedDatasetId, allMessages)
      setChatMessages((prev) => [...prev, { role: 'assistant', content: answer }])
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Lo siento, no pude procesar tu pregunta. Intenta de nuevo.' },
      ])
    } finally {
      setSendingChat(false)
    }
  }

  // Histogram
  useEffect(() => {
    if (selectedDatasetId === null || !analytics?.numeric_statistics?.length) return
    const firstNum = analytics.numeric_statistics[0].column
    apiClient.get(`/datasets/${selectedDatasetId}/histogram`, { params: { column: firstNum } })
      .then((res) => setHistData(res.data as typeof histData)).catch(() => setHistData(null))
  }, [selectedDatasetId, analytics?.numeric_statistics])

  const handleSelectDataset = (id: number) => {
    log(`Dataset seleccionado manualmente: ID=${id}`)
    setSelectedDatasetId(id)
    setShowModal(false)
  }
  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este dataset?')) return
    await apiClient.delete(`/datasets/${id}`).catch(() => {})
    loadRecent()
    apiClient.get<DatasetRecord[]>('/datasets/').then((res) => setDatasets(res.data))
    if (id === selectedDatasetId) {
      const recent = await apiClient.get<DatasetRecord[]>('/datasets/recent').then((r) => r.data).catch(() => [] as DatasetRecord[])
      setRecentDatasets(recent)
      const newId = recent.length > 0 ? recent[0].id : null
      log(`Dataset activo eliminado. Auto-seleccionando ID=${newId}`)
      setSelectedDatasetId(newId)
      setCtxId(newId)
    }
  }
  const handleRename = async () => {
    if (renameId === null || !renameName.trim()) return
    await apiClient.patch(`/datasets/${renameId}`, { name: renameName.trim() }).catch(() => {})
    setRenameId(null); setRenameName('')
    loadRecent()
    apiClient.get<DatasetRecord[]>('/datasets/').then((res) => setDatasets(res.data))
  }

  const kpiRows = loadingKpis ? '—' : errorKpis || !profile || !quality ? 'N/D' : null
  const catStats = (() => {
    const stats = analytics?.categorical_statistics; if (!stats?.length) return null
    const idP = /(^id$|_id$|uuid$)/i; const f = stats.filter((s) => !idP.test(s.column))
    return f.length ? f.sort((a, b) => a.values.length - b.values.length)[0] : stats[0]
  })()
  const dtCols = analytics?.datetime_columns ?? []
  const corrMatrix = analytics?.correlation_matrix ?? {}
  const corrKeys = Object.keys(corrMatrix)
  const numCols = analytics?.numeric_statistics ?? []

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
    setTablePage(1)
  }

  const renderPreparedChart = (chart: { type: string; title: string; data: Record<string, unknown>[]; error?: string }) => {
    if (chart.error) {
      return (
        <div key={chart.title} className="flex h-80 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
          <p className="text-sm font-medium text-gray-500">{chart.title}</p>
          <p className="mt-1 text-xs text-gray-400">{chart.error}</p>
        </div>
      )
    }

    const { type, title, data } = chart

    switch (type) {
      case 'bar':
      case 'histogram': {
        const dataKey = type === 'histogram' ? 'count' : 'value'
        const xKey = type === 'histogram' ? 'bin' : 'label'
        return (
          <div key={title} className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data as Record<string, unknown>[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey={dataKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      }

      case 'line':
        return (
          <div key={title} className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data as Record<string, unknown>[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )

      case 'scatter':
        return (
          <div key={title} className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="x" tick={{ fontSize: 10 }} />
                <YAxis dataKey="y" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Scatter data={data as Record<string, unknown>[]} fill="#8b5cf6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )

      case 'pie':
        return (
          <div key={title} className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data as Record<string, unknown>[]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(p: { name?: string }) => p.name ?? ''}>
                  {(data as Record<string, unknown>[]).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Analytics</h1>

      {/* Dataset actual + cambiar */}
      <section className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        {currentDs ? (
          <div>
            <p className="text-sm text-gray-500">Dataset actual</p>
            <p className="text-lg font-semibold text-gray-800">{currentDs.original_filename}</p>
            <p className="text-xs text-gray-400">{timeAgo(currentDs.created_at)}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No hay dataset seleccionado.</p>
        )}
        <button onClick={() => { loadRecent(); setShowModal(true) }} className="rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cambiar Dataset
        </button>
      </section>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Seleccionar Dataset</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            {recentDatasets.length === 0 ? (
              <p className="text-sm text-gray-400">No existen datasets disponibles.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {recentDatasets.map((ds) => (
                  <div key={ds.id} className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                    {renameId === ds.id ? (
                      <div className="flex gap-2">
                        <input value={renameName} onChange={(e) => setRenameName(e.target.value)} className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" placeholder="Nuevo nombre" />
                        <button onClick={handleRename} className="rounded bg-blue-600 px-3 py-1 text-xs text-white">Guardar</button>
                        <button onClick={() => { setRenameId(null); setRenameName('') }} className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-600">Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-gray-800 truncate">{ds.original_filename}</p>
                        <p className="text-xs text-gray-400">{new Date(ds.created_at).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-500">Filas: {ds.file_size} bytes · Tipo: {ds.file_type}</p>
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => handleSelectDataset(ds.id)} className="rounded bg-blue-600 px-3 py-1 text-xs text-white">Analizar</button>
                          <button onClick={() => { setRenameId(ds.id); setRenameName(ds.original_filename) }} className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600">Renombrar</button>
                          <button onClick={() => handleDelete(ds.id)} className="rounded border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50">Eliminar</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Analysis */}
      {(loadingAI || aiAnalysis || aiError) && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-700">🧠 Análisis Inteligente</h2>
          {loadingAI && (<div className="space-y-3"><div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" /><div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" /><div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" /></div>)}
          {aiError && (<div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800"><p className="font-medium">⚠️ Análisis no disponible</p><p className="mt-1 text-yellow-700">{aiError}</p></div>)}
          {aiAnalysis && (<div className="space-y-4">
            {aiAnalysis.insights.length > 0 && (<div><h3 className="mb-2 text-sm font-semibold text-gray-700">Insights</h3><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{aiAnalysis.insights.map((ins, i) => (<div key={i} className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">💡 {ins}</div>))}</div></div>)}
            {aiAnalysis.warnings.length > 0 && (<div><h3 className="mb-2 text-sm font-semibold text-gray-700">Advertencias</h3><div className="space-y-1">{aiAnalysis.warnings.map((w, i) => (<div key={i} className="flex items-start gap-2 rounded-lg border border-yellow-100 bg-yellow-50 p-2 text-sm text-yellow-800"><span className="mt-0.5">⚠️</span><span>{w}</span></div>))}</div></div>)}
          </div>)}
        </section>
      )}

      {/* KPIs */}
      {profile && quality && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-700">Resumen (KPIs)</h2>
          <div className="grid grid-cols-4 gap-4">
            {[{ label: 'Total de filas', value: String(kpiRows ?? profile.total_rows.toLocaleString()) }, { label: 'Total de columnas', value: String(kpiRows ?? profile.total_columns) }, { label: 'Quality Score', value: kpiRows ?? `${quality.quality_score}/100` }, { label: 'Memoria utilizada', value: kpiRows ?? formatBytes(profile.memory_usage_bytes) }].map((kpi) => (<div key={kpi.label} className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center"><p className="text-xs text-gray-500">{kpi.label}</p><p className="mt-1 text-2xl font-bold text-gray-800">{kpi.value}</p></div>))}
          </div>
          {numCols.length > 0 && (<div className="mt-6"><h3 className="mb-3 text-sm font-semibold text-gray-700">Métricas por columna</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{numCols.map((stat) => { const metric = numMetrics[stat.column] ?? 'mean'; const val = stat[metric] ?? stat.mean; return (<div key={stat.column} className="rounded-lg border border-gray-100 bg-gray-50 p-3"><p className="truncate text-xs text-gray-500" title={stat.column}>{stat.column}</p><p className="text-lg font-bold text-gray-800">{typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(val)}</p><select className="mt-1 w-full rounded border border-gray-200 bg-white px-1 py-0.5 text-xs text-gray-600" value={metric} onChange={(e) => setNumMetrics({ ...numMetrics, [stat.column]: e.target.value as MetricType })}>{METRICS.map((m) => (<option key={m} value={m}>{m}</option>))}</select></div>) })}</div></div>)}
        </section>
      )}

      {/* Mode switch + charts */}
      {analytics && (
        <>
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-700">Modo Dashboard:</span>
              <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="radio" name="dm" value="auto" checked={dashboardMode === 'auto'} onChange={() => setDashboardMode('auto')} className="text-blue-600" />Dashboard automático</label>
              <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="radio" name="dm" value="ai" checked={dashboardMode === 'ai'} onChange={() => setDashboardMode('ai')} className="text-blue-600" />Dashboard IA</label>
              <div className="flex-1"></div>
              <button
                onClick={handleGenerateReport}
                disabled={!selectedDatasetId || generatingReport}
                className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                {generatingReport ? 'Generando reporte...' : '📄 Generar Reporte PDF'}
              </button>
            </div>
          </section>

          {dashboardMode === 'auto' ? (
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-700">Gráficos automáticos</h2>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {histData?.bins?.length ? (<div className="rounded-lg border border-gray-100 bg-gray-50 p-4"><h3 className="mb-3 text-sm font-semibold text-gray-600">Histograma: {histData.column}</h3><ResponsiveContainer width="100%" height={250}><BarChart data={histData.bins.map((b, i) => ({ bin: b, count: histData.counts[i] }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="bin" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>) : (<div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">Histograma no disponible</div>)}
                {catStats ? (<div className="rounded-lg border border-gray-100 bg-gray-50 p-4"><h3 className="mb-3 text-sm font-semibold text-gray-600">Frecuencia: {catStats.column}</h3><ResponsiveContainer width="100%" height={250}><BarChart data={catStats.values}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>) : (<div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">Sin columnas categóricas</div>)}
                {dtCols.length > 0 && profile ? (<div className="rounded-lg border border-gray-100 bg-gray-50 p-4"><h3 className="mb-3 text-sm font-semibold text-gray-600">Línea temporal: {dtCols[0]}</h3><ResponsiveContainer width="100%" height={250}><LineChart data={profile.preview.slice(0, 20).map((r, i) => ({ idx: String(r[dtCols[0]] ?? i) }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="idx" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#f59e0b" dot={false} /></LineChart></ResponsiveContainer></div>) : (<div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">Sin columna temporal</div>)}
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4"><h3 className="mb-3 text-sm font-semibold text-gray-600">Correlación</h3>{corrKeys.length >= 2 ? (<div className="overflow-x-auto"><table className="text-xs"><thead><tr><th className="px-1 py-0.5"></th>{corrKeys.map((c) => (<th key={c} className="max-w-[80px] truncate px-1 py-0.5 font-medium text-gray-600" title={c}>{c.length > 8 ? c.slice(0, 8) + '…' : c}</th>))}</tr></thead><tbody>{corrKeys.map((row) => (<tr key={row}><td className="max-w-[80px] truncate px-1 py-0.5 font-medium text-gray-600" title={row}>{row.length > 8 ? row.slice(0, 8) + '…' : row}</td>{corrKeys.map((col) => { const v = corrMatrix[row]?.[col] ?? 0; return (<td key={col} className="px-1 py-0.5 text-center font-mono" style={{ backgroundColor: corrColor(v), width: 40 }}>{v.toFixed(2)}</td>) })}</tr>))}</tbody></table></div>) : (<p className="text-sm text-gray-400">No existen suficientes columnas numéricas para calcular correlaciones.</p>)}</div>
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <h2 className="text-lg font-semibold text-gray-800">Dashboard generado por IA</h2>
              </div>
              <p className="mb-5 text-sm text-gray-500">
                Los siguientes gráficos fueron seleccionados automáticamente por la IA según la estructura y características del dataset.
              </p>
              {!aiDashboardData || aiDashboardData.length === 0 ? (
                <p className="text-sm text-gray-400">{loadingAI ? 'Cargando gráficos...' : 'La IA no ha generado gráficos o el análisis aún no está disponible.'}</p>
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {aiDashboardData.map((c) => renderPreparedChart(c))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Chat */}
      {selectedDatasetId && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-700">
            💬 Chat con el Dataset
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Haz preguntas sobre el dataset actualmente seleccionado.
          </p>

          {/* Messages */}
          <div className="mb-4 max-h-80 overflow-y-auto space-y-3 rounded-lg bg-gray-50 p-4">
            {chatMessages.length === 0 ? (
              <p className="text-center text-sm text-gray-400">
                {selectedDatasetId !== null
                  ? 'Escribe una pregunta para comenzar.'
                  : 'Selecciona un dataset para iniciar el chat.'}
              </p>
            ) : (
              chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {sendingChat && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-white border border-gray-200 px-4 py-2 text-sm text-gray-400 italic">
                  La IA está analizando...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat() }}
              placeholder="Escribe una pregunta sobre el dataset..."
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              disabled={sendingChat || selectedDatasetId === null}
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim() || sendingChat || selectedDatasetId === null}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              Enviar
            </button>
          </div>
        </section>
      )}

      {/* Table */}
      {tableData && profile && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-700">Vista previa ({tableData.filtered_rows} filas)</h2>
          <div className="mb-3"><input type="text" placeholder="Buscar..." value={searchText} onChange={(e) => { setSearchText(e.target.value); setTablePage(1) }} className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none" /></div>
          <div className="overflow-x-auto rounded-md border border-gray-200"><table className="min-w-full text-left text-xs"><thead className="bg-gray-50"><tr>{profile.column_names.map((col) => (<th key={col} className="cursor-pointer px-3 py-2 font-medium text-gray-600 hover:text-gray-900" onClick={() => handleSort(col)}>{col} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>))}</tr></thead><tbody className="divide-y divide-gray-100">{tableData.records.map((row, idx) => (<tr key={idx} className="even:bg-gray-50/50">{profile.column_names.map((col) => (<td key={col} className="whitespace-nowrap px-3 py-1.5 text-gray-700">{String(row[col] ?? '')}</td>))}</tr>))}</tbody></table></div>
          <div className="mt-3 flex items-center justify-between text-sm text-gray-600"><span>Página {tableData.page} de {tableData.total_pages}</span><div className="flex gap-2"><button disabled={tableData.page <= 1} onClick={() => setTablePage((p) => p - 1)} className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40">Anterior</button><button disabled={tableData.page >= tableData.total_pages} onClick={() => setTablePage((p) => p + 1)} className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40">Siguiente</button></div></div>
        </section>
      )}
    </div>
  )
}

export default AnalyticsPage