# Modify.Style

Full-stack application with React + TypeScript frontend and Django REST Framework backend.

## Project Structure

```
modify.style/
├── frontend/          # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── services/  # API service layer
│   │   └── ...
│   └── ...
├── backend/           # Django REST Framework backend
│   ├── api/          # API application
│   ├── config/       # Django configuration
│   └── ...
└── README.md
```

## Quick Start

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Run setup script (recommended):
```bash
./setup.sh
```

Or manually:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python manage.py makemigrations
python manage.py migrate
```

3. Start Django server:
```bash
python manage.py runserver
```

Backend will run on `http://localhost:8000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

## Features

### Backend
- ✅ Django 5.0.6
- ✅ Django REST Framework
- ✅ CORS configured for frontend
- ✅ Environment variable configuration
- ✅ SQLite database (easily switchable to PostgreSQL)
- ✅ Professional project structure
- ✅ API endpoints with health check

### Frontend
- ✅ React 19
- ✅ TypeScript
- ✅ Vite for fast development
- ✅ API service layer
- ✅ Proxy configuration for backend
- ✅ Backend connection status indicator

## API Endpoints

- `GET /api/health/` - Health check endpoint
- `GET /api/info/` - API information
- `GET /api/examples/` - List all examples
- `POST /api/examples/` - Create new example
- `GET /api/examples/{id}/` - Get specific example
- `PUT /api/examples/{id}/` - Update example
- `DELETE /api/examples/{id}/` - Delete example

## Development

### Running Both Servers

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Making API Calls from Frontend

The frontend is configured to proxy API requests to the backend. Use the API service:

```typescript
import apiService from './services/api'

// Health check
const health = await apiService.healthCheck()

// Get API info
const info = await apiService.getApiInfo()

// Custom GET request
const data = await apiService.get('/examples/')

// POST request
const newItem = await apiService.post('/examples/', { name: 'Test', description: 'Description' })
```

## Environment Variables

### Backend (.env)
- `SECRET_KEY` - Django secret key
- `DEBUG` - Debug mode (True/False)
- `ALLOWED_HOSTS` - Comma-separated list of allowed hosts

### Frontend
- `VITE_API_URL` - API base URL (defaults to `/api` which uses proxy)

## Production Deployment

### Backend
1. Set `DEBUG=False` in `.env`
2. Generate new `SECRET_KEY`
3. Update `ALLOWED_HOSTS` with your domain
4. Configure PostgreSQL database
5. Set up static file serving
6. Configure proper CORS origins

### Frontend
1. Build for production: `npm run build`
2. Serve static files or deploy to hosting service
3. Update `VITE_API_URL` to point to production API

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Django 5.0.6, Django REST Framework
- **Database**: SQLite (development), PostgreSQL (production recommended)
- **API**: RESTful API with JSON responses

## License

MIT

