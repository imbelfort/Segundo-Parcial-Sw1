#!/usr/bin/env python3
"""
Script para entrenar el modelo de detección de elementos UML

Uso:
    python train_uml_model.py --epochs 100 --batch 16
    python train_uml_model.py --generate-data  # Para generar datos sintéticos
    python train_uml_model.py --train           # Para entrenar con datos existentes
"""

import argparse
import os
import sys
from uml_detector import UMLDetector
from uml_dataset_generator import UMLDatasetGenerator

def generate_training_data():
    """Generar datos de entrenamiento sintéticos UML"""
    print("🎨 Generando datos de entrenamiento UML sintéticos...")
    generator = UMLDatasetGenerator()
    generator.generate_dataset(num_train=500, num_val=100, num_test=50)
    print("✅ Datos UML generados exitosamente!")

def train_model(epochs=100, batch_size=16):
    """Entrenar el modelo UML con los datos existentes"""
    print(f"🚀 Iniciando entrenamiento del modelo UML...")
    print(f"   Épocas: {epochs}")
    print(f"   Batch size: {batch_size}")
    
    # Verificar que existan los datos
    if not os.path.exists('uml_dataset'):
        print("❌ No se encontró el dataset UML. Generando datos automáticamente...")
        generate_training_data()
    
    # Inicializar detector
    detector = UMLDetector()
    
    # Configurar parámetros de entrenamiento
    dataset_config = 'uml_dataset_config.yaml'
    
    try:
        # Entrenar modelo
        success = detector.train_model(dataset_config, epochs=epochs)
        
        if success:
            print("✅ Entrenamiento UML completado exitosamente!")
            print("📁 El modelo entrenado se guardó en: runs/detect/uml_detector/weights/best.pt")
            print("\n🔧 Para usar el modelo entrenado:")
            print("   1. Copia el archivo 'best.pt' a 'best_uml.pt' en la carpeta principal")
            print("   2. Usa uml_detector.py para detectar elementos UML")
            print("\n📊 Elementos que puede detectar:")
            print("   - Clases con atributos y métodos")
            print("   - Asociaciones")
            print("   - Dependencias")
            print("   - Agregaciones")
            print("   - Composiciones")
            print("   - Generalizaciones")
            print("   - Relaciones recursivas")
            print("   - Relaciones muchos a muchos")
        else:
            print("❌ Error durante el entrenamiento UML")
            return False
            
    except Exception as e:
        print(f"❌ Error durante el entrenamiento UML: {e}")
        return False
    
    return True

def evaluate_model(model_path=None):
    """Evaluar el modelo UML entrenado"""
    if model_path is None:
        model_path = 'runs/detect/uml_detector/weights/best.pt'
    
    if not os.path.exists(model_path):
        print(f"❌ No se encontró el modelo UML en: {model_path}")
        return
    
    print(f"🔍 Evaluando modelo UML: {model_path}")
    
    # Cargar modelo entrenado
    detector = UMLDetector(model_path)
    
    # Evaluar en datos de prueba
    test_dir = 'uml_dataset/images/test'
    if os.path.exists(test_dir):
        test_images = [f for f in os.listdir(test_dir) if f.endswith(('.jpg', '.png'))]
        
        print(f"📊 Evaluando en {len(test_images)} imágenes de prueba UML...")
        
        total_detections = 0
        class_counts = {}
        
        for img_name in test_images[:5]:  # Evaluar solo las primeras 5 para prueba
            img_path = os.path.join(test_dir, img_name)
            detections = detector.detect_uml_elements(img_path)
            total_detections += len(detections)
            
            # Contar tipos de elementos detectados
            for detection in detections:
                tipo = detection['tipo']
                class_counts[tipo] = class_counts.get(tipo, 0) + 1
            
            print(f"   {img_name}: {len(detections)} elementos UML detectados")
        
        avg_detections = total_detections / min(5, len(test_images))
        print(f"📈 Promedio de detecciones UML por imagen: {avg_detections:.1f}")
        
        print("\n📋 Distribución de elementos detectados:")
        for tipo, count in class_counts.items():
            print(f"   {tipo}: {count}")
    else:
        print("❌ No se encontró directorio de datos de prueba UML")

