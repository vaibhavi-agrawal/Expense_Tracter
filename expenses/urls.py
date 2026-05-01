from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BudgetViewSet, CategoryViewSet, ExpenseViewSet

router = DefaultRouter()
router.register('categories', CategoryViewSet, basename='category')
router.register('expenses', ExpenseViewSet, basename='expense')
router.register('budgets', BudgetViewSet, basename='budget')

expense_list = ExpenseViewSet.as_view({'get': 'list', 'post': 'create'})

urlpatterns = [
    path('expenses', expense_list, name='expense-list-no-slash'),
    path('', include(router.urls)),
]
