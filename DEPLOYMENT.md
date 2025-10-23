# Deployment Guide

This guide will help you deploy the Mahidol Forum application to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
3. **Git Repository**: Push your code to GitHub, GitLab, or Bitbucket

## Setup Instructions

### 1. Supabase Setup

1. Create a new project in Supabase
2. Go to Settings > API to get your project URL and anon key
3. Run the SQL migration in `backend/supabase/migrations/001_initial_schema.sql` in your Supabase SQL editor
4. Note down your:
   - Project URL
   - Anon key
   - Service role key (for admin operations)

### 2. Environment Variables

Set up the following environment variables in Vercel:

#### Backend Environment Variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `JWT_SECRET_KEY`: A random secret key for JWT tokens

#### Frontend Environment Variables:
- `REACT_APP_API_URL`: Your backend API URL (e.g., `https://your-backend.vercel.app`)

### 3. Deploy Backend

1. Connect your repository to Vercel
2. Set the root directory to `backend`
3. Configure build settings:
   - Build Command: `pip install -r requirements.txt`
   - Output Directory: Leave empty
4. Add environment variables
5. Deploy

### 4. Deploy Frontend

1. Create a new Vercel project for the frontend
2. Set the root directory to `frontend`
3. Configure build settings:
   - Build Command: `npm run build`
   - Output Directory: `build`
4. Add environment variables
5. Deploy

### 5. Update API URLs

After both deployments are complete:

1. Update the `REACT_APP_API_URL` in your frontend environment variables to point to your backend URL
2. Redeploy the frontend

## Alternative: Monorepo Deployment

You can also deploy both frontend and backend as a single Vercel project:

1. Use the root `vercel.json` configuration
2. Set up both frontend and backend in the same repository
3. Configure build commands for both

## Database Setup

1. Run the SQL migration in your Supabase SQL editor
2. Set up Row Level Security (RLS) policies if needed
3. Configure authentication settings in Supabase

## Post-Deployment

1. Test all API endpoints
2. Verify authentication flow
3. Check database connections
4. Test file uploads (if implemented)

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure CORS origins are correctly configured
2. **Database Connection**: Verify Supabase credentials
3. **Build Failures**: Check Python/Node.js versions
4. **Environment Variables**: Ensure all required variables are set

### Useful Commands:

```bash
# Test backend locally
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Test frontend locally
cd frontend
npm install
npm start

# Check Vercel logs
vercel logs
```

## Security Considerations

1. Never commit `.env` files
2. Use strong JWT secrets
3. Enable RLS in Supabase
4. Configure proper CORS settings
5. Use HTTPS in production

## Monitoring

1. Set up Vercel Analytics
2. Monitor Supabase usage
3. Set up error tracking (Sentry, etc.)
4. Monitor API performance
