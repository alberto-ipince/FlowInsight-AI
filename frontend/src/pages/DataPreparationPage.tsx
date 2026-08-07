import { useRef, useState } from 'react'
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

function DataPreparationPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [dataset, setDataset] = useState<DatasetRecord | null>(null)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [quality, setQuality] = useState<Record<string, unknown> | null>(null)
  const [loadingQuality, setLoadingQuality] = useState(false)

  // ETL Pipeline state
  const [stepRemoveDup, setStepRemoveDup] = useState(false)
  const [stepRemoveNulls, setStepRemoveNulls] = useState(false)
  const [stepNormalize, setStepNormalize] = useState(false)
  const [stepRename, setStepRename] = useState(false)
  const [stepConvert, setStepConvert] = useState(false)
  const [stepFilter, setStepFilter] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')

  const [pipelineResult, setPipelineResult] = useState<Record<string, unknown> | null>(null)
  const [executingPipeline, setExecutingPipeline] = useState(false)

  const pipelineActive =
    stepRemoveDup || stepRemoveNulls || stepNormalize || stepRename || stepConvert || stepFilter

  const buildSteps = () => {
    const steps: Record<string, unknown>[] = []
    if (stepRemoveDup) steps.push({ operation: 'remove_duplicates', params: {} })
    if (stepRemoveNulls) steps.push({ operation: 'remove_missing_values', params: {} })
    if (stepNormalize) steps.push({ operation: 'normalize_text', params: {} })
    if (stepRename) steps.push({ operation: 'rename_columns', params: {} })
    if (stepConvert) steps.push({ operation: 'convert_column_types', params: {} })
    if (stepFilter) steps.push({ operation: 'filter_rows', params: { query: filterQuery } })
    return steps
  }

  const fetchAllData = async (dsId: number) => {
    setLoadingProfile(true)
    setLoadingQuality(true)
    try {
      const [datasetRes, profileRes, qualityRes] = await Promise.all([
        apiClient.get<DatasetRecord>(`/datasets/${dsId}`),
        apiClient.get(`/datasets/${dsId}/profile`),
        apiClient.get(`/datasets/${dsId}/quality`),
      ])
      setDataset(datasetRes.data)
      setProfile(profileRes.data)
      setQuality(qualityRes.data)
    } catch {
      // ignore
    } finally {
      setLoadingProfile(false)
      setLoadingQuality(false)
    }
  }

  const handleRunPipeline = async () => {
    if (!dataset) return

    setExecutingPipeline(true)
    setPipelineResult(null)

    try {
      const response = await apiClient.post(`/datasets/${dataset.id}/pipeline`, {
        steps: buildSteps(),
      })
      setPipelineResult(response.data)
      // Auto-refresh all data after pipeline
      await fetchAllData(dataset.id)
    } catch {
      setPipelineResult({ message: 'Error executing pipeline' } as Record<string, unknown>)
    } finally {
      setExecutingPipeline(false)
    }
  }

  const handleDownload = () => {
    if (!dataset) return
    window.open(`${apiClient.defaults.baseURL}/datasets/${dataset.id}/download`, '_blank')
  }

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setError('Selecciona un archivo primero.')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)
    setProfile(null)
    setQuality(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await apiClient.post<DatasetRecord>(
        '/datasets/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )

      const uploaded = response.data
      setDataset(uploaded)
      setSuccess(`Archivo "${file.name}" subido correctamente.`)

      // Auto-fetch profile & quality
      setLoadingProfile(true)
      setLoadingQuality(true)
      try {
        const [profileRes, qualityRes] = await Promise.all([
          apiClient.get(`/datasets/${uploaded.id}/profile`),
          apiClient.get(`/datasets/${uploaded.id}/quality`),
        ])
        setProfile(profileRes.data)
        setQuality(qualityRes.data)
      } catch {
        // ignore
      } finally {
        setLoadingProfile(false)
        setLoadingQuality(false)
      }
    } catch {
      setError('Error al subir el archivo. Revisa el servidor.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Preparación de Datos</h1>

      {/* Card 1: Subir archivo */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">Subir archivo</h2>
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            {uploading ? 'Subiendo...' : 'Subir Dataset'}
          </button>

          {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          {success && (
            <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</p>
          )}
        </div>
      </section>

      {/* Card 2: Información del Dataset */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">Información del Dataset</h2>
        {dataset ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <span className="text-gray-500">Nombre original</span>
            <span className="font-medium text-gray-800">{dataset.original_filename}</span>

            <span className="text-gray-500">Nombre interno</span>
            <span className="font-medium text-gray-800">{dataset.name}</span>

            <span className="text-gray-500">ID</span>
            <span className="font-medium text-gray-800">{dataset.id}</span>

            <span className="text-gray-500">Tipo de archivo</span>
            <span className="font-medium text-gray-800">{dataset.file_type.toUpperCase()}</span>

            <span className="text-gray-500">Tamaño</span>
            <span className="font-medium text-gray-800">{dataset.file_size.toLocaleString()} bytes</span>

            <span className="text-gray-500">Fecha de carga</span>
            <span className="font-medium text-gray-800">
              {new Date(dataset.created_at).toLocaleString()}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No has cargado ningún dataset todavía.</p>
        )}
      </section>

      {/* Card 3: Perfil del Dataset */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">Perfil del Dataset</h2>
        {loadingProfile ? (
          <p className="text-sm text-blue-600">Analizando dataset...</p>
        ) : profile ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <span className="text-gray-500">Total de filas</span>
              <span className="font-medium text-gray-800">
                {String(profile.total_rows ?? '-')}
              </span>

              <span className="text-gray-500">Total de columnas</span>
              <span className="font-medium text-gray-800">
                {String(profile.total_columns ?? '-')}
              </span>

              <span className="text-gray-500">Filas duplicadas</span>
              <span className="font-medium text-gray-800">
                {String(profile.duplicated_rows ?? '-')}
              </span>

              <span className="text-gray-500">Memoria utilizada</span>
              <span className="font-medium text-gray-800">
                {Number(profile.memory_usage_bytes ?? 0).toLocaleString()} bytes
              </span>
            </div>

            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-700">Columnas y tipos</h3>
              <div className="flex flex-wrap gap-2">
                {(profile.column_names as string[])?.map((col: string) => (
                  <span
                    key={col}
                    className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700"
                  >
                    {col}: {String((profile.column_types as Record<string, string>)?.[col] ?? '')}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                Vista previa (primeros 5 registros)
              </h3>
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {(profile.column_names as string[])?.map((col: string) => (
                        <th key={col} className="px-3 py-2 font-medium text-gray-600">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(profile.preview as Record<string, unknown>[])?.map(
                      (row, idx: number) => (
                        <tr key={idx} className="even:bg-gray-50/50">
                          {(profile.column_names as string[])?.map((col: string) => (
                            <td
                              key={col}
                              className="whitespace-nowrap px-3 py-1.5 text-gray-700"
                            >
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No hay información disponible.</p>
        )}
      </section>

      {/* Card 4: Calidad del Dataset */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">Calidad del Dataset</h2>
        {loadingQuality ? (
          <p className="text-sm text-blue-600">Evaluando calidad...</p>
        ) : quality ? (
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-gray-500">Quality Score</span>
                <span className="font-bold text-gray-800">
                  {String(quality.quality_score ?? '-')}/100
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-200">
                <div
                  className={`h-3 rounded-full transition-all ${
                    Number(quality.quality_score) >= 90
                      ? 'bg-green-500'
                      : Number(quality.quality_score) >= 70
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                  style={{
                    width: `${Math.min(Number(quality.quality_score ?? 0), 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <span className="text-gray-500">Total de valores nulos</span>
              <span className="font-medium text-gray-800">
                {String(quality.total_missing_values ?? '-')}
              </span>

              <span className="text-gray-500">Filas duplicadas</span>
              <span className="font-medium text-gray-800">
                {String(quality.duplicated_rows ?? '-')}
              </span>

              <span className="text-gray-500">Porcentaje de duplicados</span>
              <span className="font-medium text-gray-800">
                {String(quality.duplicated_percentage ?? '-')}%
              </span>
            </div>

            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-700">Columnas con valores nulos</h3>
              <div className="flex flex-wrap gap-2">
                {(quality.columns_with_missing_values as string[])?.length > 0 ? (
                  (quality.columns_with_missing_values as string[]).map((col: string) => (
                    <span
                      key={col}
                      className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs text-yellow-800"
                    >
                      {col}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">Ninguna</span>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-700">
                Columnas completamente vacías
              </h3>
              <div className="flex flex-wrap gap-2">
                {(quality.empty_columns as string[])?.length > 0 ? (
                  (quality.empty_columns as string[]).map((col: string) => (
                    <span
                      key={col}
                      className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs text-red-800"
                    >
                      {col}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">Ninguna</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No hay información de calidad.</p>
        )}
      </section>

      {/* Card 5: Pipeline ETL */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">Pipeline ETL</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={stepRemoveDup}
              onChange={(e) => setStepRemoveDup(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Eliminar duplicados
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={stepRemoveNulls}
              onChange={(e) => setStepRemoveNulls(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Eliminar filas con nulos
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={stepNormalize}
              onChange={(e) => setStepNormalize(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Normalizar texto
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={stepRename}
              onChange={(e) => setStepRename(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Renombrar columnas
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={stepConvert}
              onChange={(e) => setStepConvert(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Convertir tipos
          </label>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={stepFilter}
                onChange={(e) => setStepFilter(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Filtrar filas
            </label>
            {stepFilter && (
              <div className="mt-2">
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="ej: edad >= 18"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Card 6: Acciones */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">Acciones</h2>
        <div className="flex gap-3">
          <button
            onClick={handleRunPipeline}
            disabled={!pipelineActive || executingPipeline || !dataset}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              pipelineActive && dataset
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'cursor-not-allowed bg-gray-300 text-gray-500'
            }`}
          >
            {executingPipeline ? 'Ejecutando Pipeline...' : 'Ejecutar Pipeline'}
          </button>
          <button
            onClick={handleDownload}
            disabled={!dataset}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              dataset
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'cursor-not-allowed bg-gray-300 text-gray-500'
            }`}
          >
            Descargar Dataset
          </button>
        </div>

        {pipelineResult && (
          <div className="mt-4 space-y-1 rounded-md bg-green-50 p-4 text-sm">
            <h3 className="font-semibold text-green-800">Resultado del Pipeline</h3>
            <p className="text-green-700">{String(pipelineResult.message ?? '')}</p>
            <div className="grid grid-cols-2 gap-x-4 text-green-700">
              <span>Filas originales: {String(pipelineResult.original_rows ?? '-')}</span>
              <span>Filas resultantes: {String(pipelineResult.resulting_rows ?? '-')}</span>
              <span>Columnas resultantes: {String(pipelineResult.resulting_columns ?? '-')}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default DataPreparationPage