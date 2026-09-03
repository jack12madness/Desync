import { useEffect, useState } from "react";
import { Plus, Trash2, Receipt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api, apiError, eur } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const CATEGORIES = ["Development", "Ads", "Hosting", "Design", "General"];

export default function ExpensesTab() {
  const [expenses, setExpenses] = useState([]);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/admin/expenses").then(({ data }) => setExpenses(data)).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!label.trim() || !amount) return;
    setSaving(true);
    try {
      await api.post("/admin/expenses", {
        label: label.trim(), amount: parseFloat(amount),
        category, date: date || null,
      });
      toast.success("Expense added");
      setLabel(""); setAmount(""); setDate(""); setCategory("General");
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/admin/expenses/${id}`);
      toast.success("Expense deleted");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const fieldCls = "bg-[#050B18] border-slate-700 focus-visible:ring-blue-400 font-mono text-sm";

  return (
    <div data-testid="expenses-tab">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-bold uppercase tracking-tight">
          {expenses.length} Expenses
        </h2>
        <div className="font-mono text-sm text-slate-400">
          Total: <span className="text-rose-300 font-bold" data-testid="expenses-total">{eur(total)}</span>
        </div>
      </div>

      <div className="p-5 bg-[#0F1F38] border border-blue-900/40 rounded-lg mb-6">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 mb-4">
          Log an expense — profit on the dashboard updates automatically
        </div>
        <div className="grid sm:grid-cols-5 gap-3">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label *" data-testid="expense-label-input" className={fieldCls} />
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount € *" type="number" step="0.01" min="0" data-testid="expense-amount-input" className={fieldCls} />
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" list="expense-categories" data-testid="expense-category-input" className={fieldCls} />
          <datalist id="expense-categories">
            {CATEGORIES.map((c) => <option key={c} value={c} />)}
          </datalist>
          <Input value={date} onChange={(e) => setDate(e.target.value)} type="date" data-testid="expense-date-input" className={fieldCls} />
          <button
            onClick={add}
            disabled={saving || !label.trim() || !amount}
            data-testid="expense-add-button"
            className="rounded-lg inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-400 text-[#050B18] text-xs font-mono font-bold uppercase tracking-widest hover:bg-blue-300 disabled:opacity-40 transition-all"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      <div className="space-y-2" data-testid="expenses-list">
        {expenses.length === 0 && (
          <div className="text-center py-16 font-mono text-sm text-slate-500 uppercase tracking-[0.25em]">
            No expenses logged
          </div>
        )}
        {expenses.map((e) => (
          <div
            key={e.id}
            className="flex items-center gap-4 p-3 bg-[#0F1F38] border border-blue-900/40 rounded-lg"
            data-testid={`expense-row-${e.id}`}
          >
            <Receipt className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-mono text-sm text-slate-100">{e.label}</span>
              <span className="ml-3 text-[10px] font-mono uppercase tracking-widest text-slate-500">{e.category}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-600">{e.date}</span>
            <span className="font-mono text-sm font-bold text-rose-300">{eur(e.amount)}</span>
            <button
              onClick={() => remove(e.id)}
              data-testid={`expense-delete-${e.id}`}
              className="p-1.5 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
