#!/usr/bin/env python3
"""
Script de instalación y configuración para el detector UML
Instala dependencias y configura el entorno
"""

import subprocess
import sys
import os

def install_requirements():
    """Instalar dependencias necesarias"""
    print("📦 Instalando dependencias para el detector UML...")
    
    requirements = [
        "ultralytics",
        "opencv-python",
        "pillow",
        "numpy",
        "torch",
        "torchvision"
    ]
    
    for package in requirements:
        try:
            print(f"   Instalando {package}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])
            print(f"   ✅ {package} instalado correctamente")
        except subprocess.CalledProcessError as e:
            print(f"   ❌ Error instalando {package}: {e}")
            return False
    
    print("✅ Todas las dependencias instaladas correctamente")
    return True

def download_yolo_model():
    """Descargar modelo base YOLO"""
    print("🤖 Descargando modelo base YOLO...")
    
    try:
        from ultralytics import YOLO
        model = YOLO('yolov8n.pt')
        print("✅ Modelo YOLO descargado correctamente")
        return True
    except Exception as e:
        print(f"❌ Error descargando modelo YOLO: {e}")
        return False

def create_directories():
    """Crear directorios necesarios"""
    print("📁 Creando directorios necesarios...")
    
    directories = [
        "uml_dataset/images/train",
        "uml_dataset/images/val", 
        "uml_dataset/images/test",
        "uml_dataset/labels/train",
        "uml_dataset/labels/val",
        "uml_dataset/labels/test",
        "runs/detect"
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"   ✅ Directorio creado: {directory}")
    
    print("✅ Todos los directorios creados correctamente")

def main():
    print("🚀 Configurando Detector UML para Diagramas de Clases")
    print("=" * 60)
    
    # Instalar dependencias
    if not install_requirements():
        print("❌ Error en la instalación de dependencias")
        return
    
    print("\n" + "="*50)
    
    # Descargar modelo YOLO
    if not download_yolo_model():
        print("❌ Error descargando modelo YOLO")
        return
    
    print("\n" + "="*50)
    
    # Crear directorios
    create_directories()
    
    print("\n" + "="*50)
    print("🎉 ¡Configuración completada exitosamente!")
    print("\n📋 Próximos pasos:")
    print("1. Generar dataset: python train_uml_model.py --generate-data")
    print("2. Entrenar modelo: python train_uml_model.py --train")
    print("3. Probar detección: python uml_detector.py imagen.jpg")
    print("\n🔧 Archivos creados:")
    print("   - uml_detector.py (detector principal)")
    print("   - uml_dataset_generator.py (generador de datos)")
    print("   - train_uml_model.py (entrenador)")
    print("   - uml_dataset_config.yaml (configuración)")

if __name__ == "__main__":
    main()
