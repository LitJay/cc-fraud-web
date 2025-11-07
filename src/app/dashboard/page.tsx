"use client";
// pages/dashboard.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import GeneralAlert, {
  AlertDialogCommand,
  AlertMode,
} from "../component/GeneralAlert/GeneralAlert";

interface TxnIn {
  trans_date_trans_time: string;
  cc_num: number;
  merchant: string;
  category: string;
  amt: number;
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
}

interface DetectOut {
  is_fraud: number;
  score?: number;
}

export default function Dashboard() {
  const [form, setForm] = useState<TxnIn>({
    trans_date_trans_time: "",
    cc_num: 0,
    merchant: "",
    category: "",
    amt: 0,
    first: "",
    last: "",
    gender: "",
    street: "",
    city: "",
    state: "",
    zip: 0,
    lat: 0,
    long: 0,
    city_pop: 0,
    job: "",
    dob: "",
    unix_time: 0,
    merch_lat: 0,
    merch_long: 0,
  });
  const [result, setResult] = useState<DetectOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log(localStorage.getItem("role"));
  }, []);
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name as keyof TxnIn]: [
        "cc_num",
        "amt",
        "zip",
        "lat",
        "long",
        "city_pop",
        "unix_time",
        "merch_lat",
        "merch_long",
      ].includes(name)
        ? Number(value)
        : value,
    }));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isIncomplete = Object.values(form).some(
      (value) => value === "" || value === 0
    );
    if (isIncomplete) {
      GeneralAlert({
        mode: 2,
        text: "All fields must be filled",
      } as AlertDialogCommand);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Please log in first");

      /* 1. run detection */
      const { data: detectData } = await axios.post<DetectOut>(
        "http://localhost:8000/detect",
        form,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResult(detectData);

      const transNum = crypto.randomUUID();
      const txnPayload = {
        ...form,
        trans_num: transNum,
        is_fraud: detectData.is_fraud,
        fraud_score: detectData.score,
      };

      await axios.post("http://localhost:8000/transactions/new", txnPayload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      GeneralAlert({
        mode: 3,
        text: "Transaction stored successfully!",
      } as AlertDialogCommand);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
      GeneralAlert({
        mode: 2,
        text: err.response?.data?.detail || err.message || "Unexpected error",
      } as AlertDialogCommand);
      console.error("Detection error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col items-center py-12 px-4">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-10 tracking-tight text-center">
        Fraud Detection Dashboard
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-5xl space-y-8"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              label: "Transaction Time",
              name: "trans_date_trans_time",
              type: "text",
              placeholder: "1/1/19 0:00",
            },
            { label: "Card Number", name: "cc_num", type: "number" },
            { label: "Merchant", name: "merchant", type: "text" },
            { label: "Category", name: "category", type: "text" },
            { label: "Amount", name: "amt", type: "number", step: "0.01" },
            { label: "First Name", name: "first", type: "text" },
            { label: "Last Name", name: "last", type: "text" },
            {
              label: "Gender",
              name: "gender",
              type: "select",
              options: ["M", "F"],
            },
            { label: "Street", name: "street", type: "text" },
            { label: "City", name: "city", type: "text" },
            { label: "State", name: "state", type: "text" },
            { label: "ZIP", name: "zip", type: "number" },
            { label: "Latitude", name: "lat", type: "number", step: "0.0001" },
            {
              label: "Longitude",
              name: "long",
              type: "number",
              step: "0.0001",
            },
            { label: "City Population", name: "city_pop", type: "number" },
            { label: "Job", name: "job", type: "text" },
            {
              label: "Date of Birth",
              name: "dob",
              type: "text",
              placeholder: "M/D/YY",
            },
            { label: "Unix Time", name: "unix_time", type: "number" },
            {
              label: "Merchant Latitude",
              name: "merch_lat",
              type: "number",
              step: "0.0001",
            },
            {
              label: "Merchant Longitude",
              name: "merch_long",
              type: "number",
              step: "0.0001",
            },
          ].map((field, idx) => (
            <div key={idx} className="space-y-2">
              <label
                htmlFor={field.name}
                className="block text-sm font-medium text-gray-800"
              >
                {field.label}
              </label>
              {field.type === "select" ? (
                <select
                  id={field.name}
                  name={field.name}
                  value={form[field.name as keyof TxnIn]} // Type assertion here
                  onChange={handleChange}
                  className="w-full border-2 border-gray-300 px-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 transition duration-200"
                >
                  <option value="">Select</option>
                  {field.options?.map((option, i) => (
                    <option key={i} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  placeholder={field.placeholder || ""}
                  value={form[field.name as keyof TxnIn]} // Type assertion here
                  onChange={handleChange}
                  className="w-full border-2 border-gray-300 px-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 transition duration-200"
                />
              )}
            </div>
          ))}
        </div>
        <button
          id="submit"
          type="submit"
          disabled={loading}
          className="mt-8 w-full bg-blue-600 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Detecting..." : "Run Detection"}
        </button>
      </form>

      {error && (
        <div className="mt-6 text-red-700 font-semibold bg-red-100 p-4 rounded-lg w-full max-w-5xl">
          <strong>Error: </strong> {error}
        </div>
      )}

      {result && (
        <div className="mt-8 bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Detection Result
          </h2>
          <p className="text-lg">
            <strong>Fraud:</strong>{" "}
            {result.is_fraud === 1 ? (
              <span className="text-red-600 font-medium">Yes</span>
            ) : (
              <span className="text-green-600 font-medium">No</span>
            )}
          </p>
          {result.score != null && (
            <p className="text-lg mt-2">
              <strong>Score: </strong> {(result.score * 100).toFixed(2)}%
            </p>
          )}
        </div>
      )}
    </div>
  );
}
