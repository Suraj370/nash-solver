# API image. Build from the repo root so the local solver package is in the build context:
#   docker build -t nash-solver-api .
FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv
ENV UV_PYTHON=3.13 UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy PYTHONUNBUFFERED=1

WORKDIR /app
# Dependencies first so code changes do not invalidate the layer cache.
COPY solver/pyproject.toml solver/README.md ./solver/
COPY solver/src ./solver/src
COPY api/pyproject.toml api/uv.lock ./api/
RUN uv sync --frozen --no-dev --project api

COPY api/app ./api/app
COPY benchmarks/results ./benchmarks/results

ENV PATH="/app/api/.venv/bin:$PATH"
WORKDIR /app/api
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
