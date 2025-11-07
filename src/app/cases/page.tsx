"use client";

import React, { useEffect, useState } from "react";
import LoadingView from "../component/Types/LoadingView";
import ErrorView from "../component/Types/ErrorView";
import CaseModal, { CaseItem } from "./CaseModal";
import GeneralAlert, {
  AlertDialogCommand,
  AlertMode,
} from "../component/GeneralAlert/GeneralAlert";
import PaginationComponent from "../component/Pagination/pagination";

const API = process.env.NEXT_PUBLIC_API ?? "http://localhost:8000";

type Status = "open" | "investigating" | "closed";

export default function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CaseItem | null>(null);
  const [tab, setTab] = useState<Status>("open");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = (currentPage - 1) * itemsPerPage;

      const res = await fetch(
        `${API}/cases?status=${tab}&limit=${itemsPerPage}&offset=${offset}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Your session has expired. Please log in again.");
        }
        throw new Error(`${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      setCases(data.items);
      setTotalItems(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [itemsPerPage, tab]);

  useEffect(() => {
    fetchCases();
  }, [currentPage, itemsPerPage, tab]);

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

 
  const patchStatus = (txnId: string, status: Status) =>
    fetch(`${API}/cases/by-txn/${txnId}?status=${status}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });

  const rollbackFraud = (txn_id: string, status: Status) => {
    return fetch(`${API}/cases/rollback/${txn_id}/?status=${status}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
  };

  const confirmFraud = (c: CaseItem) =>
    GeneralAlert({
      mode: AlertMode.ConfirmOrCancel,
      text: "Confirm this case as fraudulent and close it?",
      callback: async () => {
        try {
          const res = await patchStatus(c.txn_ids[0], "closed");
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          GeneralAlert({
            mode: AlertMode.Success,
            text: "Case confirmed as fraudulent and closed.",
            callback: fetchCases,
          } as AlertDialogCommand);
        } catch (err: any) {
          GeneralAlert({
            mode: AlertMode.Error,
            text: err.message ?? "Update failed",
          } as AlertDialogCommand);
        }
      },
    } as AlertDialogCommand);

  const confirmNotFraud = (c: CaseItem) =>
    GeneralAlert({
      mode: AlertMode.ConfirmOrCancel,
      text: "Mark this case as NOT fraudulent and close it?",
      callback: async () => {
        try {
          const res = await rollbackFraud(c.txn_ids[0], "closed");
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          GeneralAlert({
            mode: AlertMode.Success,
            text: "Case marked as NOT fraudulent and closed.",
            callback: fetchCases,
          } as AlertDialogCommand);
        } catch (err: any) {
          GeneralAlert({
            mode: AlertMode.Error,
            text: err.message ?? "Rollback failed",
          } as AlertDialogCommand);
        }
      },
    } as AlertDialogCommand);

  if (loading) return <LoadingView />;
  if (error) return <ErrorView />;

  return (
    <div className="p-6 flex-col items-center">
      <h1 className="text-2xl font-bold">Cases</h1>
      <div className="mb-6 flex items-center justify-between">
        {/* Group the buttons together */}
        <div className="flex space-x-4">
          {(["open", "investigating", "closed"] as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setTab(s);
              }}
              className={`rounded-full px-4 py-1 text-lg font-medium transition ${
                tab === s
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="text-gray-600 font-medium bold">
          Total Cases: {totalItems}
        </div>
      </div>

      {cases.length === 0 && !loading ? (
        <p className="text-gray-500 text-center mt-8">
          No cases found in this status.
        </p>
      ) : (
        <>
          <ul className="space-y-4">
            {cases.map((c) => {
              const date = String(c.trans_date_trans_time ?? "–");
              const amt = String(
                typeof c.amt === "number" ? c.amt.toFixed(2) : "--"
              );
              return (
                <li
                  key={c.case_id}
                  onClick={() => setSelected(c)}
                  className="cursor-pointer flex justify-between items-center p-4 bg-white rounded shadow hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium">
                      {date} — ${amt}
                    </div>
                    <div className="text-xs text-gray-500">
                      Case #{c.case_id}
                    </div>
                  </div>
                  {(c.status === "open" || c.status === "investigating") && (
                    <div className="space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmFraud(c);
                        }}
                        title="Confirm fraud"
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmNotFraud(c);
                        }}
                        title="Not fraud"
                        className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                      >
                        Not fraud
                      </button>
                    </div>
                  )}
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
        </>
      )}

      {selected && (
        <CaseModal caseData={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
