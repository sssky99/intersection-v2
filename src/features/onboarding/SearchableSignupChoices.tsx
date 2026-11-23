"use client";


import type { ProfileQuestion } from "@/types/question";

export function SearchableSignupChoices({ question, selected, onToggle, search, setSearch }: {
  question: ProfileQuestion;
  search: string;
  setSearch: (value: string) => void;
  selected: string[];
  onToggle: (value: string) => void;
}) {

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
  const pill = "rounded-[20px] border border-black/10 bg-[#FCFAF6] px-4 py-3 text-[14px]";
  return (
    <div className="mt-8 space-y-4 pb-24">
      <input aria-label={question.placeholder} placeholder={question.placeholder} value={search}
        disabled={full} maxLength={100} onChange={e => setSearch(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing && term) {
            e.preventDefault();
            add(matching ?? term);
          }
        }}
        className="h-14 w-full rounded-[20px] border border-black/10 bg-[#FCFAF6] px-5 text-base" />
      <div className="flex flex-wrap gap-2">
        {selected.map(value => <button key={value} type="button" aria-label={value + " 삭제"} onClick={() => onToggle(value)} className={pill + " font-bold"}>{value} ×</button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        {available.map(value => <button key={value} type="button" disabled={full} onClick={() => add(value)} className={pill + " disabled:opacity-40"}>+ {value}</button>)}
      </div>
    </div>
  );
}
