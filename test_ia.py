#!/usr/bin/env python3
"""
Script de prueba para verificar el funcionamiento de la red neuronal

Uso:
    python test_ia.py
"""

import os
import sys
import json
from PIL import Image, ImageDraw

def test_imports():
    """Probar que todas las dependencias estén instaladas"""
    print("🔍 Verificando dependencias...")
    
    try:
        import cv2
        print("✅ OpenCV instalado correctamente")
    except ImportError:
        print("❌ OpenCV no encontrado. Ejecuta: pip install opencv-python")
        return False
    
    try:
        from ultralytics import YOLO
        print("✅ Ultralytics/YOLO instalado correctamente")
    except ImportError:
        print("❌ Ultralytics no encontrado. Ejecuta: pip install ultralytics")
        return False
    
    try:
        import torch
        print("✅ PyTorch instalado correctamente")
        if torch.cuda.is_available():
            print(f"   GPU disponible: {torch.cuda.get_device_name(0)}")
        else:
            print("   Usando CPU (sin GPU)")
    except ImportError:
        print("❌ PyTorch no encontrado. Ejecuta: pip install torch")
        return False
    
    try:
        import numpy as np
        from PIL import Image
        print("✅ NumPy y PIL instalados correctamente")
    except ImportError:
        print("❌ NumPy o PIL no encontrados. Ejecuta: pip install numpy pillow")
        return False
    
    return True

def create_test_image():
    """Crear una imagen de prueba con elementos UI sintéticos"""
    print("🎨 Creando imagen de prueba...")
    
    # Crear imagen base
    img = Image.new('RGB', (400, 300), color='white')
    draw = ImageDraw.Draw(img)
    
    # Dibujar algunos elementos UI básicos
    # Botón
    draw.rounded_rectangle([50, 50, 150, 80], radius=5, fill='#6200EE', outline='#3700B3')
    draw.text((75, 60), "Button", fill='white')
    
    # Input
    draw.rectangle([50, 100, 250, 130], fill='white', outline='gray')
    draw.text((60, 110), "Enter text...", fill='gray')
    
    # Card
    draw.rounded_rectangle([50, 150, 250, 230], radius=8, fill='white', outline='#ddd')
    draw.text((60, 160), "Card Title", fill='black')
    draw.text((60, 180), "Card content here", fill='gray')
    
    # Checkbox
    draw.rectangle([50, 250, 70, 270], fill='white', outline='gray')
    draw.text((80, 255), "Checkbox", fill='black')
    
    # Guardar imagen
    test_img_path = 'test_image.jpg'
    img.save(test_img_path)
    print(f"✅ Imagen de prueba guardada: {test_img_path}")
    
    return test_img_path

def test_detector():
    """Probar el detector de elementos UI"""
    print("🤖 Probando detector de elementos UI...")
    
    try:
        from ui_detector import UIDetector
        
        # Crear imagen de prueba
        test_img_path = create_test_image()
        
        # Inicializar detector
        detector = UIDetector()
        print("✅ Detector inicializado correctamente")
        
        # Detectar elementos
        detections = detector.detect_ui_elements(test_img_path, confidence_threshold=0.1)
        
        print(f"🔍 Detecciones encontradas: {len(detections)}")
        
        if len(detections) > 0:
            print("📊 Detalles de detecciones:")
            for i, detection in enumerate(detections):
                print(f"   {i+1}. Tipo: {detection['tipo']}")
                print(f"      Posición: ({detection['x']}, {detection['y']})")
                print(f"      Tamaño: {detection['w']}x{detection['h']}")
                print(f"      Confianza: {detection.get('confidence', 'N/A')}")
                print()
        
        # Limpiar archivo de prueba
        if os.path.exists(test_img_path):
            os.remove(test_img_path)
            print("🧹 Archivo de prueba eliminado")
        
        return True
        
    except Exception as e:
        print(f"❌ Error en el detector: {e}")
        return False

