from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Expense


class ExpenseApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_create_expense(self):
        response = self.client.post(
            '/expenses',
            {
                'amount': '125.50',
                'category': 'Food',
                'description': 'Lunch',
                'date': '2026-05-01',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Expense.objects.count(), 1)
        expense = Expense.objects.get()
        self.assertEqual(expense.amount, Decimal('125.50'))
        self.assertEqual(expense.category.name, 'Food')

    def test_create_expense_is_idempotent_with_key(self):
        payload = {
            'amount': '500.00',
            'category': 'Travel',
            'description': 'Train ticket',
            'date': '2026-05-01',
        }

        first = self.client.post('/expenses', payload, format='json', HTTP_IDEMPOTENCY_KEY='retry-123')
        second = self.client.post('/expenses', payload, format='json', HTTP_IDEMPOTENCY_KEY='retry-123')

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data['id'], second.data['id'])
        self.assertEqual(Expense.objects.count(), 1)

    def test_create_expense_does_not_duplicate_same_expense_with_new_key(self):
        payload = {
            'amount': '56.00',
            'category': 'Coffee',
            'description': '-',
            'date': '2026-05-01',
        }

        first = self.client.post('/expenses', payload, format='json', HTTP_IDEMPOTENCY_KEY='first-key')
        second = self.client.post('/expenses', payload, format='json', HTTP_IDEMPOTENCY_KEY='second-key')

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(first.data['id'], second.data['id'])
        self.assertEqual(Expense.objects.count(), 1)

    def test_filter_by_category_and_sort_by_date_desc(self):
        rows = [
            ('Food', '2026-05-01', 'Coffee'),
            ('Food', '2026-05-03', 'Dinner'),
            ('Travel', '2026-05-02', 'Metro'),
        ]
        for category, expense_date, description in rows:
            self.client.post(
                '/expenses',
                {
                    'amount': '10.00',
                    'category': category,
                    'description': description,
                    'date': expense_date,
                },
                format='json',
            )

        response = self.client.get('/expenses?category=Food&sort=date_desc')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['description'] for item in response.data], ['Dinner', 'Coffee'])

    def test_sort_by_date_asc(self):
        rows = [
            ('Food', '2026-05-03', 'Dinner'),
            ('Travel', '2026-05-01', 'Metro'),
            ('Education', '2026-05-02', 'Book'),
        ]
        for category, expense_date, description in rows:
            self.client.post(
                '/expenses',
                {
                    'amount': '10.00',
                    'category': category,
                    'description': description,
                    'date': expense_date,
                },
                format='json',
            )

        response = self.client.get('/expenses?sort=date_asc')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['description'] for item in response.data], ['Metro', 'Book', 'Dinner'])

    def test_sort_by_amount_desc(self):
        rows = [
            ('Food', '25.00', 'Snacks'),
            ('Travel', '200.00', 'Cab'),
            ('Education', '80.00', 'Book'),
        ]
        for category, amount, description in rows:
            self.client.post(
                '/expenses',
                {
                    'amount': amount,
                    'category': category,
                    'description': description,
                    'date': '2026-05-01',
                },
                format='json',
            )

        response = self.client.get('/expenses?sort=amount_desc')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['description'] for item in response.data], ['Cab', 'Book', 'Snacks'])

    def test_sort_by_amount_asc(self):
        rows = [
            ('Food', '25.00', 'Snacks'),
            ('Travel', '200.00', 'Cab'),
            ('Education', '80.00', 'Book'),
        ]
        for category, amount, description in rows:
            self.client.post(
                '/expenses',
                {
                    'amount': amount,
                    'category': category,
                    'description': description,
                    'date': '2026-05-01',
                },
                format='json',
            )

        response = self.client.get('/expenses?sort=amount_asc')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['description'] for item in response.data], ['Snacks', 'Book', 'Cab'])

    def test_rejects_negative_amount(self):
        response = self.client.post(
            '/expenses',
            {
                'amount': '-1.00',
                'category': 'Food',
                'description': 'Invalid',
                'date': '2026-05-01',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Expense.objects.count(), 0)
