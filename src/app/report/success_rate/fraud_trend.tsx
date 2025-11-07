"use client";
import React from "react";
import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { TrendingUp, AlertTriangle, CheckCircle, Database } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/component/UI/card";
import GeneralAlert, {
  AlertDialogCommand,
  AlertMode,
} from "@/app/component/GeneralAlert/GeneralAlert";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
interface FraudData {
  fraud_count: number;
  fraud_percentage: number;
  non_fraud_count: number;
  non_fraud_percentage: number;
  total_cases: number;
}

interface ChartData {
  name: string;
  value: number;
  color: string;
}

const COLORS = {
  fraud: "#ef4444",
  nonFraud: "#10b981",
  primary: "#1f2937",
  secondary: "#f59e0b",
  muted: "#64748b",
};

const LoadingSkeleton = () => {
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
        <Card>
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-100 rounded animate-pulse mt-2" />
          </CardHeader>
          <CardContent>
            <div className="h-32 bg-gray-50 rounded animate-pulse" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900">{data.name}</p>
        <p className="text-sm text-gray-600">{data.value.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
};

const FraudAnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<FraudData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<"day" | "month" | "year">(
    "month"
  );
  const [lineData, setLineData] = useState([]);
  const [lineLoading, setLineLoading] = useState(true);
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem("token");
        const response = await fetch(
          "http://localhost:8000/fraud/successRate",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }

        const result = await response.json();
        setData(result);
        console.log("Fraud data fetched:", data);
      } catch (err) {
        console.error("Error fetching fraud data:", err);
        setError("Failed to load fraud analytics data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  useEffect(() => {
    setLineLoading(true);
    fetch(`http://localhost:8000/cases/timeseries?granularity=${granularity}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((res) => res.json())
      .then((d) => setLineData(d))
      .finally(() => setLineLoading(false));
  }, [granularity]);

  if (error) {
    GeneralAlert({
      mode: AlertMode.Error,
      text: error,
    } as AlertDialogCommand);
  }

  if (!data) {
  } else {
    let chartData: ChartData[] = [
      {
        name: "Fraudulent Cases",
        value: data.fraud_percentage,
        color: COLORS.fraud,
      },
      {
        name: "Non-Fraudulent Cases",
        value: data.non_fraud_percentage,
        color: COLORS.nonFraud,
      },
    ];
    const renderCustomizedLabel = ({
      cx,
      cy,
      midAngle,
      innerRadius,
      outerRadius,
      percent,
    }: any) => {
      const RADIAN = Math.PI / 180;
      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);

      return (
        <text
          x={x}
          y={y}
          fill="white"
          textAnchor={x > cx ? "start" : "end"}
          dominantBaseline="central"
          className="text-sm font-medium"
        >
          {`${(percent * 100).toFixed(1)}%`}
        </text>
      );
    };
    chartData = chartData.filter((d) => d.value > 0);


    const isSingleSlice = chartData.length === 1;
    const pieOuterRadius = isSingleSlice ? 100 : 80;
    const pieLabel = isSingleSlice
      ? ({ cx, cy, percent }: any) => (
          <text
            x={cx}
            y={cy}
            fill="white"
            textAnchor="middle"
            dominantBaseline="central"
            className="text-xl"
          >
            {`${chartData[0].value.toFixed(1)}%`}
          </text>
        )
      : renderCustomizedLabel;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-primary">
                <TrendingUp className="h-5 w-5" />
                Fraud Distribution
              </CardTitle>
              <CardDescription>
                Breakdown of fraudulent vs non-fraudulent cases
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={pieLabel}
                      outerRadius={pieOuterRadius}
                      fill="#8884d8"
                      dataKey="value"
                      stroke="none"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{
                        paddingTop: "20px",
                        fontSize: "14px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Metrics Card */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Database className="h-5 w-5" />
                Case Statistics
              </CardTitle>
              <CardDescription>
                Total cases processed and key metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Total Cases */}
              <div className="text-center p-6 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl">
                <div className="text-3xl font-bold text-primary mb-2">
                  {data.total_cases.toLocaleString()}
                </div>
                <div className="text-sm text-muted font-medium">
                  Total Cases Processed
                </div>
              </div>

              {/* Fraud vs Non-Fraud Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">
                      Fraud
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">
                    {data.fraud_percentage.toFixed(1)}%
                  </div>
                </div>

                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Clean
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {data.non_fraud_percentage.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Additional Stats */}
              <div className="pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted">Fraud Cases:</span>
                    <span className="font-medium text-primary ml-2">
                      {Math.round(
                        (data.fraud_percentage * data.total_cases) / 100
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted">Clean Cases:</span>
                    <span className="font-medium text-primary ml-2">
                      {Math.round(
                        (data.non_fraud_percentage * data.total_cases) / 100
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="mt-8">
          <div className="flex space-x-2 mb-4">
            {["day", "month", "year"].map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g as "day" | "month" | "year")}
                className={`px-4 py-1 rounded-full font-medium ${
                  granularity === g
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
          {lineLoading ? (
            <div>Loading chart...</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
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
                />
                <Line
                  type="monotone"
                  dataKey="non_fraud_count"
                  stroke="#10b981"
                  name="Non-Fraud Cases"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    );
  }
};

export default FraudAnalyticsDashboard;
