import apiClient from '@/api/apiClient'

export async function getHealth(): Promise<Record<string, string>> {
  const response = await apiClient.get('/')
  return response.data
}