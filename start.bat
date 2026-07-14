@echo off
cd /d %~dp0backend
if not exist venv (
  echo Creating venv...
  python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt
echo.
echo Make sure Laragon MySQL is RUNNING (Start All)!
echo.
python run.py
pause
