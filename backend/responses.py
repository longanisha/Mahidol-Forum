from typing import Any, Optional

from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder


def success_response(message: str, status_code: int = 200, data: Optional[Any] = None) -> JSONResponse:
    payload = {"status_code": status_code, "message": message, "status": True}
    if data is not None:
        # include additional data under 'data' key
        payload["data"] = jsonable_encoder(data)
    return JSONResponse(content=payload, status_code=status_code)


def error_response(error: str, status_code: int = 400) -> JSONResponse:
    payload = {"status_code": status_code, "error": error, "status": False}
    return JSONResponse(content=payload, status_code=status_code)
