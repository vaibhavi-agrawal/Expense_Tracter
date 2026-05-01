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

function parseExpenseDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function App() {
  const [expenses, setExpenses] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [addingNewCategory, setAddingNewCategory] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateSort, setDateSort] = useState('date_desc')
  const [amountSort, setAmountSort] = useState('amount_desc')
  const [activeSortType, setActiveSortType] = useState('date')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const activeSort = activeSortType === 'amount' ? amountSort : dateSort

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
      params.set('sort', activeSort)
      const data = await request(`/expenses${params.toString() ? `?${params}` : ''}`)
      setExpenses(data)
    } catch {
      setError('Could not load expenses. Check that the backend is running, then try again.')
    } finally {
      setLoading(false)
    }
  }, [activeSort, categoryFilter])

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
  const today = useMemo(() => new Date(), [])
  const thisMonthTotal = useMemo(
    () => expenses.reduce((sum, expense) => {
      const expenseDate = parseExpenseDate(expense.date)
      const isThisMonth = expenseDate.getFullYear() === today.getFullYear()
        && expenseDate.getMonth() === today.getMonth()
      return isThisMonth ? sum + Number(expense.amount) : sum
    }, 0),
    [expenses, today],
  )
  const lastWeekTotal = useMemo(
    () => {
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - 6)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(today)
      weekEnd.setHours(23, 59, 59, 999)

      return expenses.reduce((sum, expense) => {
        const expenseDate = parseExpenseDate(expense.date)
        return expenseDate >= weekStart && expenseDate <= weekEnd ? sum + Number(expense.amount) : sum
      }, 0)
    },
    [expenses, today],
  )
  const categoryTotals = useMemo(
    () => [...expenses.reduce((totals, expense) => {
      totals.set(expense.category, (totals.get(expense.category) || 0) + Number(expense.amount))
      return totals
    }, new Map())]
      .map(([category, amount]) => ({ category, amount }))
      .sort((first, second) => second.amount - first.amount || first.category.localeCompare(second.category)),
    [expenses],
  )
  const activeCategoryLabel = categoryFilter || 'All categories'

  // Category-based totals for different time periods
  const selectedCategoryThisMonthTotal = useMemo(
    () => {
      if (!categoryFilter) return 0
      return expenses.reduce((sum, expense) => {
        const expenseDate = parseExpenseDate(expense.date)
        const isThisMonth = expenseDate.getFullYear() === today.getFullYear()
          && expenseDate.getMonth() === today.getMonth()
        return expense.category === categoryFilter && isThisMonth
          ? sum + Number(expense.amount)
          : sum
      }, 0)
    },
    [expenses, categoryFilter, today],
  )

  const selectedCategoryLastWeekTotal = useMemo(
    () => {
      if (!categoryFilter) return 0
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - 6)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(today)
      weekEnd.setHours(23, 59, 59, 999)

      return expenses.reduce((sum, expense) => {
        const expenseDate = parseExpenseDate(expense.date)
        return expense.category === categoryFilter
          && expenseDate >= weekStart
          && expenseDate <= weekEnd
          ? sum + Number(expense.amount)
          : sum
      }, 0)
    },
    [expenses, categoryFilter, today],
  )

  const selectedCategoryAnnuallyTotal = useMemo(
    () => {
      if (!categoryFilter) return 0
      return expenses.reduce((sum, expense) => {
        const expenseDate = parseExpenseDate(expense.date)
        const isThisYear = expenseDate.getFullYear() === today.getFullYear()
        return expense.category === categoryFilter && isThisYear
          ? sum + Number(expense.amount)
          : sum
      }, 0)
    },
    [expenses, categoryFilter, today],
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
          <p className="eyebrow">Personal ledger</p>
          <h1>Expense Tracker</h1>
          <p className="header-copy">Track daily spend, spot patterns, and keep categories tidy.</p>
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

      <section className="summary-strip" aria-label="Expense summary">
        <div className="summary-item total-summary">
          <span>Total current view</span>
          <strong>{formatMoney(total)}</strong>
        </div>
        <div className="summary-item">
          <span>This month</span>
          <strong>{formatMoney(thisMonthTotal)}</strong>
        </div>
        <div className="summary-item">
          <span>Last 7 days</span>
          <strong>{formatMoney(lastWeekTotal)}</strong>
        </div>
        <div className="summary-item">
          <span>Category</span>
          <strong>{activeCategoryLabel}</strong>
        </div>
      </section>

      <section className="layout">
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <div className="panel-title">
            <p className="eyebrow">New entry</p>
            <h2>Add Expense</h2>
          </div>
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
              <p>{expenses.length} entries in view</p>
            </div>
            <div className="controls">
              <label className="control-field">
                Category
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category">
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className={activeSortType === 'date' ? 'control-field active-control' : 'control-field'}>
                Date
                <select
                  value={dateSort}
                  onChange={(event) => {
                    setDateSort(event.target.value)
                    setActiveSortType('date')
                  }}
                  aria-label="Sort by date"
                >
                  <option value="date_desc">Newest first</option>
                  <option value="date_asc">Oldest first</option>
                </select>
              </label>
              <label className={activeSortType === 'amount' ? 'control-field active-control' : 'control-field'}>
                Amount
                <select
                  value={amountSort}
                  onChange={(event) => {
                    setAmountSort(event.target.value)
                    setActiveSortType('amount')
                  }}
                  aria-label="Sort by amount"
                >
                  <option value="amount_desc">Highest to lowest</option>
                  <option value="amount_asc">Lowest to highest</option>
                </select>
              </label>
            </div>
          </div>

          {categoryFilter && (
            <div className="category-navigator" aria-label="Category time period navigation">
              <div className="navigator-item">
                <span>This Month</span>
                <strong>{formatMoney(selectedCategoryThisMonthTotal)}</strong>
              </div>
              <div className="navigator-item">
                <span>Last 7 Days</span>
                <strong>{formatMoney(selectedCategoryLastWeekTotal)}</strong>
              </div>
              <div className="navigator-item">
                <span>Annually</span>
                <strong>{formatMoney(selectedCategoryAnnuallyTotal)}</strong>
              </div>
            </div>
          )}

          <div className="category-summary" aria-label="Category-wise totals">
            <div className="category-summary-header">
              <h3>Category-wise total</h3>
              <span>{expenses.length} entries</span>
            </div>
            <div className="category-total-list">
              {categoryTotals.map((item) => (
                <div className="category-total-row" key={item.category}>
                  <span>{item.category}</span>
                  <strong>{formatMoney(item.amount)}</strong>
                </div>
              ))}
              {!loading && categoryTotals.length === 0 && (
                <div className="category-total-empty">No category totals yet.</div>
              )}
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
                    <td><span className="category-pill">{expense.category}</span></td>
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
