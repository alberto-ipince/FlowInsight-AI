import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAIAnalysis } from '@/services/aiService'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import apiClient from '@/api/apiClient'

interface DatasetRecord {
  id: number
  name: string
  original_filename: string
  file_path: string
  file_size: number
  file_type: string
  created_at: string
}

interface ProfileData {
  total_rows: number
  total_columns: number
  column_names: string[]
  column_types: Record<string, string>
  missing_values: Record<string, number>
  memory_usage_bytes: number
  preview: Record<string, unknown>[]
}

interface QualityData {
  quality_score: number
}

interface AnalyticsData {
  categorical_statistics: { column: string; values: { label: string; count: number }[] }[]
  numeric_statistics: { column: string; min: number; mean: number; median: number; max: number; sum?: number }[]
  correlation_matrix: Record<string, Record<string, number>>
  datetime_columns: string[]
}

interface DataResponse {
  records: Record<string, unknown>[]
  total_rows: number
  filtered_rows: number
  page: number
  page_size: number
  total_pages: number
}

interface DashboardChart {
  type: string
  title: string
  x?: string
  y?: string
  column?: string
  aggregation?: string
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
  if (value > 0) return `rgba(16, 185, 129, ${intensity})`
  if (value < 0) return `rgba(239, 68, 68, ${intensity})`
  return 'rgba(209, 213, 219, 0.3)'
}

