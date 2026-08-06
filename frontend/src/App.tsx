import { useEffect } from 'react'
import MainLayout from '@/layouts/MainLayout'
import { getHealth } from '@/services/healthService'

function App() {
  useEffect(() => {
    getHealth().then((data) => {
      console.log(data)
    })
  }, [])

  return (
    <MainLayout>
      <h1>FlowInsight AI</h1>
    </MainLayout>
  )
}

export default App
