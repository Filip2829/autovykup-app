import { useEffect, useRef, useState } from "react";

export default function AppSelect({ value, options, onChange, ariaLabel }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);
  const selectedOption =
    options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!selectRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function selectOption(nextValue) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div className="appSelect" ref={selectRef}>
      <button
        type="button"
        className={`appSelectButton ${isOpen ? "isOpen" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        <span>{selectedOption?.label || ""}</span>
        <span className="appSelectArrow">▾</span>
      </button>

      {isOpen && (
        <div className="appSelectMenu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`appSelectOption ${
                option.value === value ? "isSelected" : ""
              }`}
              role="option"
              aria-selected={option.value === value}
              onClick={() => selectOption(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
