from django.db import migrations


def remove_duplicate_expenses(apps, schema_editor):
    Expense = apps.get_model('expenses', 'Expense')
    seen = set()

    for expense in Expense.objects.order_by('amount', 'category_id', 'notes', 'spent_on', 'created_at', 'id'):
        key = (expense.amount, expense.category_id, expense.notes, expense.spent_on)
        if key in seen:
            expense.delete()
            continue

        seen.add(key)


class Migration(migrations.Migration):
    dependencies = [
        ('expenses', '0005_merge_legacy_categories'),
    ]

    operations = [
        migrations.RunPython(remove_duplicate_expenses, migrations.RunPython.noop),
    ]
