from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import ValidationError

from .config import get_settings
from .routers import admin, admin_auth, announcements, line, line_groups, points, stats, superadmin, threads, votes_reports


def create_app() -> FastAPI:
  settings = get_settings()

  app = FastAPI(
    title='Mahidol Forum API',
    version='1.0.0',
    description='Backend services for Mahidol Forum community platform.',
  )

  # Add CORS middleware first (before exception handlers)
  app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有 HTTP 方法
    allow_headers=["*"],  # 允许所有 HTTP 头
  )

  # Global exception handler to ensure CORS headers are always included
  @app.exception_handler(StarletteHTTPException)
  async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
      status_code=exc.status_code,
      content={"detail": exc.detail},
      headers={
        "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
        "Access-Control-Allow-Credentials": "true",
      }
    )

  # Validation error handler with detailed error messages
  @app.exception_handler(RequestValidationError)
  async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
      field = " -> ".join(str(loc) for loc in error["loc"])
      error_msg = error["msg"]
      error_type = error["type"]
      errors.append({
        "field": field,
        "message": error_msg,
        "type": error_type,
      })
    
    print(f"[VALIDATION_ERROR] Request validation failed:")
    for err in errors:
      print(f"  - {err['field']}: {err['message']} ({err['type']})")
    
    return JSONResponse(
      status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
      content={
        "detail": errors,
        "message": "Validation error. Please check your input data.",
      },
      headers={
        "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
        "Access-Control-Allow-Credentials": "true",
      }
    )

  # 处理 Supabase Auth 错误（在全局异常处理器之前）
  try:
    from supabase_auth.errors import AuthApiError, AuthError
  except ImportError:
    AuthApiError = Exception
    AuthError = Exception
  
  @app.exception_handler(AuthApiError)
  async def auth_api_error_handler(request: Request, exc: AuthApiError):
    error_msg = str(exc)
    print(f"AuthApiError caught in global handler: {error_msg}")
    return JSONResponse(
      status_code=status.HTTP_401_UNAUTHORIZED,
      content={"detail": "Invalid or expired token"},
      headers={
        "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
        "Access-Control-Allow-Credentials": "true",
      }
    )
  
  @app.exception_handler(AuthError)
  async def auth_error_handler(request: Request, exc: AuthError):
    error_msg = str(exc)
    print(f"AuthError caught in global handler: {error_msg}")
    return JSONResponse(
      status_code=status.HTTP_401_UNAUTHORIZED,
      content={"detail": "Invalid or expired token"},
      headers={
        "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
        "Access-Control-Allow-Credentials": "true",
      }
    )

  @app.exception_handler(Exception)
  async def general_exception_handler(request: Request, exc: Exception):
    import traceback
    error_type = type(exc).__name__
    error_msg = str(exc)
    
    # 检查是否是认证错误（即使没有被上面的处理器捕获）
    if 'AuthApiError' in error_type or 'AuthError' in error_type:
      print(f"Auth error detected in general handler (type: {error_type}): {error_msg}")
      return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": "Invalid or expired token"},
        headers={
          "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
          "Access-Control-Allow-Credentials": "true",
        }
      )
    
    # 检查错误消息中是否包含认证相关的关键词
    if 'expired' in error_msg.lower() or 'invalid' in error_msg.lower() or 'jwt' in error_msg.lower() or 'token' in error_msg.lower():
      print(f"Auth error detected by message in general handler: {error_msg}")
      return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": "Invalid or expired token"},
        headers={
          "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
          "Access-Control-Allow-Credentials": "true",
        }
      )
    
    print(f"Unhandled exception: {error_type}: {error_msg}")
    print(traceback.format_exc())
    return JSONResponse(
      status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
      content={"detail": "Internal server error"},
      headers={
        "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
        "Access-Control-Allow-Credentials": "true",
      }
    )

  app.include_router(threads.router)
  app.include_router(line.router)
  app.include_router(line_groups.router)
  app.include_router(points.router)
  app.include_router(admin_auth.router)
  app.include_router(admin.router)  # Tags routes are now included in admin router
  app.include_router(superadmin.router)
  app.include_router(announcements.router)
  app.include_router(stats.router)
  app.include_router(votes_reports.router)

  @app.get('/healthz', tags=['system'])
  async def healthcheck():
    return {'status': 'ok'}

  return app


app = create_app()


