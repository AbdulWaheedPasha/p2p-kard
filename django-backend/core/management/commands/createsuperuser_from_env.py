import os

from django.contrib.auth import get_user_model
from django.core.management import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Create a superuser from env vars or command args."

    def add_arguments(self, parser):
        parser.add_argument("--email", type=str, help="Superuser email")
        parser.add_argument("--password", type=str, help="Superuser password")

    def handle(self, *args, **options):
        User = get_user_model()
        email = options.get("email") or os.getenv("DJANGO_SUPERUSER_EMAIL")
        password = options.get("password") or os.getenv("DJANGO_SUPERUSER_PASSWORD")

        if not email or not password:
            raise CommandError("Provide --email/--password or set DJANGO_SUPERUSER_EMAIL/PASSWORD.")

        if User.objects.filter(email=email).exists():
            self.stdout.write(self.style.WARNING("Superuser already exists."))
            return

        User.objects.create_superuser(email=email, password=password)
        self.stdout.write(self.style.SUCCESS("Superuser created."))
