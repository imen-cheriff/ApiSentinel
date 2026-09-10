import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Keep",
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              danger ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
            }`}
          >
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-600">{message}</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-3 py-1.5 text-xs font-medium text-white ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}