"use client";
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, AlertTriangle, Database, Filter, DollarSign, MapPin, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/component/UI/card';
import GeneralAlert, {
  AlertDialogCommand,
  AlertMode,
} from "@/app/component/GeneralAlert/GeneralAlert";

const API = process.env.NEXT_PUBLIC_API ?? "http://localhost:8000";

interface FraudTransaction {
  id: number;
  trans_num: string;
  cc_num: number;
  merchant: string;
  category: string;
  amt: number;
  trans_date_trans_time: string;
  first: string;
  last: string;
  gender: string;
  street: string;
  city: string;
  state: string;
  zip: number;
  lat: number;
  long: number;
  city_pop: number;
  job: string;
  dob: string;
  unix_time: number;
  merch_lat: number;
  merch_long: number;
  is_fraud: number;
  fraud_score: number;
}

interface FilterState {
  merchant: string;
  category: string;
  state: string;
  minAmount: string;
  maxAmount: string;
  startDate: string;
  endDate: string;
}

interface ChartData {
  name: string;
  value: number;
  color: string;
}

const COLORS = {
  fraud: '#ef4444',
  primary: '#1f2937',
  secondary: '#f59e0b',
  muted: '#64748b'
};
const PIE_COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];

const FraudAnalysisDashboard: React.FC = () => {
  const [transactions, setTransactions] = useState<FraudTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<FraudTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<"day" | "month" | "year">("month");
  const [lineData, setLineData] = useState<Array<{period: string; fraud_count: number}>>([]);
  const [lineLoading, setLineLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    merchant: '',
    category: '',
    state: '',
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: ''
  });

  const [inputFilters, setInputFilters] = useState<FilterState>({
    merchant: '',
    category: '',
    state: '',
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: ''
  });


  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem("token");
        
     
        const params = new URLSearchParams();
        if (filters.merchant) params.append('merchant', filters.merchant);
        if (filters.category) params.append('category', filters.category);
        if (filters.state) params.append('state', filters.state);
        if (filters.minAmount) params.append('min_amount', filters.minAmount);
        if (filters.maxAmount) params.append('max_amount', filters.maxAmount);
        if (filters.startDate) params.append('start_date', filters.startDate);
        if (filters.endDate) params.append('end_date', filters.endDate);
        params.append('limit', '1000');

        const response = await fetch(`${API}/transactions/fraud/analysis?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch fraud transactions');
        }

        const data = await response.json();
        setTransactions(data);
        setFilteredTransactions(data);
        console.log("Fraud transactions fetched:", data);
      } catch (err) {
        console.error('Error fetching fraud transactions:', err);
        setError('Failed to load fraud analysis data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [filters]);


  useEffect(() => {
    let filtered = transactions;

    if (filters.merchant) {
      filtered = filtered.filter(t => t.merchant.toLowerCase().includes(filters.merchant.toLowerCase()));
    }
    if (filters.category) {
      filtered = filtered.filter(t => t.category.toLowerCase().includes(filters.category.toLowerCase()));
    }
    if (filters.state) {
      filtered = filtered.filter(t => t.state.toLowerCase().includes(filters.state.toLowerCase()));
    }
    if (filters.minAmount) {
      filtered = filtered.filter(t => t.amt >= parseFloat(filters.minAmount));
    }
    if (filters.maxAmount) {
      filtered = filtered.filter(t => t.amt <= parseFloat(filters.maxAmount));
    }
    if (filters.startDate) {
      filtered = filtered.filter(t => new Date(t.trans_date_trans_time) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      filtered = filtered.filter(t => new Date(t.trans_date_trans_time) <= new Date(filters.endDate));
    }

    setFilteredTransactions(filtered);
  }, [transactions, filters]);

  useEffect(() => {
    if (filteredTransactions.length === 0) {
      setLineData([]);
      setLineLoading(false);
      return;
    }

    const counts = new Map<string, number>();

    filteredTransactions.forEach(transaction => {
      const date = new Date(transaction.trans_date_trans_time);
      let key: string;

      if (granularity === "day") {
        key = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (granularity === "month") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = date.getFullYear().toString();
      }

      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const chartData = Array.from(counts.entries())
      .map(([period, count]) => ({ period, fraud_count: count }))
      .sort((a, b) => a.period.localeCompare(b.period));

    setLineData(chartData);
    setLineLoading(false);
  }, [filteredTransactions, granularity]);

  const categoryData = React.useMemo(() => {
    const categoryCounts = new Map<string, number>();
    filteredTransactions.forEach(t => {
      categoryCounts.set(t.category, (categoryCounts.get(t.category) || 0) + 1);
    });
  
    return Array.from(categoryCounts.entries())
      .map(([name, value], index) => ({ 
        name, 
        value, 
        color: PIE_COLORS[index % PIE_COLORS.length] 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredTransactions]);

  const applyFilters = () => {
    setFilters(inputFilters);
  };

  const clearFilters = () => {
    const emptyFilters = {
      merchant: '',
      category: '',
      state: '',
      minAmount: '',
      maxAmount: '',
      startDate: '',
      endDate: ''
    };
    setInputFilters(emptyFilters);
    setFilters(emptyFilters);
  };

  if (error) {
    GeneralAlert({
      mode: AlertMode.Error,
      text: error,
    } as AlertDialogCommand);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 bg-gray-100 rounded animate-pulse mt-2" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-50 rounded animate-pulse" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <CardTitle>Filters</CardTitle>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showFilters ? 'Hide' : 'Show'} Filters
            </button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Merchant</label>
                <input
                  type="text"
                  value={inputFilters.merchant}
                  onChange={(e) => setInputFilters({...inputFilters, merchant: e.target.value})}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Filter by merchant..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <input
                  type="text"
                  value={inputFilters.category}
                  onChange={(e) => setInputFilters({...inputFilters, category: e.target.value})}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Filter by category..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">State</label>
                <input
                  type="text"
                  value={inputFilters.state}
                  onChange={(e) => setInputFilters({...inputFilters, state: e.target.value})}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Filter by state..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Min Amount</label>
                <input
                  type="number"
                  value={inputFilters.minAmount}
                  onChange={(e) => setInputFilters({...inputFilters, minAmount: e.target.value})}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Min amount..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Max Amount</label>
                <input
                  type="number"
                  value={inputFilters.maxAmount}
                  onChange={(e) => setInputFilters({...inputFilters, maxAmount: e.target.value})}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Max amount..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  value={inputFilters.startDate}
                  onChange={(e) => setInputFilters({...inputFilters, startDate: e.target.value})}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={inputFilters.endDate}
                  onChange={(e) => setInputFilters({...inputFilters, endDate: e.target.value})}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={applyFilters}
                  className="w-full rounded bg-blue-500 text-white py-2 text-sm hover:bg-blue-600"
                >
                  Apply Filters
                </button>
                <button
                  onClick={clearFilters}
                  className="w-full rounded bg-gray-500 text-white py-2 text-sm hover:bg-gray-600"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-gray-600">Total Fraud Cases</span>
            </div>
            <div className="text-2xl font-bold text-red-600">
              {filteredTransactions.length.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Total Amount</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              ${filteredTransactions.reduce((sum, t) => sum + t.amt, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">Unique States</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {new Set(filteredTransactions.map(t => t.state)).size}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-600">Date Range</span>
            </div>
            <div className="text-sm font-bold text-purple-600">
              {filteredTransactions.length > 0 ? (
                `${new Date(Math.min(...filteredTransactions.map(t => new Date(t.trans_date_trans_time).getTime()))).toLocaleDateString()} - ${new Date(Math.max(...filteredTransactions.map(t => new Date(t.trans_date_trans_time).getTime()))).toLocaleDateString()}`
              ) : 'No data'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-primary">
              <TrendingUp className="h-5 w-5" />
              Fraud Trends Over Time
            </CardTitle>
            <CardDescription>
              Number of fraud cases by {granularity}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex space-x-2">
              {["day", "month", "year"].map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g as "day" | "month" | "year")}
                  className={`px-4 py-1 rounded-full font-medium text-sm ${
                    granularity === g ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
            <div className="h-64">
              {lineLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="fraud_count"
                      stroke="#ef4444"
                      name="Fraud Cases"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  No data available for selected filters
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Database className="h-5 w-5" />
              Top Fraud Categories
            </CardTitle>
            <CardDescription>
              Distribution by transaction category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  No category data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FraudAnalysisDashboard;