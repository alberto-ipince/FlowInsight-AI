import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
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
  numeric_statistics: { column: string; min: number; mean: number; median: number; max: number }[]
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${bytes} bytes`
}

function AnalyticsPage() {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null)

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [quality, setQuality] = useState<QualityData | null>(null)
  const [loadingKpis, setLoadingKpis] = useState(false)
  const [errorKpis, setErrorKpis] = useState(false)

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loadingCharts, setLoadingCharts] = useState(false)

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

  const kpiRows =
    loadingKpis
      ? '—'
      : errorKpis || !profile || !quality
        ? 'N/D'
        : null

  // Smart categorical column selection
  const catStats = (() => {
    const stats = analytics?.categorical_statistics
    if (!stats || stats.length === 0) return null
    const idPattern = /(^id$|_id$|uuid$)/i
    const filtered = stats.filter((s) => !idPattern.test(s.column))
    if (filtered.length === 0) return stats[0]
    // Prefer fewer categories
    return filtered.sort((a, b) => a.values.length - b.values.length)[0]
  })()
  const catChartData = catStats?.values ?? []

  // Smart numeric column selection
  const numStat = (() => {
    const stats = analytics?.numeric_statistics
    if (!stats || stats.length === 0) return null
    const highPriority = /(salary|price|amount|age|score|quantity|total)/i
    const idPattern = /(^id$|_id$|uuid$)/i
    const filtered = stats.filter((s) => !idPattern.test(s.column))
    const pool = filtered.length > 0 ? filtered : stats
    const high = pool.find((s) => highPriority.test(s.column))
    return high ?? pool[0]
  })()

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Analytics</h1>

      {/* Card 1: Selector de Dataset */}
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
              <option key={ds.id} value={ds.id}>
                {ds.original_filename}
              </option>
            ))}
          </select>
        )}
      </section>

      {/* Card 2: KPIs */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-700">Resumen (KPIs)</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center">
            <p className="text-xs text-gray-500">Total de filas</p>
            <p className="mt-1 text-2xl font-bold text-gray-800">
              {kpiRows ?? profile!.total_rows.toLocaleString()}
            </p>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center">
            <p className="text-xs text-gray-500">Total de columnas</p>
            <p className="mt-1 text-2xl font-bold text-gray-800">
              {kpiRows ?? profile!.total_columns}
            </p>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center">
            <p className="text-xs text-gray-500">Quality Score</p>
            <p className="mt-1 text-2xl font-bold text-gray-800">
              {kpiRows ?? `${quality!.quality_score}/100`}
            </p>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center">
            <p className="text-xs text-gray-500">Memoria utilizada</p>
            <p className="mt-1 text-2xl font-bold text-gray-800">
              {kpiRows ?? formatBytes(profile!.memory_usage_bytes)}
            </p>
          </div>
        </div>
      </section>

      {/* Card 3: Distribución de tipos de datos */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">Distribución de tipos de datos</h2>
        {loadingKpis ? (
          <p className="text-sm text-blue-600">Analizando tipos...</p>
        ) : profile ? (
          <div className="space-y-2">
            {(() => {
              const grouped: Record<string, number> = {}
              for (const dtype of Object.values(profile.column_types)) {
                grouped[dtype] = (grouped[dtype] || 0) + 1
              }
              const maxCount = Math.max(...Object.values(grouped), 1)
              return Object.entries(grouped)
                .sort((a, b) => b[1] - a[1])
                .map(([dtype, count]) => (
                  <div key={dtype} className="flex items-center gap-3 text-sm">
                    <span className="w-24 text-right text-gray-600">{dtype}</span>
                    <div className="flex-1">
                      <div
                        className="h-5 rounded bg-blue-500 transition-all"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-20 text-gray-500">
                      {count} {count === 1 ? 'columna' : 'columnas'}
                    </span>
                  </div>
                ))
            })()}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No hay información disponible.</p>
        )}
      </section>

      {/* Card 4: Valores nulos por columna */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">Valores nulos por columna</h2>
        {loadingKpis ? (
          <p className="text-sm text-blue-600">Analizando valores nulos...</p>
        ) : profile ? (
          <div className="space-y-2">
            {(() => {
              const entries = Object.entries(profile.missing_values)
              const maxMissing = Math.max(...Object.values(profile.missing_values), 1)

              const barColor = (count: number) => {
                if (count === 0) return 'bg-green-500'
                if (count <= 5) return 'bg-yellow-500'
                return 'bg-red-500'
              }

              return entries.map(([col, count]) => (
                <div key={col} className="flex items-center gap-3 text-sm">
                  <span className="w-32 truncate text-gray-600" title={col}>
                    {col}
                  </span>
                  <div className="flex-1">
                    <div
                      className={`h-5 rounded transition-all ${barColor(count)}`}
                      style={{ width: `${(count / maxMissing) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-gray-500">{count}</span>
                </div>
              ))
            })()}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No hay información disponible.</p>
        )}
      </section>

      {/* Card 5: Visualizaciones */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">Visualizaciones</h2>

        {loadingCharts ? (
          <p className="text-sm text-blue-600">Cargando visualizaciones...</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Chart 1: Categorical Bar Chart */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-600">
                {catStats
                  ? `Frecuencia de: ${catStats.column}`
                  : 'Frecuencia de columnas categóricas'}
              </h3>
              {catChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={catChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-400">
                  No existen columnas categóricas para visualizar.
                </p>
              )}
            </div>

            {/* Chart 2: Numeric Summary */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-600">
                {numStat
                  ? `Resumen estadístico de: ${numStat.column}`
                  : 'Resumen estadístico de columnas numéricas'}
              </h3>
              {numStat ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={[
                      { metric: 'Min', value: numStat.min },
                      { metric: 'Mean', value: numStat.mean },
                      { metric: 'Median', value: numStat.median },
                      { metric: 'Max', value: numStat.max },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-400">
                  No existen columnas numéricas para visualizar.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Card 6: Vista previa del Dataset */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">Vista previa del Dataset</h2>
        {loadingKpis ? (
          <p className="text-sm text-blue-600">Cargando vista previa...</p>
        ) : profile && profile.preview.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {profile.column_names.map((col: string) => (
                    <th key={col} className="px-3 py-2 font-medium text-gray-600">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {profile.preview.map((row, idx) => (
                  <tr key={idx} className="even:bg-gray-50/50">
                    {profile.column_names.map((col: string) => (
                      <td key={col} className="whitespace-nowrap px-3 py-1.5 text-gray-700">
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No hay datos para mostrar.</p>
        )}
      </section>
    </div>
  )
}

export default AnalyticsPage