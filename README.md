# GridSense — AI-powered electricity loss intelligence platform

## How to run locally

### 1. Generate Synthetic Data
```bash
python data/generator.py
```

### 2. Run the Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Run the Frontend
```bash
cd frontend
npm install
npm run dev
```
