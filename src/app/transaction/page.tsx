"use client";

import React, { useEffect, useState } from "react";
import GeneralAlert, {
  AlertDialogCommand,
  AlertMode,
} from "../component/GeneralAlert/GeneralAlert";
import LoadingView from "../component/Types/LoadingView";
import ErrorView from "../component/Types/ErrorView";
import { Filter, Search } from "lucide-react";
import PaginationComponent from "../component/Pagination/pagination";

/* -------- backend payload -------- */
export interface Txn {
  record_id: number;
  txn_id?: string;
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
  is_fraud: number;
  fraud_score?: number;
}

const API = process.env.NEXT_PUBLIC_API ?? "http://localhost:8000";

const TransactionPage: React.FC = () => {
  const [txns, setTxns] = useState<Txn[]>([]);
   const [role, setRole] = useState<string | null>(null);
  const [selected, setSel] = useState<Txn | null>(null);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [downloadCategory, setDownloadCategory] = useState<string>("");

  const [searchCcNum, setSearchCcNum] = useState("");
  const [filters, setFilters] = useState({
    merchant: "",
    category: "",
    minAmount: "",
    maxAmount: "",
    startDate: "",
    endDate: "",
  });
  const [inputFilters, setInputFilters] = useState({ ...filters });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  

  const fetchTransactions = async () => {
    setLoad(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const offset = (currentPage - 1) * itemsPerPage;

      const params = new URLSearchParams({
        limit: String(itemsPerPage),
        offset: String(offset),
      });
      if (searchCcNum) params.append("cc_num", searchCcNum);
      if (filters.merchant) params.append("merchant", filters.merchant);
      if (filters.category) params.append("category", filters.category);
      if (filters.minAmount) params.append("min_amount", filters.minAmount);
      if (filters.maxAmount) params.append("max_amount", filters.maxAmount);
      if (filters.startDate) params.append("start_date", filters.startDate);
      if (filters.endDate) params.append("end_date", filters.endDate);

      const res = await fetch(`${API}/transactions/new?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      const data = await res.json();
      setTxns(data.items);
      setTotalItems(data.total);
    } catch (err: any) {
      setError(err.message);
      GeneralAlert({
        mode: AlertMode.Error,
        text: `Failed to fetch transactions: ${err.message}`,
      } as AlertDialogCommand);
    } finally {
      setLoad(false);
    }
  };
  useEffect(() => {
   
    const userRole = localStorage.getItem("role");
    setRole(userRole);
  }, []);
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filters, searchCcNum, itemsPerPage]);

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, filters, searchCcNum, itemsPerPage]);

  const applyFilters = () => {
    setFilters(inputFilters);
  };

  const clearFilters = () => {
    const emptyFilters = {
      merchant: "",
      category: "",
      minAmount: "",
      maxAmount: "",
      startDate: "",
      endDate: "",
    };
    setInputFilters(emptyFilters);
    setFilters(emptyFilters);
    setSearchCcNum("");
  };

  const handleDownload = async () => {
    if (!downloadCategory) return;
    try {
      const response = await fetch(
        `${API}/transactions/export/${downloadCategory}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      if (!response.ok) throw new Error("Failed to download CSV");
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${downloadCategory}_transactions.csv`;
      link.click();
    } catch (error) {
      GeneralAlert({
        mode: AlertMode.Error,
        text: `Download failed`,
      } as AlertDialogCommand);
    }
  };

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (loading) return <LoadingView />;
  if (error) return <ErrorView />;

  return (
    <div className="p-6 bg-gray-50">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900">
          Transaction History
        </h1>
        <div className="text-lg font-medium text-gray-600">
          Total Transactions: {totalItems}
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="mb-6 flex items-center gap-4">
        <Search className="h-5 w-5 text-gray-500" />
        <input
          type="text"
          value={searchCcNum}
          onChange={(e) => setSearchCcNum(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          placeholder="Search by CC Number..."
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
          data-testid="filter-button"
        >
          <Filter className="h-5 w-5 text-blue-600" />
        </button>
      </div>
      {role==="admin" && <div className="mb-6 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">
          Download Transactions
        </label>
        <select
          className="w-52 rounded-lg border border-gray-300 px-4 py-2 text-sm"
          onChange={(e) => setDownloadCategory(e.target.value)}
          value={downloadCategory}
        >
          <option value="">Select Category</option>
          <option value="all">All Transactions</option>
          <option value="fraud">Fraud Transactions Only</option>
        </select>
        <button
          onClick={handleDownload}
          className="ml-4 px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          disabled={!downloadCategory}
        >
          Download CSV
        </button>
      </div>}
     

      {/* Filter Section */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-white p-6 rounded-lg shadow-md mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Merchant</label>
            <input
              type="text"
              value={inputFilters.merchant}
              onChange={(e) =>
                setInputFilters({ ...inputFilters, merchant: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
              placeholder="Filter by merchant..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <input
              type="text"
              value={inputFilters.category}
              onChange={(e) =>
                setInputFilters({ ...inputFilters, category: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
              placeholder="Filter by category..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Min Amount</label>
            <input
              type="number"
              value={inputFilters.minAmount}
              onChange={(e) =>
                setInputFilters({
                  ...inputFilters,
                  minAmount: e.target.value,
                })
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
              placeholder="Min amount..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max Amount</label>
            <input
              type="number"
              value={inputFilters.maxAmount}
              onChange={(e) =>
                setInputFilters({
                  ...inputFilters,
                  maxAmount: e.target.value,
                })
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
              placeholder="Max amount..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={inputFilters.startDate}
              onChange={(e) =>
                setInputFilters({
                  ...inputFilters,
                  startDate: e.target.value,
                })
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={inputFilters.endDate}
              onChange={(e) =>
                setInputFilters({ ...inputFilters, endDate: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
            />
          </div>
          <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex justify-end gap-4">
            <button
              onClick={applyFilters}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Apply Filters
            </button>
            <button
              onClick={clearFilters}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <ul className="space-y-4">
        {txns.map((txn, idx) => {
          const key = txn.record_id ?? txn.txn_id ?? idx;
          return (
            <li
              key={key}
              onClick={() => setSel(txn)}
              className="cursor-pointer bg-white p-4 rounded-lg shadow-md hover:bg-gray-50 flex justify-between"
            >
              <span>{txn.trans_date_trans_time}</span>
              <span>${txn.amt.toFixed(2)}</span>
              <span
                className={
                  txn.is_fraud
                    ? "text-red-500 font-semibold"
                    : "text-green-500 font-semibold"
                }
              >
                {txn.is_fraud ? "Fraud" : "OK"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-8">
        <PaginationComponent
          itemsPerPage={itemsPerPage}
          totalItems={totalItems}
          currentPage={currentPage}
          paginate={paginate}
          setItemsPerPage={setItemsPerPage}
        />
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-11/12 max-w-md">
            <h2 className="text-xl font-semibold mb-4">Transaction Detail</h2>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Date:</strong> {selected.trans_date_trans_time}
              </p>
              <p>
                <strong>Amount:</strong> ${selected.amt.toFixed(2)}
              </p>
              <p>
                <strong>Fraud:</strong> {selected.is_fraud ? "Yes" : "No"}
              </p>
              {selected.fraud_score !== undefined && (
                <p>
                  <strong>Score:</strong> {selected.fraud_score.toFixed(2)}
                </p>
              )}
              <p>
                <strong>Merchant:</strong> {selected.merchant}
              </p>
              <p>
                <strong>Category:</strong> {selected.category}
              </p>
              <p>
                <strong>Card Number:</strong> {selected.cc_num}
              </p>
              <p>
                <strong>Name:</strong> {selected.first} {selected.last}
              </p>
              <p>
                <strong>Location:</strong> {selected.city}, {selected.state}
              </p>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setSel(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionPage;
