import { MoneyInput } from './MoneyInput';

export type LineItem = {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
};

type Props = {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
};

export const LineItemTable = ({ items, onChange }: Props) => {
  const updateItem = (index: number, update: Partial<LineItem>) => {
    const next = [...items];
    next[index] = { ...next[index], ...update };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { description: '', quantity: 1, unitPrice: 0, taxable: true }]);
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [{ description: '', quantity: 1, unitPrice: 0, taxable: true }]);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs uppercase text-slate-400">
        <span className="col-span-5">Description</span>
        <span className="col-span-2">Qty</span>
        <span className="col-span-3">Unit Price</span>
        <span className="col-span-1">Taxable</span>
        <span className="col-span-1" />
      </div>
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-12 items-center gap-2 rounded border border-slate-800 bg-slate-900 p-2">
          <input
            className="col-span-5 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
            value={item.description}
            placeholder="Description"
            onChange={(event) => updateItem(index, { description: event.target.value })}
          />
          <input
            type="number"
            className="col-span-2 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
            value={item.quantity}
            onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
            min={0}
            step={0.25}
          />
          <div className="col-span-3">
            <MoneyInput
              value={item.unitPrice}
              onChange={(val) => updateItem(index, { unitPrice: val })}
            />
          </div>
          <label className="col-span-1 flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={item.taxable}
              onChange={(event) => updateItem(index, { taxable: event.target.checked })}
            />
            <span className="sr-only">Taxable</span>
          </label>
          <button
            onClick={() => removeItem(index)}
            className="col-span-1 text-sm text-rose-400"
            type="button"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        type="button"
        className="rounded border border-dashed border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-brand"
      >
        Add line item
      </button>
    </div>
  );
};
