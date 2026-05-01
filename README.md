# Expense_Tracter

A minimal full-stack expense tracker built for the assignment user story: record expenses, review them, filter by category, sort by newest date, and see the total for the current list.

## Tech Stack

- Backend: Django 4.2 + Django REST Framework
- Database: SQLite
- Frontend: React + Vite
- Styling: Plain CSS

## Running Locally

Backend:

```bash
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver 127.0.0.1:8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`.

The React app reads `VITE_API_BASE_URL`; if it is not set, it uses `http://127.0.0.1:8000`.

## API

Create an expense:

```http
POST /expenses
Idempotency-Key: <client-generated-uuid>
Content-Type: application/json

{
  "amount": "125.50",
  "category": "Food",
  "description": "Lunch",
  "date": "2026-05-01"
}
```

List expenses:

```http
GET /expenses
GET /expenses?category=Food
GET /expenses?category=Food&sort=date_desc
```

Response fields:

```json
{
  "id": 1,
  "amount": "125.50",
  "category": "Food",
  "description": "Lunch",
  "date": "2026-05-01",
  "created_at": "2026-05-01T08:00:00Z"
}
```

## Design Decisions

- SQLite is used because it is simple, durable across browser refreshes/server restarts, and enough for a small single-user assignment app. The Django model can be moved to PostgreSQL later without changing the API shape.
- Money is stored with `DecimalField(max_digits=12, decimal_places=2)` instead of float to avoid rounding errors.
- Create requests support an `Idempotency-Key` header. If the browser retries the same request with the same key, the API returns the original expense instead of creating a duplicate.
- The frontend disables the submit button while saving and stores a pending submit in `localStorage`. If the page refreshes mid-submit, it retries with the same idempotency key.
- Categories are stored as rows internally, but the assignment API accepts and returns category names as strings for a simpler client contract.

## Trade-offs

- Authentication is intentionally omitted to keep the exercise focused on data correctness and the required expense workflow.
- The UI is intentionally small: add form, table, category filter, newest-first sort, loading/error states, and current-list total.
- The app keeps a couple of earlier nice-to-have backend endpoints (`/api/categories`, budgets, summary), but the assignment path is `/expenses`.
- Idempotency is key-based. A client that does not send `Idempotency-Key` can still create duplicate identical expenses, which is often the correct behavior because real users may enter the same amount/category/date more than once.

## Deployment

The repository includes a `render.yaml` blueprint for deploying the Django API and PostgreSQL database on Render.

Backend environment variables:

```bash
DEBUG=False
SECRET_KEY=<generated-secret>
ALLOWED_HOSTS=.onrender.com,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=<deployed-frontend-url>
CSRF_TRUSTED_ORIGINS=<deployed-frontend-url>
DATABASE_URL=<postgres-connection-url>
```

Frontend deployment:

- Deploy the `frontend` folder to Vercel 
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_API_BASE_URL` to the deployed backend URL, for example `https://expense-tracter-api.onrender.com`.

## Tests

```bash
.venv/bin/python manage.py test
cd frontend && npm run lint && npm run build
```
