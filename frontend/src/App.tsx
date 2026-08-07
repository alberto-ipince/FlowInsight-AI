import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ActiveDatasetProvider } from '@/contexts/ActiveDatasetContext'
import MainLayout from '@/layouts/MainLayout'
import AnalyticsPage from '@/pages/AnalyticsPage'
import DataPreparationPage from '@/pages/DataPreparationPage'
import { getHealth } from '@/services/healthService'

function HomePage() {
  return <h1>FlowInsight AI</h1>
}

function App() {
  useEffect(() => {
    getHealth().then((data) => {
      console.log(data)
    })
  }, [])

  return (
    <BrowserRouter>
      <ActiveDatasetProvider>
        <MainLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/preparation" element={<DataPreparationPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Routes>
        </MainLayout>
      </ActiveDatasetProvider>
    </BrowserRouter>
  )
}

export default App