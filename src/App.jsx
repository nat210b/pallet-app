import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './components/LandingPage/LandingPage'
import CalculatorPage from './components/CalculatorPage/CalculatorPage'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/calculator" element={<CalculatorPage />} />
      </Routes>
    </BrowserRouter>
  )
}
