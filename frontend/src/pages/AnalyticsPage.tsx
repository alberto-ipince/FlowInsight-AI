import { useEffect, useState } from 'react'
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
      return
    }

    setLoadingKpis(true)
    setErrorKpis(false)

    Promise.all([
      apiClient.get<ProfileData>(`/datasets/${selectedDatasetId}/profile`),
      apiClient.get<QualityData>(`/datasets/${selectedDatasetId}/quality`),
    ])
      .then(([profileRes, qualityRes]) => {
        setProfile(profileRes.data)
        setQuality(qualityRes.data)
      })
      .catch(() => {
        setErrorKpis(true)
        setProfile(null)
        setQuality(null)
      })
      .finally(() => setLoadingKpis(false))
  }, [selectedDatasetId])

  const kpiRows =
    loadingKpis
      ? '—'
      : errorKpis || !profile || !quality
        ? 'N/D'
        : null

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
        <div className="grid grid-cols-2 gap-4">
          {['Gráfico de barras', 'Gráfico de dispersión', 'Histograma', 'Gráfico de líneas'].map(
            (chart) => (
              <div
                key={chart}
                className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400"
              >
                {chart} (próximamente)
              </div>
            ),
          )}
        </div>
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