def test_dataset_generator():
    """Probar el generador de dataset"""
    print("📊 Probando generador de dataset...")
    
    try:
        from prepare_dataset import UIDatasetGenerator
        
        # Crear instancia del generador
        generator = UIDatasetGenerator('test_dataset')
        print("✅ Generador inicializado correctamente")
        
        # Generar una imagen de prueba
        img, annotations = generator.generate_synthetic_image(num_elements=3)
        
        # Guardar imagen de prueba
        test_dataset_img = 'test_synthetic.jpg'
        img.save(test_dataset_img)
        
        print(f"✅ Imagen sintética generada: {test_dataset_img}")
        print(f"📝 Anotaciones generadas: {len(annotations)}")
        
        for i, ann in enumerate(annotations):
            print(f"   {i+1}. Clase: {ann['class']}")
            print(f"      Centro: ({ann['x_center']:.2f}, {ann['y_center']:.2f})")
            print(f"      Tamaño: {ann['width']:.2f}x{ann['height']:.2f}")
        
        # Limpiar archivos de prueba
        if os.path.exists(test_dataset_img):
            os.remove(test_dataset_img)
        
        # Limpiar directorio de prueba
        import shutil
        if os.path.exists('test_dataset'):
            shutil.rmtree('test_dataset')
        
        print("🧹 Archivos de prueba eliminados")
        
        return True
        
    except Exception as e:
        print(f"❌ Error en el generador: {e}")
        return False

def test_server_endpoint():
    """Probar que el servidor tenga el endpoint configurado"""
    print("🌐 Verificando configuración del servidor...")
    
    if not os.path.exists('server.js'):
        print("❌ No se encontró server.js")
        return False
    
    with open('server.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    if '/procesar-imagen' in content:
        print("✅ Endpoint /procesar-imagen configurado")
    else:
        print("❌ Endpoint /procesar-imagen no encontrado en server.js")
        return False
    
    if 'multer' in content:
        print("✅ Multer configurado para subida de archivos")
    else:
        print("❌ Multer no encontrado en server.js")
        return False
    
    return True

def test_frontend_integration():
    """Probar que el frontend tenga la integración"""
    print("🖥️ Verificando integración del frontend...")
    
    # Verificar script.js
    script_path = 'public/script.js'
    if os.path.exists(script_path):
        with open(script_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'procesarImagenConIA' in content:
            print("✅ Función procesarImagenConIA encontrada en script.js")
        else:
            print("⚠️ Función procesarImagenConIA no encontrada en script.js")
    
    # Verificar proyecto.ejs
    view_path = 'views/proyecto.ejs'
    if os.path.exists(view_path):
        with open(view_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'procesarImagenConIA' in content:
            print("✅ Integración de IA encontrada en proyecto.ejs")
        else:
            print("⚠️ Integración de IA no encontrada en proyecto.ejs")
    
    return True

def main():
    """Función principal de prueba"""
    print("🧪 Iniciando pruebas de la Red Neuronal para UI")
    print("=" * 50)
    
    tests = [
        ("Dependencias", test_imports),
        ("Generador de Dataset", test_dataset_generator),
        ("Detector de Elementos", test_detector),
        ("Configuración del Servidor", test_server_endpoint),
        ("Integración Frontend", test_frontend_integration),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🔬 Ejecutando: {test_name}")
        print("-" * 30)
        
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Error inesperado: {e}")
            results.append((test_name, False))
    
    # Resumen de resultados
    print("\n" + "=" * 50)
    print("📋 RESUMEN DE PRUEBAS")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASÓ" if result else "❌ FALLÓ"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print("-" * 30)
    print(f"Pruebas pasadas: {passed}/{total}")
    
    if passed == total:
        print("\n🎉 ¡Todas las pruebas pasaron! La integración está lista.")
        print("\n📝 Próximos pasos:")
        print("1. Ejecuta: python train_model.py")
        print("2. Inicia el servidor: npm start")
        print("3. Prueba subir una imagen en la aplicación")
    else:
        print(f"\n⚠️ {total - passed} prueba(s) fallaron. Revisa los errores arriba.")
        print("\n🔧 Pasos de solución:")
        print("1. Instala las dependencias faltantes")
        print("2. Verifica la configuración de archivos")
        print("3. Ejecuta las pruebas nuevamente")

if __name__ == "__main__":
    main() 