def test_detection(image_path):
    """Probar detección en una imagen específica"""
    if not os.path.exists(image_path):
        print(f"❌ No se encontró la imagen: {image_path}")
        return
    
    print(f"🔍 Probando detección UML en: {image_path}")
    
    # Cargar modelo entrenado
    detector = UMLDetector(model_path="best_uml.pt")
    
    # Detectar elementos
    detections = detector.detect_uml_elements(image_path)
    
    print(f"📊 Elementos UML detectados: {len(detections)}")
    
    for i, detection in enumerate(detections):
        print(f"\n{i+1}. {detection['tipo']}")
        print(f"   Posición: ({detection['x']}, {detection['y']})")
        print(f"   Tamaño: {detection['w']} x {detection['h']}")
        print(f"   Confianza: {detection['confidence']:.2f}")
        
        # Mostrar propiedades específicas
        if detection['tipo'] == 'Class':
            print(f"   Nombre: {detection.get('name', 'N/A')}")
            print(f"   Atributos: {len(detection.get('attributes', []))}")
            print(f"   Métodos: {len(detection.get('methods', []))}")
        elif detection['tipo'] in ['Association', 'Dependency', 'Aggregation', 'Composition', 'Generalization']:
            print(f"   Desde: {detection.get('from', 'N/A')}")
            print(f"   Hacia: {detection.get('to', 'N/A')}")
            print(f"   Etiqueta: {detection.get('label', 'N/A')}")

def main():
    parser = argparse.ArgumentParser(description='Entrenar modelo de detección de elementos UML')
    parser.add_argument('--generate-data', action='store_true', 
                        help='Generar datos de entrenamiento UML sintéticos')
    parser.add_argument('--train', action='store_true', 
                        help='Entrenar el modelo UML')
    parser.add_argument('--evaluate', action='store_true', 
                        help='Evaluar modelo UML entrenado')
    parser.add_argument('--test', type=str, 
                        help='Probar detección en una imagen específica')
    parser.add_argument('--epochs', type=int, default=100, 
                        help='Número de épocas de entrenamiento (default: 100)')
    parser.add_argument('--batch', type=int, default=16, 
                        help='Tamaño del batch (default: 16)')
    parser.add_argument('--model', type=str, 
                        help='Ruta del modelo para evaluación')
    
    args = parser.parse_args()
    
    if len(sys.argv) == 1:
        # Si no se especifican argumentos, mostrar menú interactivo
        print("🤖 Entrenador de Red Neuronal para Detección de Elementos UML")
        print("=" * 70)
        print("1. Generar datos de entrenamiento UML sintéticos")
        print("2. Entrenar modelo UML")
        print("3. Evaluar modelo UML")
        print("4. Proceso completo UML (generar + entrenar + evaluar)")
        print("5. Probar detección en imagen")
        print("6. Salir")
        
        while True:
            try:
                choice = input("\nSelecciona una opción (1-6): ").strip()
                
                if choice == '1':
                    generate_training_data()
                    break
                elif choice == '2':
                    epochs = input(f"Épocas de entrenamiento (default: 100): ").strip()
                    epochs = int(epochs) if epochs else 100
                    batch = input(f"Tamaño del batch (default: 16): ").strip()
                    batch = int(batch) if batch else 16
                    train_model(epochs, batch)
                    break
                elif choice == '3':
                    evaluate_model()
                    break
                elif choice == '4':
                    print("🔄 Ejecutando proceso completo UML...")
                    generate_training_data()
                    print("\n" + "="*50)
                    if train_model(epochs=50, batch_size=16):  # Entrenamiento más corto para prueba
                        print("\n" + "="*50)
                        evaluate_model()
                    break
                elif choice == '5':
                    image_path = input("Ruta de la imagen a probar: ").strip()
                    if image_path:
                        test_detection(image_path)
                    break
                elif choice == '6':
                    print("👋 ¡Hasta luego!")
                    break
                else:
                    print("❌ Opción inválida. Selecciona 1-6.")
            except KeyboardInterrupt:
                print("\n👋 Operación cancelada.")
                break
            except ValueError:
                print("❌ Por favor ingresa un número válido.")
    else:
        # Procesar argumentos de línea de comandos
        if args.generate_data:
            generate_training_data()
        
        if args.train:
            train_model(args.epochs, args.batch)
        
        if args.evaluate:
            evaluate_model(args.model)
        
        if args.test:
            test_detection(args.test)

if __name__ == "__main__":
    main()
