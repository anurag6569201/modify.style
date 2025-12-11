# Quick Start Guide

Get your full-stack application running in minutes!

## Prerequisites

- Python 3.8+ installed
- Node.js 16+ and npm installed

## Step 1: Backend Setup (5 minutes)

```bash
cd backend
./setup.sh
```

Or manually:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py makemigrations
python manage.py migrate
python manage.py runserver
```

✅ Backend should now be running on `http://localhost:8000`

## Step 2: Frontend Setup (2 minutes)

Open a **new terminal**:

```bash
cd frontend
npm install
npm run dev
```

✅ Frontend should now be running on `http://localhost:5173`

## Step 3: Verify Connection

1. Open `http://localhost:5173` in your browser
2. You should see "Django backend is running successfully!" in the Backend Status section
3. If you see an error, make sure the Django server is running in the other terminal

## Testing the API

### Using Browser
- Visit `http://localhost:8000/api/health/` - Should show health status
- Visit `http://localhost:8000/api/info/` - Should show API information

### Using Frontend
The frontend automatically checks the backend connection on page load. Check the browser console for any errors.

## Next Steps

1. **Create a superuser** (optional, for admin panel):
   ```bash
   cd backend
   source venv/bin/activate
   python manage.py createsuperuser
   ```
   Then visit `http://localhost:8000/admin/`

2. **Start building your features**:
   - Add models in `backend/api/models.py`
   - Create serializers in `backend/api/serializers.py`
   - Add views in `backend/api/views.py`
   - Use `apiService` in frontend components

## Troubleshooting

### Backend won't start
- Make sure virtual environment is activated
- Check if port 8000 is already in use
- Verify all dependencies are installed: `pip install -r requirements.txt`

### Frontend can't connect to backend
- Ensure Django server is running on port 8000
- Check browser console for CORS errors
- Verify Vite proxy configuration in `vite.config.ts`

### Port conflicts
- Backend: Change port with `python manage.py runserver 8001`
- Frontend: Change port in `vite.config.ts` (and update CORS settings in Django)

## Project Structure Overview

```
modify.style/
├── backend/
│   ├── api/              # Your API app
│   ├── config/           # Django settings
│   ├── manage.py         # Django CLI
│   └── requirements.txt  # Python dependencies
└── frontend/
    ├── src/
    │   ├── services/     # API service layer
    │   └── App.tsx       # Main React component
    └── vite.config.ts    # Vite configuration
```

Happy coding! 🚀

