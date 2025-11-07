"use client";

import React, { useEffect, useState, FormEvent } from "react";
import { Pencil, Trash } from "lucide-react";
import GeneralAlert, {
  AlertDialogCommand,
  AlertMode,
} from "../component/GeneralAlert/GeneralAlert";
import LoadingView from "../component/Types/LoadingView";
import ErrorView from "../component/Types/ErrorView";
import PaginationComponent from "../component/Pagination/pagination";

export interface StaffUser {
  id: number;
  email: string;
  user_name: string;
  role: "staff" | "admin";
}

const apiBase = process.env.NEXT_PUBLIC_API ?? "http://localhost:8000";
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const StaffUserPage: React.FC = () => {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [deleting, setDeleting] = useState<StaffUser | null>(null);

  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const res = await fetch(
        `${apiBase}/staff?limit=${itemsPerPage}&offset=${offset}`,
        { headers: authHeader() }
      );
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      const data = await res.json();
      setStaff(data.items);
      setTotalItems(data.total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [itemsPerPage]);

  useEffect(() => {
    setRole(localStorage.getItem("role"));
    fetchStaff();
  }, [currentPage, itemsPerPage]);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const body = {
      email: formData.get("email"),
      password: formData.get("password"),
      user_name: formData.get("user_name"),
      role: formData.get("role"),
    };
    try {
      const res = await fetch(`${apiBase}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const newUser: StaffUser = await res.json();
      GeneralAlert({
        mode: AlertMode.Success,
        text: `User ${newUser.user_name} added`,
        callback: () => {
          if (currentPage !== 1) {
            setCurrentPage(1);
          } else {
            fetchStaff();
          }
        },
      } as AlertDialogCommand);
      setShowAdd(false);
      form.reset();
    } catch (err: any) {
      GeneralAlert({
        mode: AlertMode.Error,
        text: `Add failed: ${err.message}`,
      } as AlertDialogCommand);
    }
  };

  const handleEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = formData.get("email") as string;
    const user_name = formData.get("user_name") as string;
    const role = formData.get("role") as string;
    const password = (formData.get("password") as string) || undefined;
    const body: any = { email, user_name, role };
    if (password) body.password = password;

    try {
      const res = await fetch(`${apiBase}/staff/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const updated: StaffUser = await res.json();
      GeneralAlert({
        mode: AlertMode.Success,
        text: `User ${updated.user_name} updated`,
        callback: fetchStaff,
      } as AlertDialogCommand);
      setEditing(null);
    } catch (err: any) {
      GeneralAlert({
        mode: AlertMode.Error,
        text: `Update failed: ${err.message}`,
      } as AlertDialogCommand);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const res = await fetch(`${apiBase}/staff/${deleting.id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      GeneralAlert({
        mode: AlertMode.Success,
        text: `User ${deleting.user_name} deleted`,
        callback: () => {
          if (staff.length === 1 && currentPage > 1) {
            setCurrentPage(currentPage - 1);
          } else {
            fetchStaff();
          }
        },
      } as AlertDialogCommand);
    } catch (err: any) {
      GeneralAlert({
        mode: AlertMode.Error,
        text: `Delete failed: ${err.message}`,
      } as AlertDialogCommand);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <LoadingView />;
  if (error) return <ErrorView />;

  return (
    <div className="p-4">
      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Staff Users</h1>
        {role === "admin" && (
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add User
          </button>
        )}
      </div>

      {/* table */}
      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                ID
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Email
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Username
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Role
              </th>
              {role === "admin" && (
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {staff.length > 0 ? (
              staff.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap">{u.id}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{u.email}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{u.user_name}</td>
                  <td className="px-4 py-2 whitespace-nowrap capitalize">
                    {u.role}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap flex items-center space-x-3">
                    {role === "admin" && (
                      <>
                        <button
                          onClick={() => setEditing(u)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => setDeleting(u)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <Trash size={18} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No staff accounts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- RENDER PAGINATION COMPONENT --- */}
      <div className="mt-8">
        <PaginationComponent
          itemsPerPage={itemsPerPage}
          totalItems={totalItems}
          currentPage={currentPage}
          paginate={paginate}
          setItemsPerPage={setItemsPerPage}
        />
      </div>

      {/* --- MODALS (No changes here) --- */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} title="Add New Staff User">
          <form onSubmit={handleAdd} className="space-y-4">
            <Input label="Email" name="email" type="email" required />
            <Input label="Password" name="password" type="password" required />
            <Input label="Username" name="user_name" required />
            <Select label="Role" name="role" required defaultValue="staff">
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </Select>
            <ModalActions
              onCancel={() => setShowAdd(false)}
              submitLabel="Save"
            />
          </form>
        </Modal>
      )}

      {editing && (
        <Modal
          onClose={() => setEditing(null)}
          title={`Edit: ${editing.user_name}`}
        >
          <form onSubmit={handleEdit} className="space-y-4">
            <Input
              label="Email"
              name="email"
              type="email"
              defaultValue={editing.email}
              required
            />
            <Input
              label="Username"
              name="user_name"
              defaultValue={editing.user_name}
              required
            />
            <Input
              label="New Password (optional)"
              name="password"
              type="password"
            />
            <Select
              label="Role"
              name="role"
              required
              defaultValue={editing.role}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </Select>
            <ModalActions
              onCancel={() => setEditing(null)}
              submitLabel="Update"
            />
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal onClose={() => setDeleting(null)} title="Confirm Delete">
          <p className="mb-6">
            Are you sure you want to delete{" "}
            <strong>{deleting.user_name}</strong>?
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setDeleting(null)}
              className="px-4 py-2 bg-gray-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

/* ------------------ small reusable ui bits --------------------- */
interface ModalProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}
const Modal: React.FC<ModalProps> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
    <div className="bg-white rounded-lg w-11/12 max-w-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}
const Input: React.FC<InputProps> = ({ label, name, ...props }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium mb-1">
      {label}
    </label>
    <input
      id={name}
      name={name}
      {...props}
      className="w-full px-3 py-2 border rounded"
    />
  </div>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}
const Select: React.FC<SelectProps> = ({ label, name, children, ...props }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium mb-1">
      {label}
    </label>
    <select
      id={name}
      name={name}
      {...props}
      className="w-full px-3 py-2 border rounded bg-white"
    >
      {children}
    </select>
  </div>
);

interface ModalActionsProps {
  onCancel: () => void;
  submitLabel: string;
}
const ModalActions: React.FC<ModalActionsProps> = ({
  onCancel,
  submitLabel,
}) => (
  <div className="flex justify-end space-x-3 pt-2">
    <button
      type="button"
      onClick={onCancel}
      className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
    >
      Cancel
    </button>
    <button
      type="submit"
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      {submitLabel}
    </button>
  </div>
);

export default StaffUserPage;
