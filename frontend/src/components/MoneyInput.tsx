import { ChangeEvent } from 'react';

type Props = {
  value: number;
  onChange: (value: number) => void;
  label?: string;
};

export const MoneyInput = ({ value, onChange, label }: Props) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value || 0);
    onChange(Number.isNaN(next) ? 0 : next);
  };

  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-sm font-medium text-slate-200">{label}</span>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
        <input
          type="number"
          step="0.01"
          value={value.toString()}
          onChange={handleChange}
          className="w-full rounded border border-slate-700 bg-slate-900 py-2 pl-7 pr-3 text-slate-50 focus:border-brand focus:outline-none"
        />
      </div>
    </label>
  );
};
