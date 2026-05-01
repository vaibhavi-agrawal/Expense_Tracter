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
