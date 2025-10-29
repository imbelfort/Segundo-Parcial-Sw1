#!/usr/bin/env python3
"""
Script para entrenar el modelo de detección de elementos UI

Uso:
    python train_model.py --epochs 100 --batch 16
    python train_model.py --generate-data  # Para generar datos sintéticos
    python train_model.py --train           # Para entrenar con datos existentes
"""

import argparse
import os
import sys
from ui_detector import UIDetector
from prepare_dataset import UIDatasetGenerator

def generate_training_data():
    """Generar datos de entrenamiento sintéticos"""
    print("🎨 Generando datos de entrenamiento sintéticos...")
    generator = UIDatasetGenerator()
    generator.generate_dataset(num_train=500, num_val=100, num_test=50)
    print("✅ Datos generados exitosamente!")

def train_model(epochs=100, batch_size=16):
    """Entrenar el modelo con los datos existentes"""
    print(f"🚀 Iniciando entrenamiento del modelo...")
    print(f"   Épocas: {epochs}")
    print(f"   Batch size: {batch_size}")
    
    # Verificar que existan los datos
    if not os.path.exists('ui_dataset'):
        print("❌ No se encontró el dataset. Generando datos automáticamente...")
        generate_training_data()
    
    # Inicializar detector
    detector = UIDetector()
    
    # Configurar parámetros de entrenamiento
    dataset_config = 'ui_dataset_config.yaml'
    
    try:
        # Entrenar modelo
        success = detector.train_model(dataset_config, epochs=epochs)
        
        if success:
            print("✅ Entrenamiento completado exitosamente!")
            print("📁 El modelo entrenado se guardó en: runs/detect/ui_detector/weights/best.pt")
            print("\n🔧 Para usar el modelo entrenado:")
            print("   1. Copia el archivo 'best.pt' a la carpeta principal")
            print("   2. Modifica ui_detector.py para usar el modelo entrenado")
        else:
            print("❌ Error durante el entrenamiento")
            return False
            
    except Exception as e:
        print(f"❌ Error durante el entrenamiento: {e}")
        return False
    
    return True

def evaluate_model(model_path=None):
    """Evaluar el modelo entrenado"""
    if model_path is None:
        model_path = 'runs/detect/ui_detector/weights/best.pt'
    
    if not os.path.exists(model_path):
        print(f"❌ No se encontró el modelo en: {model_path}")
        return
    
    print(f"🔍 Evaluando modelo: {model_path}")
    
    # Cargar modelo entrenado
    detector = UIDetector(model_path)
    
    # Evaluar en datos de prueba
    test_dir = 'ui_dataset/images/test'
    if os.path.exists(test_dir):
        test_images = [f for f in os.listdir(test_dir) if f.endswith(('.jpg', '.png'))]
        
        print(f"📊 Evaluando en {len(test_images)} imágenes de prueba...")
        
        total_detections = 0
        for img_name in test_images[:5]:  # Evaluar solo las primeras 5 para prueba
            img_path = os.path.join(test_dir, img_name)
            detections = detector.detect_ui_elements(img_path)
            total_detections += len(detections)
            print(f"   {img_name}: {len(detections)} elementos detectados")
        
        avg_detections = total_detections / min(5, len(test_images))
        print(f"📈 Promedio de detecciones por imagen: {avg_detections:.1f}")
    else:
        print("❌ No se encontró directorio de datos de prueba")

def main():
    parser = argparse.ArgumentParser(description='Entrenar modelo de detección de elementos UI')
    parser.add_argument('--generate-data', action='store_true', 
                        help='Generar datos de entrenamiento sintéticos')
    parser.add_argument('--train', action='store_true', 
                        help='Entrenar el modelo')
    parser.add_argument('--evaluate', action='store_true', 
                        help='Evaluar modelo entrenado')
    parser.add_argument('--epochs', type=int, default=100, 
                        help='Número de épocas de entrenamiento (default: 100)')
    parser.add_argument('--batch', type=int, default=16, 
                        help='Tamaño del batch (default: 16)')
    parser.add_argument('--model', type=str, 
                        help='Ruta del modelo para evaluación')
    
    args = parser.parse_args()
    
    if len(sys.argv) == 1:
        # Si no se especifican argumentos, mostrar menú interactivo
        print("🤖 Entrenador de Red Neuronal para Detección de Elementos UI")
        print("=" * 60)
        print("1. Generar datos de entrenamiento sintéticos")
        print("2. Entrenar modelo")
        print("3. Evaluar modelo")
        print("4. Proceso completo (generar + entrenar + evaluar)")
        print("5. Salir")
        
        while True:
            try:
                choice = input("\nSelecciona una opción (1-5): ").strip()
                
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
                    print("🔄 Ejecutando proceso completo...")
                    generate_training_data()
                    print("\n" + "="*50)
                    if train_model(epochs=50, batch_size=16):  # Entrenamiento más corto para prueba
                        print("\n" + "="*50)
                        evaluate_model()
                    break
                elif choice == '5':
                    print("👋 ¡Hasta luego!")
                    break
                else:
                    print("❌ Opción inválida. Selecciona 1-5.")
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

if __name__ == "__main__":
    main() 