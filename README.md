# Mahidol Forum

A comprehensive community forum platform built for Mahidol University, featuring user authentication, discussion threads, points system, LINE group management, and administrative tools.

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Project Architecture](#project-architecture)

## Overview

Mahidol Forum is a full-stack community platform that enables students and faculty to:
- Create and participate in discussion threads
- Manage LINE group applications
- Earn and track points through community engagement
- Access administrative dashboards for content moderation
- View community statistics and analytics

## Technology Stack

### Frontend
- **React 19.1.1** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **TanStack Query (React Query)** - Data fetching and caching
- **Recharts** - Chart library for data visualization
- **TipTap** - Rich text editor
- **Supabase JS** - Authentication and database client

### Backend
- **FastAPI** - Modern Python web framework
- **Python 3.11+** - Programming language
- **Uvicorn** - ASGI server
- **Supabase** - Backend-as-a-Service (Database, Auth, Storage)
- **Pydantic** - Data validation
- **bcrypt** - Password hashing

## Project Structure

```
mahidoforum/
├── backend/                    # FastAPI backend application
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI app initialization
│   │   ├── config.py           # Configuration management
│   │   ├── auth.py             # Authentication & authorization
│   │   ├── dependencies.py     # Dependency injection
│   │   ├── schemas.py          # Pydantic models
│   │   ├── routers/            # API route handlers
│   │   │   ├── admin.py        # Admin endpoints
│   │   │   ├── admin_auth.py   # Admin authentication
│   │   │   ├── announcements.py # Announcement management
│   │   │   ├── line_groups.py   # LINE group management
│   │   │   ├── points.py       # Points system
│   │   │   ├── stats.py        # Statistics endpoints
│   │   │   ├── threads.py      # Thread/post management
│   │   │   ├── votes_reports.py # Voting & reporting
│   │   │   └── superadmin.py   # Super admin endpoints
│   │   └── utils/
│   │       └── points.py       # Points calculation utilities
│   ├── migrations/             # Database migration scripts
│   ├── requirements.txt        # Python dependencies
│   ├── create_admin.py        # Admin user creation script
│   └── README.md
│
├── frontend/                   # React frontend application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── admin/          # Admin panel components
│   │   │   ├── editor/         # Rich text editor
│   │   │   ├── forum/          # Forum-specific components
│   │   │   ├── layout/         # Layout components (Header, Footer)
│   │   │   └── superadmin/      # Super admin components
│   │   ├── pages/              # Page components
│   │   │   ├── HomePage.tsx    # Main forum page
│   │   │   ├── ThreadPage.tsx  # Thread detail page
│   │   │   ├── ProfilePage.tsx # User profile page
│   │   │   ├── AdminPage.tsx   # Admin dashboard
│   │   │   └── ...
│   │   ├── context/
│   │   │   └── AuthContext.tsx  # Authentication context
│   │   ├── lib/
│   │   │   ├── api.ts          # API client utilities
│   │   │   └── supabase.ts     # Supabase client config
│   │   ├── App.tsx             # Main app component
│   │   └── main.tsx            # Application entry point
│   ├── public/                 # Static assets
│   ├── package.json            # Node.js dependencies
│   └── README.md
│
├── POINTS_SYSTEM.md              # Points system documentation
└── README.md                  # This file
```

## Features

### User Features
- **User Authentication**: Email/password registration and login via Supabase Auth
- **Profile Management**: Customizable username, avatar upload, and profile viewing
- **Thread Creation**: Create discussion threads with rich text editor
- **Post Replies**: Reply to threads with nested reply support
- **Voting System**: Upvote/downvote posts and replies
- **Points System**: Earn points through various activities (see [POINTS_SYSTEM.md](./POINTS_SYSTEM.md))
- **User Levels**: Automatic level calculation based on total points (1-10 levels)
- **Points History**: Track all point transactions
- **Post Pinning**: Pin posts to top (consumes points, 7-day validity)
- **LINE Group Applications**: Apply to join LINE groups
- **Announcements**: View campus announcements and updates
- **Search & Filter**: Search threads by keywords and filter by tags
- **Sorting Options**: Sort threads by latest, most views, or most replies

### Admin Features
- **Admin Dashboard**: Comprehensive overview with statistics
- **User Management**: View, create, edit, and manage users
- **Content Moderation**: Review and manage posts, replies, and reports
- **Announcement Management**: Create, edit, and manage announcements
- **LINE Group Management**: Approve/reject LINE group creation requests
- **Group Application Review**: Review and process LINE group applications
- **Report Management**: Handle user reports on content
- **Analytics**: Weekly statistics charts for new users and new posts
- **Points Ranking**: View top users by points (excluding admins)

### Super Admin Features
- **User Role Management**: Assign roles (admin, moderator, superadmin)
- **System Statistics**: Advanced system-wide statistics

## Prerequisites

Before running the application, ensure you have:

- **Node.js** 18+ and npm
- **Python** 3.11 or higher
- **Supabase Account** with a project set up
- **Git** (for cloning the repository)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd mahidoforum
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

## Configuration

### Backend Configuration

Create a `.env` file in the `backend/` directory:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
CORS_ALLOW_ORIGINS=http://localhost:5173
```

**Important**: 
- Use the **service role key** (not the anon key) for the backend
- Never expose the service role key in the frontend
- The service role key has full database access

### Frontend Configuration

Create a `.env` file in the `frontend/` directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Note**: The frontend uses the anon key, which has restricted permissions based on Row Level Security (RLS) policies.

## Running the Application

### Start Backend Server

```bash
cd backend
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

The backend API will be available at `http://localhost:8000`

### Start Frontend Server

```bash
cd frontend
npm run dev
```

The frontend application will be available at `http://localhost:5173`

### Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs (Swagger UI)
- **Alternative API Docs**: http://localhost:8000/redoc

## API Documentation

### Authentication

The API uses JWT tokens from Supabase Auth. Include the token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Main Endpoints

#### Threads & Posts
- `GET /posts/` - List all posts (with pagination, sorting, filtering)
- `GET /posts/{post_id}` - Get post details
- `POST /posts/` - Create a new post (requires auth)
- `GET /posts/my-posts` - Get current user's posts (requires auth)
- `GET /posts/my-posts/replies` - Get current user's replies (requires auth)
- `POST /posts/{post_id}/pin` - Pin a post (requires auth, consumes points)

#### Points & Profile
- `GET /points/profile` - Get user profile with points
- `PATCH /points/profile` - Update user profile
- `GET /points/history` - Get points history (requires auth)
- `GET /points/ranking` - Get user ranking (requires auth)

#### LINE Groups
- `GET /line-groups` - List LINE groups
- `POST /line-groups/creation-requests` - Request to create a LINE group
- `GET /line-groups/creation-requests` - List creation requests (admin)
- `POST /line-groups/creation-requests/{id}/review` - Review request (admin)

#### Announcements
- `GET /announcements` - List active announcements
- `GET /announcements/{id}` - Get announcement details

#### Statistics
- `GET /stats/community` - Get community statistics (public)
- `GET /stats/top-users` - Get top users by points (public)

#### Admin Endpoints
- `GET /admin/stats` - Get admin statistics
- `GET /admin/stats/weekly` - Get weekly statistics (new users, new posts)
- `GET /admin/users` - List users (admin only)
- `POST /admin-auth/login` - Admin login
- `POST /admin-auth/register` - Admin registration

For complete API documentation, visit `http://localhost:8000/docs` when the backend is running.

## Project Architecture

### Authentication Flow

1. User registers/logs in via Supabase Auth (frontend)
2. Supabase returns JWT access token
3. Frontend stores token in sessionStorage (expires on tab close)
4. Frontend includes token in API requests: `Authorization: Bearer <token>`
5. Backend validates token using Supabase service role key
6. Backend extracts user information and injects into route handlers

### Database Schema

The application uses Supabase (PostgreSQL) with the following main tables:

- **profiles** - User profiles (username, avatar_url, total_points, level)
- **posts** - Forum posts/threads
- **post_replies** - Replies to posts
- **point_records** - Points transaction history
- **line_groups** - LINE group information
- **line_group_applications** - User applications to join groups
- **line_group_creation_requests** - Requests to create new groups
- **announcements** - System announcements
- **admins** - Admin user accounts
- **votes** - Post/reply votes
- **reports** - Content reports

### Points System

The points system rewards user engagement:
- **Earning Points**: Daily login (+1), posting (+10), replying (+5), receiving votes (+2/+1)
- **Spending Points**: Pinning posts (-50), creating private groups (-30)
- **Level Calculation**: `level = min(10, 1 + (total_points // 100))`

See [POINTS_SYSTEM.md](./POINTS_SYSTEM.md) for detailed documentation.

### Session Management

- Tokens are stored in `sessionStorage` (not `localStorage`)
- Sessions persist across page refreshes
- Sessions expire when the browser tab is closed
- Sign out clears the session

## Development

### Backend Development

- The backend uses FastAPI with automatic reload on file changes
- Logs are printed to console
- API errors are handled globally with proper CORS headers

### Frontend Development

- Vite provides hot module replacement (HMR)
- React Query handles data fetching and caching
- TypeScript ensures type safety

### Creating Admin Users

```bash
cd backend
source .venv/bin/activate
python create_admin.py
```

Follow the prompts to create an admin account.

## Troubleshooting

### Backend Issues

- **401 Unauthorized**: Check that the JWT token is valid and not expired
- **500 Internal Server Error**: Check backend logs for detailed error messages
- **Connection Timeout**: Ensure Supabase credentials are correct and the service is accessible

### Frontend Issues

- **504 Outdated Optimize Dep**: Clear Vite cache: `rm -rf node_modules/.vite`
- **401 on API calls**: Ensure user is logged in and token is valid
- **CORS errors**: Verify `CORS_ALLOW_ORIGINS` in backend `.env` includes frontend URL

### Common Solutions

1. **Clear caches**: 
   - Frontend: `rm -rf node_modules/.vite`
   - Backend: Restart the server

2. **Check environment variables**: Ensure all required variables are set in `.env` files

3. **Database migrations**: Run any pending migrations if schema changes were made

## License

[Add your license information here]

## Support

For issues and questions, please contact the development team or create an issue in the repository.

