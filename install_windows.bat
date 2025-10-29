@echo off
echo ====================================
echo  INSTALADOR DE RED NEURONAL UI
echo ====================================
echo.

echo [1/5] Verificando Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python no encontrado
    echo.
    echo Por favor instala Python desde: https://www.python.org/downloads/
    echo IMPORTANTE: Marca "Add Python to PATH" durante la instalacion
    pause
    exit /b 1
)

echo [2/5] Verificando pip...
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: pip no encontrado
    echo Instalando pip...
    python -m ensurepip --upgrade
)

echo [3/5] Actualizando pip...
python -m pip install --upgrade pip

echo [4/5] Instalando dependencias principales...
echo Instalando PyTorch (esto puede tomar varios minutos)...
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo Instalando OpenCV...
pip install opencv-python

echo Instalando Ultralytics...
pip install ultralytics

echo [5/5] Instalando dependencias restantes...
pip install -r requirements.txt

echo.
echo ====================================
echo  INSTALACION COMPLETADA
echo ====================================
echo.
echo Ejecuta el siguiente comando para probar:
echo python test_ia.py
echo.
pause 