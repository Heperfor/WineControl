import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  warningDetails?: string[];
  canDelete: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  message,
  warningDetails = [],
  canDelete,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden pb-safe">
        <div className={`p-5 ${canDelete ? 'bg-amber-50' : 'bg-rose-50'} border-b border-stone-100 flex items-start gap-4`}>
          <div className={`p-2.5 rounded-xl shrink-0 ${canDelete ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-stone-900 text-lg">{title}</h3>
            <p className="text-sm text-stone-600 mt-1">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-stone-400 hover:text-stone-600 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {warningDetails.length > 0 && (
          <div className="p-4 bg-stone-50 border-b border-stone-100 text-xs text-stone-700">
            <span className="font-semibold block mb-1 text-stone-800">
              {canDelete ? 'Registros afectados:' : 'Dependencias que impiden el borrado directo:'}
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-stone-600">
              {warningDetails.map((det, idx) => (
                <li key={idx}>{det}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-4 flex items-center justify-end gap-3 bg-white">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-none min-h-[44px] px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
          >
            {canDelete ? 'Cancelar' : 'Entendido'}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 sm:flex-none min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-rose-700 hover:bg-rose-800 rounded-xl transition-colors cursor-pointer shadow-sm"
            >
              Confirmar Eliminación
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
