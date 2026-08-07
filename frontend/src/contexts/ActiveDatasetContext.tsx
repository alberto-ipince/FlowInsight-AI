import { createContext, useContext, useState, type ReactNode } from 'react'

interface DatasetRecord {
  id: number
  name: string
  original_filename: string
  file_path: string
  file_size: number
  file_type: string
  created_at: string
}

interface ActiveDatasetContextType {
  activeDatasetId: number | null
  setActiveDatasetId: (id: number | null) => void
  activeDataset: DatasetRecord | null
  setActiveDataset: (ds: DatasetRecord | null) => void
}

const ActiveDatasetContext = createContext<ActiveDatasetContextType>({
  activeDatasetId: null,
  setActiveDatasetId: () => {},
  activeDataset: null,
  setActiveDataset: () => {},
})

export function ActiveDatasetProvider({ children }: { children: ReactNode }) {
  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(null)
  const [activeDataset, setActiveDataset] = useState<DatasetRecord | null>(null)

  return (
    <ActiveDatasetContext.Provider
      value={{ activeDatasetId, setActiveDatasetId, activeDataset, setActiveDataset }}
    >
      {children}
    </ActiveDatasetContext.Provider>
  )
}

export function useActiveDataset() {
  return useContext(ActiveDatasetContext)
}