function AnalyticsPage() {
  const [searchParams] = useSearchParams()
  const paramId = searchParams.get('dataset_id')

  const [datasets, setDatasets] = useState<DatasetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(paramId ? Number(paramId) : null)

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [quality, setQuality] = useState<QualityData | null>(null)
  const [loadingKpis, setLoadingKpis] = useState(false)
  const [errorKpis, setErrorKpis] = useState(false)

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loadingCharts, setLoadingCharts] = useState(false)

  // Numeric KPI per column
  const [numMetrics, setNumMetrics] = useState<Record<string, MetricType>>({})

  // Table
  const [tableData, setTableData] = useState<DataResponse | null>(null)
  const [tablePage, setTablePage] = useState(1)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState('asc')
  const [searchText, setSearchText] = useState('')

  // AI Analysis
  const [aiAnalysis, setAiAnalysis] = useState<{
    insights: string[]
    warnings: string[]
    dashboard_layout?: DashboardChart[]
  } | null>(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Dashboard mode
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('auto')

  // Histogram
  const [histData, setHistData] = useState<{ column: string; bins: string[]; counts: number[] } | null>(null)

  useEffect(() => {
    apiClient
      .get<DatasetRecord[]>('/datasets/')
      .then((res) => setDatasets(res.data))
      .catch(() => setDatasets([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedDatasetId === null) {
      setProfile(null)
      setQuality(null)
      setAnalytics(null)
      return
    }

    setLoadingKpis(true)
    setErrorKpis(false)
    setLoadingCharts(true)

    Promise.all([
      apiClient.get<ProfileData>(`/datasets/${selectedDatasetId}/profile`),
      apiClient.get<QualityData>(`/datasets/${selectedDatasetId}/quality`),
      apiClient.get<AnalyticsData>(`/datasets/${selectedDatasetId}/analytics`),
    ])
      .then(([profileRes, qualityRes, analyticsRes]) => {
        setProfile(profileRes.data)
        setQuality(qualityRes.data)
        setAnalytics(analyticsRes.data)
      })
      .catch(() => {
        setErrorKpis(true)
        setProfile(null)
        setQuality(null)
        setAnalytics(null)
      })
      .finally(() => {
        setLoadingKpis(false)
        setLoadingCharts(false)
      })
  }, [selectedDatasetId])

  // Fetch table data
  useEffect(() => {
    if (selectedDatasetId === null) return
    const params: Record<string, string> = { page: String(tablePage), page_size: '50' }
    if (sortCol) { params.sort_col = sortCol; params.sort_dir = sortDir }
    if (searchText) params.search = searchText
    apiClient
      .get<DataResponse>(`/datasets/${selectedDatasetId}/data`, { params })
      .then((res) => setTableData(res.data))
      .catch(() => setTableData(null))
  }, [selectedDatasetId, tablePage, sortCol, sortDir, searchText])

  // Fetch AI analysis
  useEffect(() => {
    if (selectedDatasetId === null) {
      setAiAnalysis(null)
      setAiError(null)
      return
    }
    setLoadingAI(true)
    setAiError(null)
    getAIAnalysis(selectedDatasetId)
      .then((data) => setAiAnalysis(data as { insights: string[]; warnings: string[]; dashboard_layout?: DashboardChart[] }))
      .catch(() => setAiError('No fue posible generar el análisis inteligente.'))
      .finally(() => setLoadingAI(false))
  }, [selectedDatasetId])

  // Fetch histogram
  useEffect(() => {
    if (selectedDatasetId === null || !analytics?.numeric_statistics?.length) return
    const firstNum = analytics.numeric_statistics[0].column
    apiClient
      .get(`/datasets/${selectedDatasetId}/histogram`, { params: { column: firstNum } })
      .then((res: { data: { column: string; bins: string[]; counts: number[] } }) => setHistData(res.data))
      .catch(() => setHistData(null))
  }, [selectedDatasetId, analytics?.numeric_statistics])

  const kpiRows = loadingKpis ? '—' : errorKpis || !profile || !quality ? 'N/D' : null

  const catStats = (() => {
    const stats = analytics?.categorical_statistics
    if (!stats || stats.length === 0) return null
    const idPattern = /(^id$|_id$|uuid$)/i
    const filtered = stats.filter((s) => !idPattern.test(s.column))
    if (filtered.length === 0) return stats[0]
    return filtered.sort((a, b) => a.values.length - b.values.length)[0]
  })()

  const dateTimeCols = analytics?.datetime_columns ?? []
  const hasTimeSeries = dateTimeCols.length > 0
  const corrMatrix = analytics?.correlation_matrix ?? {}
  const corrKeys = Object.keys(corrMatrix)
  const hasCorr = corrKeys.length >= 2

  const numCols = analytics?.numeric_statistics ?? []

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
    setTablePage(1)
  }

  // Validate AI chart columns exist in the dataset
  const validCharts = (aiAnalysis?.dashboard_layout ?? []).filter((chart) => {
    const cols = profile?.column_names ?? []
    const okX = !chart.x || cols.includes(chart.x)
    const okY = !chart.y || cols.includes(chart.y)
    const okCol = !chart.column || cols.includes(chart.column)
    return okX && okY && okCol
  })

  const renderBarChart = (chart: DashboardChart) => {
    if (!chart.x || !chart.y || !profile) return null
    // Use first 20 preview rows as data
    const data = profile.preview.slice(0, 20).map((r: Record<string, unknown>) => ({
      label: String(r[chart.x!] ?? ''),
      value: Number(r[chart.y!]) || 0,
    }))
    return (
      <div key={chart.title} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-600">{chart.title}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const renderLineChart = (chart: DashboardChart) => {
    if (!chart.x || !chart.y || !profile) return null
    const data = profile.preview.slice(0, 20).map((r: Record<string, unknown>) => ({
      label: String(r[chart.x!] ?? ''),
      value: Number(r[chart.y!]) || 0,
    }))
    return (
      <div key={chart.title} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-600">{chart.title}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#f59e0b" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const renderScatterChart = (chart: DashboardChart) => {
    if (!chart.x || !chart.y || !profile) return null
    const data = profile.preview.slice(0, 50).map((r: Record<string, unknown>) => ({
      x: Number(r[chart.x!]) || 0,
      y: Number(r[chart.y!]) || 0,
    }))
    return (
      <div key={chart.title} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-600">{chart.title}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" tick={{ fontSize: 10 }} />
            <YAxis dataKey="y" tick={{ fontSize: 10 }} />
            <Tooltip />
            <Scatter data={data} fill="#8b5cf6" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const renderPieChart = (chart: DashboardChart) => {
    if (!chart.column || !profile) return null
    const counts: Record<string, number> = {}
    profile.preview.forEach((r: Record<string, unknown>) => {
      const key = String(r[chart.column!] ?? 'N/A')
      counts[key] = (counts[key] || 0) + 1
    })
    const data = Object.entries(counts).map(([name, value]) => ({ name, value }))
    return (
      <div key={chart.title} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-600">{chart.title}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(props: { name?: string }) => props.name ?? ''}>
              {data.map((_entry, idx) => (
                <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const renderAIChart = (chart: DashboardChart) => {
    switch (chart.type) {
      case 'bar': return renderBarChart(chart)
      case 'line': return renderLineChart(chart)
      case 'scatter': return renderScatterChart(chart)
      case 'pie': return renderPieChart(chart)
      case 'histogram':
        // Use existing histogram data if column matches
        if (histData && chart.column === histData.column && histData.bins.length > 0) {
          return (
            <div key={chart.title} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-600">{chart.title}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={histData.bins.map((b, i) => ({ bin: b, count: histData.counts[i] }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bin" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        }
        return null
      default: return null
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Analytics</h1>

      {/* Card 1: Selector */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">Seleccionar Dataset</h2>
        {loading ? (
          <p className="text-sm text-blue-600">Cargando datasets...</p>
        ) : datasets.length === 0 ? (
          <p className="text-sm text-gray-400">No hay datasets disponibles.</p>
        ) : (
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={selectedDatasetId ?? ''}
            onChange={(e) => setSelectedDatasetId(Number(e.target.value) || null)}
          >
            <option value="">Selecciona un dataset...</option>
            {datasets.map((ds) => (
              <option key={ds.id} value={ds.id}>{ds.original_filename}</option>
            ))}
          </select>
        )}
      </section>

      {/* Card 2.5: AI Analysis */}
      {(loadingAI || aiAnalysis || aiError) && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-700">
            🧠 Análisis Inteligente
          </h2>

          {loadingAI && (
            <div className="space-y-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
            </div>
          )}

          {aiError && (
            <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
              <p className="font-medium">⚠️ Análisis no disponible</p>
              <p className="mt-1 text-yellow-700">{aiError}</p>
            </div>
          )}

          {aiAnalysis && (
            <div className="space-y-4">
              {/* Insights */}
              {aiAnalysis.insights.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-700">Insights</h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {aiAnalysis.insights.map((insight: string, idx: number) => (
                      <div key={idx} className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                        💡 {insight}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {aiAnalysis.warnings.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-700">Advertencias</h3>
                  <div className="space-y-1">
                    {aiAnalysis.warnings.map((warning: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 rounded-lg border border-yellow-100 bg-yellow-50 p-2 text-sm text-yellow-800">
                        <span className="mt-0.5">⚠️</span>
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Card 2: KPIs */}
      {profile && quality && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-700">Resumen (KPIs)</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total de filas', value: String(kpiRows ?? profile.total_rows.toLocaleString()) },
              { label: 'Total de columnas', value: String(kpiRows ?? profile.total_columns) },
              { label: 'Quality Score', value: kpiRows ?? `${quality.quality_score}/100` },
              { label: 'Memoria utilizada', value: kpiRows ?? formatBytes(profile.memory_usage_bytes) },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center">
                <p className="text-xs text-gray-500">{kpi.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-800">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Per-column numeric KPIs */}
          {numCols.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Métricas por columna</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {numCols.map((stat) => {
                  const metric = numMetrics[stat.column] ?? 'mean'
                  const val = stat[metric] ?? stat.mean
                  return (
                    <div key={stat.column} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <p className="truncate text-xs text-gray-500" title={stat.column}>{stat.column}</p>
                      <p className="text-lg font-bold text-gray-800">
                        {typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(val)}
                      </p>
                      <select
                        className="mt-1 w-full rounded border border-gray-200 bg-white px-1 py-0.5 text-xs text-gray-600"
                        value={metric}
                        onChange={(e) => setNumMetrics({ ...numMetrics, [stat.column]: e.target.value as MetricType })}
                      >
                        {METRICS.map((m) => (<option key={m} value={m}>{m}</option>))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Mode Switch + Charts */}
      {!loadingCharts && analytics && (
        <>
          {/* Mode switch */}
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-700">Modo Dashboard:</span>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="dashboardMode"
                  value="auto"
                  checked={dashboardMode === 'auto'}
                  onChange={() => setDashboardMode('auto')}
                  className="text-blue-600"
                />
                Dashboard automático
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="dashboardMode"
                  value="ai"
                  checked={dashboardMode === 'ai'}
                  onChange={() => setDashboardMode('ai')}
                  className="text-blue-600"
                />
                Dashboard IA
              </label>
            </div>
          </section>

          {/* Charts */}
          {dashboardMode === 'auto' ? (
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-700">Gráficos automáticos</h2>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {histData?.bins?.length ? (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-600">Histograma: {histData.column}</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={histData.bins.map((b, i) => ({ bin: b, count: histData.counts[i] }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="bin" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">Histograma no disponible</div>
                )}

                {catStats ? (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-600">Frecuencia: {catStats.column}</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={catStats.values}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">Sin columnas categóricas</div>
                )}

                {hasTimeSeries && profile ? (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-600">Línea temporal: {dateTimeCols[0]}</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={profile.preview.slice(0, 20).map((r: Record<string, unknown>, i: number) => ({
                        idx: String(r[dateTimeCols[0]] ?? i),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="idx" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#f59e0b" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">Sin columna temporal</div>
                )}

                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-gray-600">Correlación</h3>
                  {hasCorr ? (
                    <div className="overflow-x-auto">
                      <table className="text-xs">
                        <thead>
                          <tr>
                            <th className="px-1 py-0.5"></th>
                            {corrKeys.map((c) => (
                              <th key={c} className="max-w-[80px] truncate px-1 py-0.5 font-medium text-gray-600" title={c}>
                                {c.length > 8 ? c.slice(0, 8) + '…' : c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {corrKeys.map((row) => (
                            <tr key={row}>
                              <td className="max-w-[80px] truncate px-1 py-0.5 font-medium text-gray-600" title={row}>{row.length > 8 ? row.slice(0, 8) + '…' : row}</td>
                              {corrKeys.map((col) => {
                                const v = corrMatrix[row]?.[col] ?? 0
                                return (
                                  <td key={col} className="px-1 py-0.5 text-center font-mono" style={{ backgroundColor: corrColor(v), width: 40 }}>
                                    {v.toFixed(2)}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No existen suficientes columnas numéricas para calcular correlaciones.</p>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-700">🤖 Dashboard generado por IA</h2>
              {validCharts.length === 0 ? (
                <p className="text-sm text-gray-400">La IA no ha generado gráficos o el análisis aún no está disponible.</p>
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {validCharts.map((chart) => renderAIChart(chart))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Card 4: Table */}
      {tableData && profile && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-700">Vista previa ({tableData.filtered_rows} filas)</h2>
          <div className="mb-3">
            <input
              type="text" placeholder="Buscar..." value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setTablePage(1) }}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {profile.column_names.map((col: string) => (
                    <th key={col} className="cursor-pointer px-3 py-2 font-medium text-gray-600 hover:text-gray-900" onClick={() => handleSort(col)}>
                      {col} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tableData.records.map((row, idx) => (
                  <tr key={idx} className="even:bg-gray-50/50">
                    {profile.column_names.map((col: string) => (
                      <td key={col} className="whitespace-nowrap px-3 py-1.5 text-gray-700">{String(row[col] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
            <span>Página {tableData.page} de {tableData.total_pages}</span>
            <div className="flex gap-2">
              <button disabled={tableData.page <= 1} onClick={() => setTablePage((p) => p - 1)} className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40">Anterior</button>
              <button disabled={tableData.page >= tableData.total_pages} onClick={() => setTablePage((p) => p + 1)} className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default AnalyticsPage