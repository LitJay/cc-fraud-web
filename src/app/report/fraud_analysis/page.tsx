"use client"

import FraudAnalysisDashboard from './fraud_analysis_dashboard'

const FraudAnalysisPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            Fraud Analysis 
          </h1>
          <p className="text-muted">
            Detailed fraud transaction analytics and trends
          </p>
        </div>
        
        <FraudAnalysisDashboard />
      </div>
    </div>
  )
}

export default FraudAnalysisPage; 