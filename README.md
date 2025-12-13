# Modify.Style

A full-stack web application for real-time website style modification and prototyping. Built with React + TypeScript frontend and Django REST Framework backend.

## Features

- **Live Website Rendering**: Load and display any website in an iframe with full JavaScript support
- **Real-time CSS Editing**: Modify website styles in real-time with a live CSS editor
- **Element Inspector**: Inspect and select elements on the rendered website
- **Brand Extraction**: Automatically extract color palettes and fonts from websites
- **Device Preview**: Preview websites in different device sizes (mobile, tablet, desktop)
- **Zoom & Pan Controls**: Navigate large websites with zoom and pan functionality
- **Effects Panel**: Apply predefined visual effects to websites
- **Design Tools**: Advanced design panel for typography and color management

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Django 5.0.6, Django REST Framework
- **Browser Automation**: Playwright
- **Database**: SQLite (development), PostgreSQL (production recommended)

## Project Structure

```
modify.style/
├── backend/              # Django backend
│   ├── api/             # API application
│   │   ├── services/    # Business logic layer
│   │   ├── models.py    # Database models
│   │   ├── views.py     # API views
│   │   └── serializers.py
│   ├── config/          # Django configuration
│   │   ├── settings.py  # Application settings
│   │   └── urls.py      # URL routing
│   └── requirements.txt
├── frontend/            # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── context/     # React context providers
│   │   ├── services/    # API service layer
│   │   ├── types/       # TypeScript type definitions
│   │   └── utils/       # Utility functions
│   └── package.json
└── README.md
```

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+ and npm

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
cp .env.example .env  # If .env.example exists
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

## API Endpoints

- `GET /api/health/` - Health check endpoint
- `GET /api/info/` - API information
- `GET /api/proxy/?url=<website_url>` - Proxy and render a website
- `GET /api/proxy-resource/?url=<resource_url>` - Proxy a single resource (CSS, JS, images)
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

// Proxy website
const result = await apiService.proxyWebsite('https://example.com')
```

## Environment Variables

### Backend (.env)

Create a `.env` file in the `backend/` directory:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```

### Frontend

Create a `.env` file in the `frontend/` directory (optional):

```env
VITE_API_URL=/api
```

## Production Deployment

### Backend

1. Set `DEBUG=False` in `.env`
2. Generate a new `SECRET_KEY`
3. Update `ALLOWED_HOSTS` with your domain
4. Configure PostgreSQL database
5. Set up static file serving
6. Configure proper CORS origins

### Frontend

1. Build for production: `npm run build`
2. Serve static files or deploy to hosting service
3. Update `VITE_API_URL` to point to production API

## Troubleshooting

### Backend won't start
- Ensure virtual environment is activated
- Check if port 8000 is already in use
- Verify all dependencies are installed: `pip install -r requirements.txt`

### Frontend can't connect to backend
- Ensure Django server is running on port 8000
- Check browser console for CORS errors
- Verify Vite proxy configuration in `vite.config.ts`

### Port conflicts
- Backend: Change port with `python manage.py runserver 8001`
- Frontend: Change port in `vite.config.ts` (and update CORS settings in Django)

## License

MIT
