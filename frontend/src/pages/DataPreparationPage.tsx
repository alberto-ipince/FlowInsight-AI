import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActiveDataset } from '@/contexts/ActiveDatasetContext'
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

type CleanMode = 'analyze' | 'clean'

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

  const [cleanMode, setCleanMode] = useState<CleanMode>('analyze')

  // ETL Pipeline state — radio groups
  const [dupMode, setDupMode] = useState<'none' | 'remove'>('none')
  const [nullMode, setNullMode] = useState<'none' | 'remove'>('none')
  const [textMode, setTextMode] = useState<'none' | 'normalize'>('none')
  const [typeMode, setTypeMode] = useState<'none' | 'convert'>('none')
  const [headerMode, setHeaderMode] = useState<'none' | 'rename'>('none')
  const [filterMode, setFilterMode] = useState<'none' | 'apply'>('none')
  const [filterQuery, setFilterQuery] = useState('')

  const [pipelineResult, setPipelineResult] = useState<Record<string, unknown> | null>(null)
  const [executingPipeline, setExecutingPipeline] = useState(false)
  const [previewResult, setPreviewResult] = useState<Record<string, unknown> | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const { setActiveDatasetId } = useActiveDataset()
  const navigate = useNavigate()

  const pipelineActive =
    dupMode !== 'none' || nullMode !== 'none' || textMode !== 'none' ||
    typeMode !== 'none' || headerMode !== 'none' || filterMode !== 'none'

  const buildSteps = () => {
    const steps: Record<string, unknown>[] = []
    if (dupMode === 'remove') steps.push({ operation: 'remove_duplicates', params: {} })
    if (nullMode === 'remove') steps.push({ operation: 'remove_missing_values', params: {} })
    if (textMode === 'normalize') steps.push({ operation: 'normalize_text', params: {} })
    if (typeMode === 'convert') steps.push({ operation: 'convert_column_types', params: {} })
    if (headerMode === 'rename') steps.push({ operation: 'rename_columns', params: {} })
    if (filterMode === 'apply') steps.push({ operation: 'filter_rows', params: { query: filterQuery } })
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
      await fetchAllData(dataset.id)
    } catch {
      setPipelineResult({ message: 'Error ejecutando limpieza' } as Record<string, unknown>)
    } finally {
      setExecutingPipeline(false)
    }
  }

  const handlePreview = async () => {
    if (!dataset) return
    setLoadingPreview(true)
    setPreviewResult(null)
    try {
      const response = await apiClient.post(`/datasets/${dataset.id}/pipeline/preview`, {
        steps: buildSteps(),
      })
      setPreviewResult(response.data)
    } catch {
      setPreviewResult({ message: 'Error generating preview' } as Record<string, unknown>)
    } finally {
      setLoadingPreview(false)
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
    setPipelineResult(null)
    setCleanMode('analyze')

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
      setActiveDatasetId(uploaded.id)
      setSuccess(`Archivo "${file.name}" subido correctamente.`)

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

  const hasProblems = quality
    ? Number(quality.duplicated_rows ?? 0) > 0 ||
      Number(quality.total_missing_values ?? 0) > 0 ||
      (quality.empty_columns as string[])?.length > 0
    : false

  const showDiagnosis = loadingProfile || profile !== null
  const showProblems = loadingQuality || quality !== null

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Preparación de Datos</h1>

      {/* 1. Subir Dataset */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">1. Subir Dataset</h2>
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

      {/* 2. Diagnóstico del Dataset */}
      {showDiagnosis && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-700">2. Diagnóstico del Dataset</h2>
          {loadingProfile || !profile ? (
            <p className="text-sm text-blue-600">Analizando dataset...</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <span className="text-gray-500">Nombre original</span>
                <span className="font-medium text-gray-800">{dataset?.original_filename}</span>

                <span className="text-gray-500">Total de filas</span>
                <span className="font-medium text-gray-800">{String(profile.total_rows ?? '-')}</span>

                <span className="text-gray-500">Total de columnas</span>
                <span className="font-medium text-gray-800">{String(profile.total_columns ?? '-')}</span>

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
                          <th key={col} className="px-3 py-2 font-medium text-gray-600">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(profile.preview as Record<string, unknown>[])?.map(
                        (row, idx: number) => (
                          <tr key={idx} className="even:bg-gray-50/50">
                            {(profile.column_names as string[])?.map((col: string) => (
                              <td key={col} className="whitespace-nowrap px-3 py-1.5 text-gray-700">
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
          )}
        </section>
      )}

      {/* 3. Problemas detectados */}
      {showProblems && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-700">3. Problemas detectados</h2>
          {loadingQuality || !quality ? (
            <p className="text-sm text-blue-600">Evaluando calidad...</p>
          ) : hasProblems ? (
            <div className="space-y-3 text-sm">
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
                    style={{ width: `${Math.min(Number(quality.quality_score ?? 0), 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <span className="text-gray-500">Filas duplicadas</span>
                <span className="font-medium text-gray-800">
                  {String(quality.duplicated_rows ?? '-')}
                </span>

                <span className="text-gray-500">Valores nulos</span>
                <span className="font-medium text-gray-800">
                  {String(quality.total_missing_values ?? '-')}
                </span>
              </div>

              {(quality.empty_columns as string[])?.length > 0 && (
                <div>
                  <h3 className="mb-1 font-semibold text-gray-700">Columnas completamente vacías</h3>
                  <div className="flex flex-wrap gap-2">
                    {(quality.empty_columns as string[]).map((col: string) => (
                      <span
                        key={col}
                        className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs text-red-800"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-green-600 text-lg">✅</span>
              <p className="text-sm font-medium text-green-700">
                No se detectaron problemas importantes.
              </p>
            </div>
          )}
        </section>
      )}

      {/* 3.5 Recomendaciones automáticas */}
      {quality && profile && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-700">
            💡 Recomendaciones automáticas
          </h2>
          {!hasProblems ? (
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
              <span className="text-green-600 text-lg">✅</span>
              <div>
                <p className="font-medium text-green-800">
                  El dataset se encuentra en buenas condiciones.
                </p>
                <p className="text-green-700">No se recomienda aplicar transformaciones.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {Number(quality.duplicated_rows ?? 0) > 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                  <span className="text-red-600 text-lg">⚠️</span>
                  <div>
                    <p className="font-medium text-red-800">
                      Se detectaron {String(quality.duplicated_rows)} filas duplicadas.
                    </p>
                    <p className="text-red-700">
                      Considera eliminar los registros duplicados.
                    </p>
                  </div>
                </div>
              )}

              {Number(quality.total_missing_values ?? 0) > 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm">
                  <span className="text-yellow-600 text-lg">⚠️</span>
                  <div>
                    <p className="font-medium text-yellow-800">
                      Se detectaron {String(quality.total_missing_values)} valores faltantes.
                    </p>
                    <p className="text-yellow-700">
                      Considera eliminar o completar los valores nulos.
                    </p>
                  </div>
                </div>
              )}

              {(quality.columns_with_missing_values as string[])?.length > 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm">
                  <span className="text-yellow-600 text-lg">ℹ️</span>
                  <div>
                    <p className="font-medium text-yellow-800">
                      Existen columnas con valores faltantes.
                    </p>
                  </div>
                </div>
              )}

              {Number(quality.quality_score ?? 100) < 90 && (
                <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm">
                  <span className="text-yellow-600 text-lg">📊</span>
                  <div>
                    <p className="font-medium text-yellow-800">
                      La calidad general del dataset puede mejorarse.
                    </p>
                    <p className="text-yellow-700">
                      Quality Score actual: {String(quality.quality_score)}/100.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 4. ¿Qué deseas hacer? */}
      {profile && quality && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-700">
            4. ¿Qué deseas hacer con este dataset?
          </h2>
          <div className="space-y-3 text-sm">
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
              <input
                type="radio"
                name="cleanMode"
                value="analyze"
                checked={cleanMode === 'analyze'}
                onChange={() => {
                  setCleanMode('analyze')
                  setPipelineResult(null)
                }}
                className="mt-0.5 h-4 w-4 text-blue-600"
              />
              <div>
                <p className="font-medium text-gray-800">Analizar el archivo sin modificarlo</p>
                <p className="text-gray-500">Ve directamente al dashboard con los datos originales.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
              <input
                type="radio"
                name="cleanMode"
                value="clean"
                checked={cleanMode === 'clean'}
                onChange={() => {
                  setCleanMode('clean')
                  setPipelineResult(null)
                }}
                className="mt-0.5 h-4 w-4 text-blue-600"
              />
              <div>
                <p className="font-medium text-gray-800">Limpiar el archivo antes del análisis</p>
                <p className="text-gray-500">Aplica transformaciones para corregir problemas.</p>
              </div>
            </label>
          </div>
        </section>
      )}

      {/* 5. Configuración ETL — only in clean mode */}
      {cleanMode === 'clean' && profile && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-700">5. Configuración de limpieza</h2>
          <div className="space-y-4">

            {/* 1. Duplicados */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">Duplicados</h3>
              <label className="flex items-center gap-2 text-sm cursor-pointer mb-1">
                <input type="radio" name="dupMode" value="none" checked={dupMode === 'none'} onChange={() => setDupMode('none')} className="text-blue-600" />
                No hacer nada
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="dupMode" value="remove" checked={dupMode === 'remove'} onChange={() => setDupMode('remove')} className="text-blue-600" />
                Eliminar filas idénticas
              </label>
              <p className="mt-1 text-xs text-gray-500">Elimina registros completamente repetidos.</p>
            </div>

            {/* 2. Valores vacíos */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">Valores vacíos</h3>
              <label className="flex items-center gap-2 text-sm cursor-pointer mb-1">
                <input type="radio" name="nullMode" value="none" checked={nullMode === 'none'} onChange={() => setNullMode('none')} className="text-blue-600" />
                No hacer nada
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="nullMode" value="remove" checked={nullMode === 'remove'} onChange={() => setNullMode('remove')} className="text-blue-600" />
                Eliminar filas con valores vacíos
              </label>
              <p className="mt-1 text-xs text-gray-500">Elimina filas que tengan datos faltantes.</p>
            </div>

            {/* 3. Texto */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">Texto</h3>
              <label className="flex items-center gap-2 text-sm cursor-pointer mb-1">
                <input type="radio" name="textMode" value="none" checked={textMode === 'none'} onChange={() => setTextMode('none')} className="text-blue-600" />
                No hacer nada
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="textMode" value="normalize" checked={textMode === 'normalize'} onChange={() => setTextMode('normalize')} className="text-blue-600" />
                Normalizar texto
              </label>
              <p className="mt-1 text-xs text-gray-500">Quita espacios y estandariza el formato.</p>
            </div>

            {/* 4. Tipos de datos */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">Tipos de datos</h3>
              <label className="flex items-center gap-2 text-sm cursor-pointer mb-1">
                <input type="radio" name="typeMode" value="none" checked={typeMode === 'none'} onChange={() => setTypeMode('none')} className="text-blue-600" />
                No hacer nada
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="typeMode" value="convert" checked={typeMode === 'convert'} onChange={() => setTypeMode('convert')} className="text-blue-600" />
                Convertir tipos
              </label>
              <p className="mt-1 text-xs text-gray-500">Convierte números y fechas al formato correcto.</p>
            </div>

            {/* 5. Encabezados */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">Encabezados</h3>
              <label className="flex items-center gap-2 text-sm cursor-pointer mb-1">
                <input type="radio" name="headerMode" value="none" checked={headerMode === 'none'} onChange={() => setHeaderMode('none')} className="text-blue-600" />
                No hacer nada
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="headerMode" value="rename" checked={headerMode === 'rename'} onChange={() => setHeaderMode('rename')} className="text-blue-600" />
                Renombrar columnas
              </label>
              <p className="mt-1 text-xs text-gray-500">Limpia nombres de columnas.</p>
            </div>

            {/* 6. Filtro */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">Filtro</h3>
              <label className="flex items-center gap-2 text-sm cursor-pointer mb-1">
                <input type="radio" name="filterMode" value="none" checked={filterMode === 'none'} onChange={() => setFilterMode('none')} className="text-blue-600" />
                No hacer nada
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="filterMode" value="apply" checked={filterMode === 'apply'} onChange={() => setFilterMode('apply')} className="text-blue-600" />
                Aplicar filtro
              </label>
              <p className="mt-1 text-xs text-gray-500">Conserva únicamente registros que cumplan una condición.</p>
              {filterMode === 'apply' && (
                <div className="mt-3">
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
      )}

      {/* 6. Resultado / Acciones */}
      {profile && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-700">
            {cleanMode === 'clean' ? '6. Resultado de la limpieza' : '5. Continuar'}
          </h2>

          {cleanMode === 'analyze' ? (
            <button
              onClick={() => navigate(`/analytics?dataset_id=${dataset?.id ?? ''}`)}
              disabled={!dataset}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                dataset
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-300 text-gray-500'
              }`}
            >
              Continuar al análisis
            </button>
          ) : (
            <div className="space-y-4">
              {/* Preview card */}
              {previewResult && (
                <div className="space-y-2 rounded-md bg-blue-50 p-4 text-sm">
                  <h3 className="font-semibold text-blue-800">Vista previa</h3>
                  <div className="grid grid-cols-2 gap-x-4 text-blue-700">
                    <span>Filas originales: {String(previewResult.original_rows ?? '-')}</span>
                    <span>Filas finales: {String(previewResult.resulting_rows ?? '-')}</span>
                    <span>Filas eliminadas: {String(previewResult.removed_rows ?? '-')}</span>
                  </div>
                  {(previewResult.operations as string[])?.length > 0 && (
                    <div>
                      <p className="text-blue-700 mt-1">Transformaciones seleccionadas:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(previewResult.operations as string[]).map((op: string) => (
                          <span key={op} className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                            {op}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pipeline result — Resumen de la limpieza */}
              {pipelineResult && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-5 text-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-green-600 text-xl">✅</span>
                    <h3 className="text-lg font-semibold text-green-800">Resumen de la limpieza</h3>
                  </div>
                  <p className="mb-2 text-green-700">Limpieza completada correctamente.</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-green-700">
                    <span>Filas originales:</span>
                    <span className="font-medium">{String(pipelineResult.original_rows ?? '-')}</span>
                    <span>Filas finales:</span>
                    <span className="font-medium">{String(pipelineResult.resulting_rows ?? '-')}</span>
                    <span>Filas eliminadas:</span>
                    <span className="font-medium">
                      {Number(pipelineResult.original_rows ?? 0) - Number(pipelineResult.resulting_rows ?? 0)}
                    </span>
                    <span>Columnas resultantes:</span>
                    <span className="font-medium">{String(pipelineResult.resulting_columns ?? '-')}</span>
                  </div>
                  {buildSteps().length > 0 && (
                    <div className="mt-2">
                      <p className="text-green-700">Transformaciones aplicadas:</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {buildSteps().map((step: Record<string, unknown>) => (
                          <span
                            key={String(step.operation)}
                            className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800"
                          >
                            {String(step.operation)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-4">
                    <button
                      onClick={() => navigate('/analytics')}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Ir al Dashboard
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                {!previewResult ? (
                  <>
                    <button
                      onClick={handlePreview}
                      disabled={!pipelineActive || loadingPreview || !dataset}
                      className={`rounded-md px-4 py-2 text-sm font-medium ${
                        pipelineActive && dataset
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'cursor-not-allowed bg-gray-300 text-gray-500'
                      }`}
                    >
                      {loadingPreview ? 'Calculando...' : 'Vista previa'}
                    </button>
                    <button
                      disabled
                      className="cursor-not-allowed rounded-md bg-gray-300 px-4 py-2 text-sm font-medium text-gray-500"
                    >
                      Aplicar limpieza
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setPreviewResult(null)}
                      className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleRunPipeline}
                      disabled={executingPipeline || !dataset}
                      className={`rounded-md px-4 py-2 text-sm font-medium ${
                        dataset
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'cursor-not-allowed bg-gray-300 text-gray-500'
                      }`}
                    >
                      {executingPipeline ? 'Aplicando limpieza...' : 'Aplicar limpieza'}
                    </button>
                  </>
                )}
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
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default DataPreparationPage