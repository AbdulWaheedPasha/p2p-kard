from django.core.management import BaseCommand, call_command


class Command(BaseCommand):
    help = "Run database migrations."

    def handle(self, *args, **options):
        call_command("migrate")
