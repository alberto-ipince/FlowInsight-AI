import apiClient from '@/api/apiClient'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatResponse {
  answer: string
}

export async function sendChatMessage(
  datasetId: number,
  messages: ChatMessage[],
): Promise<string> {
  const response = await apiClient.post<ChatResponse>(
    `/datasets/${datasetId}/chat`,
    { messages },
  )
  return response.data.answer
}