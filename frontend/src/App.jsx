import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, Plus, RefreshCw } from 'lucide-react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const PENDING_EXPENSE_KEY = 'expense-tracker-pending-create'
const NEW_CATEGORY_VALUE = '__new_category__'
const DEFAULT_CATEGORIES = [
  'Living',
  'Food & Dining',
  'Transportation',
  'Education',
  'Shopping',
  'Health & Fitness',
  'Entertainment',
  'Travel',
  'Work & Productivity',
  'Bills & Payments',
  'Personal',
  'Miscellaneous',
]

const emptyForm = {
  amount: '',
  category: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
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
  const [allCategories, setAllCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [addingNewCategory, setAddingNewCategory] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('date_desc')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadCategories = useCallback(async () => {
    const data = await request('/categories/')
    setAllCategories(data)
  }, [])

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (categoryFilter) params.set('category', categoryFilter)
      params.set('sort', sortOrder)
      const data = await request(`/expenses${params.toString() ? `?${params}` : ''}`)
      setExpenses(data)
    } catch {
      setError('Could not load expenses. Check that the backend is running, then try again.')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, sortOrder])

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
    loadCategories().catch(() => {
      setError('Could not load categories. Check that the backend is running, then try again.')
    })
  }, [loadCategories])

  useEffect(() => {
    const pending = localStorage.getItem(PENDING_EXPENSE_KEY)
    if (!pending) return

    const retryPendingCreate = async () => {
      setSaving(true)
      try {
        const { payload, idempotencyKey } = JSON.parse(pending)
        await createExpense(payload, idempotencyKey)
        localStorage.removeItem(PENDING_EXPENSE_KEY)
        await loadCategories()
        await loadExpenses()
      } catch {
        setError('A previous submit may not have completed. It is safe to submit again.')
      } finally {
        setSaving(false)
      }
    }

    retryPendingCreate()
  }, [createExpense, loadCategories, loadExpenses])

  const categories = useMemo(
    () => {
      const savedCategories = allCategories.map((category) => category.name)
      const categorySet = new Set([...DEFAULT_CATEGORIES, ...savedCategories])
      return [
        ...DEFAULT_CATEGORIES,
        ...[...categorySet]
          .filter((category) => !DEFAULT_CATEGORIES.includes(category))
          .sort((a, b) => a.localeCompare(b)),
      ]
    },
    [allCategories],
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
      setAddingNewCategory(false)
      await loadCategories()
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
            <select
              required={!addingNewCategory}
              value={addingNewCategory ? NEW_CATEGORY_VALUE : form.category}
              onChange={(event) => {
                if (event.target.value === NEW_CATEGORY_VALUE) {
                  setAddingNewCategory(true)
                  setForm({ ...form, category: '' })
                  return
                }

                setAddingNewCategory(false)
                setForm({ ...form, category: event.target.value })
              }}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
              <option value={NEW_CATEGORY_VALUE}>New category</option>
            </select>
          </label>
          {addingNewCategory && (
            <label>
              New category
              <input
                required
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                placeholder="Coffee"
              />
            </label>
          )}
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
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort by date">
                <option value="date_desc">Date: newest first</option>
                <option value="date_asc">Date: oldest first</option>
              </select>
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
