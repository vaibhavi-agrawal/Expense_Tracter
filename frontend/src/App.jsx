import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowDownUp, Loader2, Plus, RefreshCw } from 'lucide-react'
import './App.css'

const API_BASE = 'http://127.0.0.1:8000'
const PENDING_EXPENSE_KEY = 'expense-tracker-pending-create'

const emptyForm = {
  amount: '',
  category: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || 'Request failed')
  }

  return response.status === 204 ? null : response.json()
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))
}

function App() {
  const [expenses, setExpenses] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortNewestFirst, setSortNewestFirst] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (categoryFilter) params.set('category', categoryFilter)
      if (sortNewestFirst) params.set('sort', 'date_desc')
      const data = await request(`/expenses${params.toString() ? `?${params}` : ''}`)
      setExpenses(data)
    } catch {
      setError('Could not load expenses. Check that the backend is running, then try again.')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, sortNewestFirst])

  const createExpense = useCallback(async (payload, idempotencyKey) => {
    return request('/expenses', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    })
  }, [])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  useEffect(() => {
    const pending = localStorage.getItem(PENDING_EXPENSE_KEY)
    if (!pending) return

    const retryPendingCreate = async () => {
      setSaving(true)
      try {
        const { payload, idempotencyKey } = JSON.parse(pending)
        await createExpense(payload, idempotencyKey)
        localStorage.removeItem(PENDING_EXPENSE_KEY)
        await loadExpenses()
      } catch {
        setError('A previous submit may not have completed. It is safe to submit again.')
      } finally {
        setSaving(false)
      }
    }

    retryPendingCreate()
  }, [createExpense, loadExpenses])

  const categories = useMemo(
    () => [...new Set(expenses.map((expense) => expense.category))].sort((a, b) => a.localeCompare(b)),
    [expenses],
  )

  const total = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
    [expenses],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return

    const payload = {
      amount: form.amount,
      category: form.category.trim(),
      description: form.description.trim(),
      date: form.date,
    }
    const idempotencyKey = crypto.randomUUID()

    setSaving(true)
    setError('')
    localStorage.setItem(PENDING_EXPENSE_KEY, JSON.stringify({ payload, idempotencyKey }))

    try {
      await createExpense(payload, idempotencyKey)
      localStorage.removeItem(PENDING_EXPENSE_KEY)
      setForm(emptyForm)
      await loadExpenses()
    } catch {
      setError('Could not save the expense. Your submit key is kept locally, so retrying will not duplicate it.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Personal finance</p>
          <h1>Expense Tracker</h1>
        </div>
        <button className="icon-button" type="button" onClick={loadExpenses} aria-label="Refresh expenses" title="Refresh expenses">
          <RefreshCw size={18} />
        </button>
      </header>

      {error && (
        <div className="alert" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <section className="layout">
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <h2>Add Expense</h2>
          <label>
            Amount
            <input
              required
              min="0.01"
              step="0.01"
              type="number"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              placeholder="250.00"
            />
          </label>
          <label>
            Category
            <input
              required
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              placeholder="Food"
            />
          </label>
          <label>
            Description
            <textarea
              required
              rows="4"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Lunch with team"
            />
          </label>
          <label>
            Date
            <input
              required
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </label>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
            {saving ? 'Saving' : 'Add expense'}
          </button>
        </form>

        <section className="panel list-panel">
          <div className="list-header">
            <div>
              <h2>Expenses</h2>
              <strong>Total: {formatMoney(total)}</strong>
            </div>
            <div className="controls">
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category">
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <button
                className={sortNewestFirst ? 'secondary-button active' : 'secondary-button'}
                type="button"
                onClick={() => setSortNewestFirst((current) => !current)}
              >
                <ArrowDownUp size={16} />
                Newest first
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th className="amount-cell">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.date}</td>
                    <td>{expense.category}</td>
                    <td>{expense.description}</td>
                    <td className="amount-cell">{formatMoney(expense.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loading && <div className="state"><Loader2 className="spin" size={18} /> Loading expenses</div>}
          {!loading && expenses.length === 0 && <div className="state">No expenses found.</div>}
        </section>
      </section>
    </main>
  )
}

export default App
