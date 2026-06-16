"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export const MBTI_UNKNOWN_VALUE = "모르겠어요";

export const mbtiOptions = [
  "ISTJ",
  "ISFJ",
  "INFJ",
  "INTJ",
  "ISTP",
  "ISFP",
  "INFP",
  "INTP",
  "ESTP",
  "ESFP",
  "ENFP",
  "ENTP",
  "ESTJ",
  "ESFJ",
  "ENFJ",
  "ENTJ",
  MBTI_UNKNOWN_VALUE,
];

export function MbtiSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative mt-1.5">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-12 w-full items-center justify-between rounded-2xl border bg-white px-4 text-left text-sm font-semibold outline-none transition ${
          open
            ? "border-accent shadow-[0_0_0_3px_rgba(111,174,198,0.10)]"
            : "border-black/10"
        }`}
      >
        <span className={value ? "text-black" : "text-black/30"}>
          {value || "선택"}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`text-black/35 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={listboxId}
            role="listbox"
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-[calc(100%+8px)] right-0 z-30 grid w-[210px] grid-cols-2 gap-1 rounded-2xl border border-black/10 bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.14)]"
          >
            {mbtiOptions.map((option) => {
              const selected = value === option;
              const isUnknown = option === MBTI_UNKNOWN_VALUE;

              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={`flex h-9 items-center justify-between rounded-xl px-3 text-xs font-semibold transition ${
                    isUnknown ? "col-span-2" : ""
                  } ${
                    selected
                      ? "bg-black text-white"
                      : "text-black/65 hover:bg-black/[0.045] hover:text-black"
                  }`}
                >
                  <span>{option}</span>
                  {selected && <Check size={13} aria-hidden />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
