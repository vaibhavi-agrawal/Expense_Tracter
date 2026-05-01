from datetime import date

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.db.models.functions import TruncMonth
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Budget, Category, Expense
from .serializers import BudgetSerializer, CategorySerializer, ExpenseSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer

    def get_queryset(self):
        queryset = Expense.objects.select_related('category')

        category = self.request.query_params.get('category')
        sort = self.request.query_params.get('sort')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if category:
            if category.isdigit():
                queryset = queryset.filter(category_id=category)
            else:
                queryset = queryset.filter(category__name__iexact=category)
        if start_date:
            queryset = queryset.filter(spent_on__gte=start_date)
        if end_date:
            queryset = queryset.filter(spent_on__lte=end_date)
        if sort == 'date_desc':
            queryset = queryset.order_by('-spent_on', '-created_at')
        elif sort == 'date_asc':
            queryset = queryset.order_by('spent_on', 'created_at')

        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['idempotency_key'] = self.request.headers.get('Idempotency-Key')
        return context

    def create(self, request, *args, **kwargs):
        idempotency_key = request.headers.get('Idempotency-Key')
        if idempotency_key:
            existing = Expense.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                serializer = self.get_serializer(existing)
                return Response(serializer.data)
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError:
            if idempotency_key:
                existing = Expense.objects.filter(idempotency_key=idempotency_key).first()
                if existing:
                    serializer = self.get_serializer(existing)
                    return Response(serializer.data)
            raise

    @action(detail=False, methods=['get'])
    def summary(self, request):
        today = date.today()
        month_start = today.replace(day=1)

        total_spent = Expense.objects.aggregate(total=Sum('amount'))['total'] or 0
        monthly_spent = Expense.objects.filter(spent_on__gte=month_start).aggregate(total=Sum('amount'))['total'] or 0

        by_category = (
            Expense.objects.values('category__id', 'category__name', 'category__color')
            .annotate(total=Sum('amount'))
            .order_by('-total')
        )
        by_month = (
            Expense.objects.annotate(month=TruncMonth('spent_on'))
            .values('month')
            .annotate(total=Sum('amount'))
            .order_by('month')
        )
        recent = ExpenseSerializer(self.get_queryset()[:5], many=True).data

        return Response(
            {
                'total_spent': total_spent,
                'monthly_spent': monthly_spent,
                'by_category': list(by_category),
                'by_month': list(by_month),
                'recent_expenses': recent,
            }
        )


class BudgetViewSet(viewsets.ModelViewSet):
    queryset = Budget.objects.select_related('category')
    serializer_class = BudgetSerializer
