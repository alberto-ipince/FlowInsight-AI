import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
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
      <MainLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/preparation" element={<DataPreparationPage />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  )
}

export default App