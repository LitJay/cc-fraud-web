"use client";
// pages/transactions.tsx
import React, { useState, useEffect } from "react";

export interface Txn {
  id: number;
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

interface Props {
  txn: Txn;
  onClose: () => void;
}

const TransactionModal: React.FC<Props> = ({ txn, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg w-11/12 max-w-md p-6 relative">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
      <h2 className="text-xl font-semibold mb-4">Transaction Detail</h2>
      <div className="space-y-2">
        {Object.entries(txn).map(([key, val]) => (
          <div key={key} className="flex justify-between">
            <span className="font-medium text-gray-600 capitalize">
              {key.replace(/_/g, " ")}:
            </span>
            <span className="text-gray-800">
              {key === "fraud_score" && val != null
                ? `${(val as number).toFixed(2)}%`
                : String(val)}
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default TransactionModal;
