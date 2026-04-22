import { useEffect, useMemo, useRef, useState } from "react";

function formatLabel(options, value, multiple, placeholder) {
  if (multiple) {
    if (!Array.isArray(value) || !value.length) {
      return placeholder;
    }

    return options
      .filter((option) => value.includes(option.value))
      .map((option) => option.label)
      .join(", ");
  }

  const activeOption = options.find((option) => option.value === value);
  return activeOption?.label || placeholder;
}

export function DropdownSelect({
  value,
  onChange,
  options,
  placeholder = "Выберите",
  multiple = false,
  className = "",
}) {
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const label = useMemo(
    () => formatLabel(options, value, multiple, placeholder),
    [multiple, options, placeholder, value],
  );

  function handleSelect(optionValue) {
    if (multiple) {
      const current = Array.isArray(value) ? value : [];
      const nextValue = current.includes(optionValue)
        ? current.filter((item) => item !== optionValue)
        : [...current, optionValue];
      onChange(nextValue);
      return;
    }

    onChange(optionValue);
    setIsOpen(false);
  }

  return (
    <div ref={rootRef} className={`dropdown-select ${className}${isOpen ? " dropdown-select--open" : ""}`}>
      <button
        className="dropdown-select__trigger"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={`dropdown-select__value${label === placeholder ? " dropdown-select__value--placeholder" : ""}`}>
          {label}
        </span>
        <span className="dropdown-select__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen ? (
        <div className="dropdown-select__menu">
          {options.map((option) => {
            const isSelected = multiple
              ? Array.isArray(value) && value.includes(option.value)
              : value === option.value;

            return (
              <button
                key={option.value}
                className={`dropdown-select__option${isSelected ? " dropdown-select__option--selected" : ""}`}
                type="button"
                onClick={() => handleSelect(option.value)}
              >
                <span>{option.label}</span>
                {isSelected ? <span className="dropdown-select__check">✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
