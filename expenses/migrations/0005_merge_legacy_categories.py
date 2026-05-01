from django.db import migrations


def merge_legacy_categories(apps, schema_editor):
    Category = apps.get_model('expenses', 'Category')
    Expense = apps.get_model('expenses', 'Expense')
    mappings = {
        'Food': 'Food & Dining',
        'Bills': 'Bills & Payments',
        'Health': 'Health & Fitness',
    }

    for old_name, new_name in mappings.items():
        old_category = Category.objects.filter(name=old_name).first()
        new_category = Category.objects.filter(name=new_name).first()
        if not old_category or not new_category:
            continue

        Expense.objects.filter(category=old_category).update(category=new_category)
        old_category.delete()


class Migration(migrations.Migration):
    dependencies = [
        ('expenses', '0004_seed_expanded_categories'),
    ]

    operations = [
        migrations.RunPython(merge_legacy_categories, migrations.RunPython.noop),
    ]
