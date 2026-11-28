"use client";

import { useEffect } from "react";
import { Check, Plus, X } from "lucide-react";
import type { ProfileQuestion } from "@/types/question";

const pill = "inline-flex min-h-11 max-w-full items-center justify-center gap-1.5 rounded-[20px] border px-4 py-3 text-[14px] leading-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

export function SearchableSignupChoices({ question, selected, onToggle, search, setSearch }: {
  question: ProfileQuestion;
  search: string;
  setSearch: (value: string) => void;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [question.id]);

  const term = search.trim();
  const suggestions = (question.options ?? []).map(option => typeof option === "string" ? option : option.label);
  const available = suggestions.filter(label =>
    !selected.includes(label) && label.toLowerCase().includes(term.toLowerCase())
  );
  const matching = [...selected, ...suggestions].find(label => label.toLowerCase() === term.toLowerCase());
  if (term && !matching) available.unshift(term);
  const full = question.maxSelections !== undefined && selected.length >= question.maxSelections;

  function add(value: string) {
    if (full || selected.includes(value)) return;
    onToggle(value);
    setSearch("");
  }

  return (
    <div className="mt-8 space-y-4 pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <input aria-label={question.placeholder} placeholder={question.placeholder} value={search}
        disabled={full} maxLength={100} onChange={e => setSearch(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing && term) {
            e.preventDefault();
            add(matching ?? term);
          }
        }}
        className="h-14 w-full rounded-[20px] border border-black/10 bg-[#FCFAF6] px-5 text-base" />
      {selected.length > 0 && (
        <div className="space-y-2">
          <p aria-live="polite" className="text-[12px] font-bold text-black/65">
            선택한 항목 {selected.length}{question.maxSelections !== undefined && ` / ${question.maxSelections}`}
          </p>
          <div className="flex flex-wrap gap-2">
            {selected.map(value => (
              <button key={value} type="button" aria-label={value + " 선택 해제"} aria-pressed={true}
                onClick={() => onToggle(value)}
                className={pill + " border-[#302D29] bg-[#302D29] font-bold text-white"}>
                <Check size={14} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{value}</span>
                <X size={12} className="shrink-0 text-white/70" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        {!term && <p className="text-[12px] text-black/65">후보 {suggestions.length}개</p>}
        <div className="flex flex-wrap gap-2">
          {available.map(value => (
            <button key={value} type="button" disabled={full} aria-label={value + " 추가"} aria-pressed={false}
              onClick={() => add(value)}
              className={pill + " border-black/10 bg-[#FCFAF6] text-black/80 disabled:opacity-40"}>
              <Plus size={14} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{value}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
