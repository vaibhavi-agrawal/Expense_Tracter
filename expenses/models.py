from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Category(models.Model):
    name = models.CharField(max_length=80, unique=True)
    color = models.CharField(max_length=7, default='#2563eb')
    icon = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


class Expense(models.Model):
    PAYMENT_CASH = 'cash'
    PAYMENT_CARD = 'card'
    PAYMENT_UPI = 'upi'
    PAYMENT_BANK = 'bank'
    PAYMENT_OTHER = 'other'

    PAYMENT_MODES = [
        (PAYMENT_CASH, 'Cash'),
        (PAYMENT_CARD, 'Card'),
        (PAYMENT_UPI, 'UPI'),
        (PAYMENT_BANK, 'Bank transfer'),
        (PAYMENT_OTHER, 'Other'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='expenses',
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='expenses')
    spent_on = models.DateField(default=timezone.localdate)
    payment_mode = models.CharField(max_length=20, choices=PAYMENT_MODES, default=PAYMENT_UPI)
    notes = models.TextField(blank=True)
    idempotency_key = models.CharField(max_length=80, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-spent_on', '-created_at']

    def __str__(self):
        return f'{self.title} - {self.amount}'


class Budget(models.Model):
    month = models.DateField(help_text='Use the first day of the month for this budget.')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name='budgets',
        null=True,
        blank=True,
        help_text='Leave empty for an overall monthly budget.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-month', 'category__name']
        constraints = [
            models.UniqueConstraint(fields=['month', 'category'], name='unique_budget_per_month_category'),
            models.UniqueConstraint(
                fields=['month'],
                condition=Q(category__isnull=True),
                name='unique_overall_budget_per_month',
            ),
        ]

    def __str__(self):
        label = self.category.name if self.category else 'Overall'
        return f'{label} budget for {self.month:%B %Y}'
