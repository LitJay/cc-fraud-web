"use client";

import React from "react";
import { X } from "lucide-react"; 

export type CaseItem = {
  case_id: number;
  status: "open" | "investigating" | "closed";
  created_at: string;
  txn_ids: string[];
  [key: string]: unknown;
};

interface Props {
  caseData: CaseItem;
  onClose: () => void;
}

const pretty = (k: string) =>
  k
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace("Cc Num", "Card #")
    .replace("Amt", "Amount")
    .replace("Is Fraud", "Fraud");

const statusColor: Record<CaseItem["status"], string> = {
  open: "bg-yellow-100 text-yellow-800",
  investigating: "bg-blue-100 text-blue-800",
  closed: "bg-gray-200 text-gray-700",
};

const CaseModal: React.FC<Props> = ({ caseData, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="relative w-11/12 max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
      {/* header */}
      <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-indigo-600 to-violet-500 px-6 py-4">
        <h2 className="text-lg font-semibold text-white">
          Case #{caseData.case_id}
        </h2>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            statusColor[caseData.status]
          }`}
        >
          {caseData.status.toUpperCase()}
        </span>

        <button
          onClick={onClose}
          aria-label="Close"
          className="text-white/80 transition hover:scale-110 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* body */}
      <div className="max-h-[70vh] overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-gray-300">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries(caseData).map(([k, v]) => {
            if (k.startsWith("_") || k === "txn_ids") return null;

            let display: string | number | boolean = v as any;
            if (k === "fraud_score" && v != null)
              display = `${(v as number).toFixed(2)}%`;
            else if (k === "status") display = (v as string).toUpperCase();
            else if (Array.isArray(v)) display = v.join(", ");

            return (
              <div
                key={k}
                className="rounded-md border border-gray-200 p-3 shadow-sm"
              >
                <div className="mb-1 text-xs font-semibold text-gray-500">
                  {pretty(k)}
                </div>
                <div className="break-all text-sm text-gray-800">
                  {String(display)}
                </div>
              </div>
            );
          })}
        </div>

        {/* txn_ids list */}
        <div className="mt-6">
          <div className="mb-1 text-xs font-semibold text-gray-500">
            Transaction IDs
          </div>
          <ul className="space-y-1 text-sm text-indigo-700">
            {caseData.txn_ids.map((id) => (
              <li key={id} className="break-all">
                {id}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </div>
);

export default CaseModal;
