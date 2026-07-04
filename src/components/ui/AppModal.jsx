import { useEffect } from "react";

export default function AppModal({ isOpen, title, onClose, children }) {
  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="appModalOverlay" onMouseDown={onClose}>
      <div
        className="appModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="appModalHeader">
          <h2 id="app-modal-title">{title}</h2>
          <button
            type="button"
            className="appModalClose"
            aria-label="Zavřít modal"
            onClick={onClose}
          >
            X
          </button>
        </div>

        <div className="appModalBody">{children}</div>
      </div>
    </div>
  );
}
