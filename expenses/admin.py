from django.contrib import admin

from .models import Budget, Category, Expense


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'color', 'icon', 'created_at']
    search_fields = ['name']


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ['title', 'amount', 'category', 'spent_on', 'payment_mode']
    list_filter = ['category', 'payment_mode', 'spent_on']
    search_fields = ['title', 'notes']


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ['month', 'category', 'amount']
    list_filter = ['month', 'category']
