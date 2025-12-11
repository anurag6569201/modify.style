# Modify.Style Backend

Django REST Framework backend for the Modify.Style application.

## Features

- Django 5.0.6
- Django REST Framework for API endpoints
- CORS configured for frontend integration
- SQLite database (can be switched to PostgreSQL)
- Environment variable configuration
- Professional project structure

## Setup Instructions

### 1. Create Virtual Environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` file with your settings (optional for development, defaults are provided).

### 4. Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### 5. Create Superuser (Optional)

```bash
python manage.py createsuperuser
```

### 6. Run Development Server

```bash
python manage.py runserver
```

The backend will be available at `http://localhost:8000`

## API Endpoints

- **Health Check**: `GET /api/health/`
- **API Info**: `GET /api/info/`
- **Examples**: 
  - `GET /api/examples/` - List all examples
  - `POST /api/examples/` - Create new example
  - `GET /api/examples/{id}/` - Get specific example
  - `PUT /api/examples/{id}/` - Update example
  - `DELETE /api/examples/{id}/` - Delete example

## Admin Panel

Access the Django admin panel at `http://localhost:8000/admin/` (requires superuser account).

## Project Structure

```
backend/
├── api/                 # API application
│   ├── models.py       # Database models
│   ├── views.py        # API views
│   ├── serializers.py  # DRF serializers
│   ├── urls.py         # API URL routing
│   └── admin.py        # Admin configuration
├── config/             # Django project settings
│   ├── settings.py     # Main settings file
│   ├── urls.py         # Root URL configuration
│   ├── wsgi.py         # WSGI configuration
│   └── asgi.py         # ASGI configuration
├── manage.py           # Django management script
├── requirements.txt    # Python dependencies
└── README.md          # This file
```

## Frontend Integration

The backend is configured to accept requests from the frontend running on:
- `http://localhost:5173` (Vite default)
- `http://localhost:3000` (Alternative React dev server)

CORS is properly configured to allow cross-origin requests from these origins.

## Database

By default, the project uses SQLite. To switch to PostgreSQL:

1. Install PostgreSQL
2. Update `DATABASES` in `config/settings.py`
3. Update `DATABASE_URL` in `.env` file

## Production Deployment

Before deploying to production:

1. Set `DEBUG=False` in `.env`
2. Generate a new `SECRET_KEY`
3. Update `ALLOWED_HOSTS` with your domain
4. Configure proper database (PostgreSQL recommended)
5. Set up static file serving
6. Configure proper CORS origins
7. Use environment variables for sensitive data

## Development Tips

- Use Django admin panel for quick data management
- API endpoints support JSON format
- Check `/api/info/` for available endpoints
- Use `/api/health/` to verify backend is running

