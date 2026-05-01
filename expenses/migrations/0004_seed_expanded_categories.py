from django.db import migrations


def seed_expanded_categories(apps, schema_editor):
    Category = apps.get_model('expenses', 'Category')
    defaults = [
        ('Living', '#14b8a6', 'home'),
        ('Food & Dining', '#16a34a', 'utensils'),
        ('Transportation', '#0ea5e9', 'car'),
        ('Education', '#7c3aed', 'book'),
        ('Shopping', '#db2777', 'bag'),
        ('Health & Fitness', '#dc2626', 'heart'),
        ('Entertainment', '#f97316', 'film'),
        ('Travel', '#0284c7', 'plane'),
        ('Work & Productivity', '#4f46e5', 'briefcase'),
        ('Bills & Payments', '#f59e0b', 'receipt'),
        ('Personal', '#64748b', 'user'),
        ('Miscellaneous', '#475569', 'more-horizontal'),
    ]

    for name, color, icon in defaults:
        Category.objects.get_or_create(name=name, defaults={'color': color, 'icon': icon})


def remove_expanded_categories(apps, schema_editor):
    Category = apps.get_model('expenses', 'Category')
    Category.objects.filter(
        name__in=[
            'Living',
            'Food & Dining',
            'Transportation',
            'Health & Fitness',
            'Entertainment',
            'Work & Productivity',
            'Bills & Payments',
            'Personal',
            'Miscellaneous',
        ]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('expenses', '0003_expense_idempotency_key'),
    ]

    operations = [
        migrations.RunPython(seed_expanded_categories, remove_expanded_categories),
    ]
