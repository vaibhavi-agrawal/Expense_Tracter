from rest_framework import serializers

from .models import Budget, Category, Expense


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'color', 'icon', 'created_at']
        read_only_fields = ['id', 'created_at']


class ExpenseSerializer(serializers.ModelSerializer):
    category = serializers.CharField(source='category.name')
    description = serializers.CharField(source='notes')
    date = serializers.DateField(source='spent_on')

    class Meta:
        model = Expense
        fields = [
            'id',
            'amount',
            'category',
            'description',
            'date',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be greater than zero.')
        return value

    def create(self, validated_data):
        category_data = validated_data.pop('category')
        category_name = category_data['name'].strip()
        category, _ = Category.objects.get_or_create(
            name__iexact=category_name,
            defaults={'name': category_name},
        )
        notes = validated_data.get('notes', '').strip()
        idempotency_key = self.context.get('idempotency_key')

        return Expense.objects.create(
            **validated_data,
            category=category,
            title=notes[:120] or category.name,
            idempotency_key=idempotency_key,
        )

    def update(self, instance, validated_data):
        category_data = validated_data.pop('category', None)
        if category_data:
            category_name = category_data['name'].strip()
            instance.category, _ = Category.objects.get_or_create(
                name__iexact=category_name,
                defaults={'name': category_name},
            )

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if 'notes' in validated_data:
            instance.title = instance.notes[:120] or instance.category.name

        instance.save()
        return instance


class BudgetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = Budget
        fields = ['id', 'month', 'amount', 'category', 'category_name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'category_name', 'created_at', 'updated_at']
