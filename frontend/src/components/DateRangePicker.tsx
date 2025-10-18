import { format } from 'date-fns';

const presets = [
  { label: 'This Month', value: 'month' },
  { label: 'This Quarter', value: 'quarter' },
  { label: 'This Year', value: 'year' }
];

type Props = {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
};

export const DateRangePicker = ({ from, to, onChange }: Props) => {
  const handlePreset = (value: string) => {
    const now = new Date();
    let start = new Date(now);
    if (value === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (value === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
    }
    onChange({ from: format(start, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="text-xs uppercase text-slate-400">From</label>
        <input
          type="date"
          value={from}
          onChange={(event) => onChange({ from: event.target.value, to })}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50"
        />
      </div>
      <div>
        <label className="text-xs uppercase text-slate-400">To</label>
        <input
          type="date"
          value={to}
          onChange={(event) => onChange({ from, to: event.target.value })}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50"
        />
      </div>
      <div className="flex gap-2">
        {presets.map((preset) => (
          <button
            key={preset.value}
            className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-brand"
            onClick={() => handlePreset(preset.value)}
            type="button"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
};
