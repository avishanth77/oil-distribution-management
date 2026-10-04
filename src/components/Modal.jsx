import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = '550px' }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-[#00141f]/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col my-auto"
        style={{ maxWidth: `min(calc(100vw - 16px), ${maxWidth})` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low/40 shrink-0">
          <h3 className="font-title-lg text-[14px] sm:text-[16px] text-primary font-semibold tracking-tight truncate pr-2">
            {title}
          </h3>
          <button
            type="button"
            className="w-8 h-8 rounded flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-container transition-colors shrink-0"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-3.5 sm:p-5 overflow-y-auto max-h-[calc(92vh-54px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
