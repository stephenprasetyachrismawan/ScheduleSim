# ScheduleSim: frontend build, then the backend with the exact research library versions.
FROM node:22-slim AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OMP_NUM_THREADS=1 \
    SCHEDULESIM_DATA=/data SCHEDULESIM_STATIC=/app/frontend/dist
WORKDIR /app
# same versions as the run that produced the thesis numbers (CPU torch)
COPY vendor/arls-ppo/exp1/dfjsp-ppo-repair/requirements-lock.txt /tmp/requirements-lock.txt
RUN pip install --no-cache-dir -r /tmp/requirements-lock.txt \
 && pip install --no-cache-dir fastapi==0.128.0 uvicorn==0.40.0
COPY vendor/ vendor/
COPY backend/ backend/
COPY --from=web /app/frontend/dist frontend/dist
ARG ARLS_PPO_COMMIT=""
ENV ARLS_PPO_COMMIT=${ARLS_PPO_COMMIT}
WORKDIR /app/backend
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "schedulesim.api:app", "--host", "0.0.0.0", "--port", "8000"]
