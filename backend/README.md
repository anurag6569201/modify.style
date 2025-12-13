# Backend API

Django REST Framework backend for Modify.Style application.

## Quick Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Start server
python manage.py runserver
```

## Project Structure

```
backend/
├── api/                 # API application
│   ├── services/       # Business logic layer
│   ├── models.py       # Database models
│   ├── views.py        # API views
│   ├── serializers.py  # DRF serializers
│   └── urls.py         # API URL routing
├── config/             # Django project settings
│   ├── settings.py     # Application settings
│   └── urls.py         # Root URL configuration
└── requirements.txt    # Python dependencies
```

## API Endpoints

- `GET /api/health/` - Health check
- `GET /api/info/` - API information
- `GET /api/proxy/?url=<url>` - Proxy and render website
- `GET /api/proxy-resource/?url=<url>` - Proxy single resource
- `GET /api/examples/` - List examples (CRUD endpoints available)

For detailed documentation, see the main [README.md](../README.md).
