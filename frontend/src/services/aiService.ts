import apiClient from '@/api/apiClient'

interface AIAnalysisResponse {
  insights: string[]
  recommended_dashboard: string[]
  warnings: string[]
}

export async function getAIAnalysis(datasetId: number): Promise<AIAnalysisResponse> {
  const response = await apiClient.get<AIAnalysisResponse>(
    `/datasets/${datasetId}/ai-analysis`,
  )
  return response.data
}