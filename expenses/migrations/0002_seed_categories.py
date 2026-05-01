from django.db import migrations


def seed_categories(apps, schema_editor):
    Category = apps.get_model('expenses', 'Category')
    defaults = [
        ('Food', '#16a34a', 'utensils'),
        ('Travel', '#0ea5e9', 'train'),
        ('Bills', '#f59e0b', 'receipt'),
        ('Shopping', '#db2777', 'bag'),
        ('Health', '#dc2626', 'heart'),
        ('Education', '#7c3aed', 'book'),
    ]

    for name, color, icon in defaults:
        Category.objects.get_or_create(name=name, defaults={'color': color, 'icon': icon})


def remove_seed_categories(apps, schema_editor):
    Category = apps.get_model('expenses', 'Category')
    Category.objects.filter(name__in=['Food', 'Travel', 'Bills', 'Shopping', 'Health', 'Education']).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('expenses', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_categories, remove_seed_categories),
    ]
