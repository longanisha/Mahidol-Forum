# Mahidol Forum

A modern forum application for Mahidol University students and faculty.

## Tech Stack

- **Frontend**: React + Tailwind CSS
- **Backend**: Python (FastAPI)
- **Database**: Supabase
- **Deployment**: Vercel

## Project Structure

```
mahidol-forum/
├── frontend/          # React application
├── backend/           # Python FastAPI server
├── docs/             # Documentation
└── README.md
```

## Getting Started

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## Features

- User authentication (login/register)
- Discussion forums
- Tags and categories
- Announcements
- Responsive design

## Deployment

- Frontend: Deployed on Vercel
- Backend: Deployed on Vercel (Python runtime)
- Database: Supabase
