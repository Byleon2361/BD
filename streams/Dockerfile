FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY streams_app.py .
CMD ["python", "streams_app.py", "worker", "-l", "info"]