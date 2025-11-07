"use client"

import FraudAnalyticsDashboard  from './fraud_trend'

const SuccessRatePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            Model Success Rate
          </h1>

        </div>
        
        <FraudAnalyticsDashboard />
      </div>
    </div>
  )
}

export default SuccessRatePage;