#!/usr/bin/env python3
"""
Detector de elementos UML para diagramas de clases
Detecta: Clases, Asociaciones, Dependencias, Agregaciones, Relaciones recursivas, etc.
"""

import cv2
import numpy as np
from ultralytics import YOLO
import json
import sys
import os
from PIL import Image, ImageDraw, ImageFont
import torch
import random
import math

class UMLDetector:
    def __init__(self, model_path=None):
        """
        Inicializa el detector de elementos UML
        """
        self.classes = {
            0: 'Class',
            1: 'Association', 
            2: 'Dependency',
            3: 'Aggregation',
            4: 'Composition',
            5: 'Generalization',
            6: 'RecursiveRelation',
            7: 'ManyToManyRelation',
            8: 'Attribute',
            9: 'Method'
        }
        
        # Diccionario para almacenar clases detectadas
        self.detected_classes = {}
        
        if model_path and os.path.exists(model_path):
            self.model = YOLO(model_path)
        else:
            # Usar modelo base YOLO
            self.model = YOLO('yolov8n.pt')
    
    def preprocess_image(self, image_path):
        """
        Preprocesa la imagen para la detección UML
        """
        try:
            # Leer imagen
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"No se pudo cargar la imagen: {image_path}")
            
            # Convertir BGR a RGB
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Redimensionar manteniendo aspecto
            height, width = image.shape[:2]
            max_size = 640
            
            if max(height, width) > max_size:
                scale = max_size / max(height, width)
                new_width = int(width * scale)
                new_height = int(height * scale)
                image = cv2.resize(image, (new_width, new_height))
            
            return image, (width, height)
            
        except Exception as e:
            print(f"Error al preprocesar imagen: {e}")
            return None, None
    
    def detect_uml_elements(self, image_path, confidence_threshold=0.5):
        """
        Detecta elementos UML en la imagen
        """
        try:
            # Preprocesar imagen
            processed_image, original_size = self.preprocess_image(image_path)
            if processed_image is None:
                return []
            
            # Realizar detección
            results = self.model(processed_image, conf=confidence_threshold)
            
            # Procesar resultados
            detections = []
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        # Obtener coordenadas y confianza
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        confidence = float(box.conf[0].cpu().numpy())
                        class_id = int(box.cls[0].cpu().numpy())
                        
                        # Mapear a coordenadas originales si es necesario
                        if original_size:
                            orig_w, orig_h = original_size
                            curr_h, curr_w = processed_image.shape[:2]
                            scale_x = orig_w / curr_w
                            scale_y = orig_h / curr_h
                            
                            x1 *= scale_x
                            x2 *= scale_x
                            y1 *= scale_y
                            y2 *= scale_y
                        
                        # Crear detección
                        detection = {
                            'tipo': self.classes.get(class_id, 'Unknown'),
                            'x': int(x1),
                            'y': int(y1),
                            'w': int(x2 - x1),
                            'h': int(y2 - y1),
                            'confidence': confidence
                        }
                        
                        # Añadir propiedades específicas del elemento UML
                        detection = self.add_uml_properties(detection)
                        detections.append(detection)
            
            # Procesar relaciones para usar IDs de clases
            detections = self.process_relations(detections)
            
            return detections
            
        except Exception as e:
            print(f"Error en detección UML: {e}")
            return []
    
    def add_uml_properties(self, detection):
        """
        Añade propiedades específicas según el tipo de elemento UML detectado
        """
        tipo = detection['tipo']
        
        if tipo == 'Class':
            import time
            import random
            detection['id'] = int(time.time() * 1000) + random.randint(0, 999999)
            detection['name'] = 'Clase'
            detection['attributes'] = ['+ atributo1: Tipo', '+ atributo2: Tipo']
            detection['methods'] = ['+ metodo1(): Tipo', '+ metodo2(): Tipo']
            
            # Almacenar la clase detectada
            self.detected_classes[detection['name']] = detection['id']
        elif tipo == 'Association':
            detection['from'] = 'clase1'
            detection['to'] = 'clase2'
            detection['multOrigen'] = '1'
            detection['multDestino'] = '*'
            detection['label'] = 'asocia'
        elif tipo == 'Dependency':
            detection['from'] = 'clase1'
            detection['to'] = 'clase2'
            detection['multOrigen'] = ''
            detection['multDestino'] = ''
            detection['label'] = 'depende'
        elif tipo == 'Aggregation':
            detection['from'] = 'clase1'
            detection['to'] = 'clase2'
            detection['multOrigen'] = '1'
            detection['multDestino'] = '*'
            detection['label'] = 'contiene'
        elif tipo == 'Composition':
            detection['from'] = 'clase1'
            detection['to'] = 'clase2'
            detection['multOrigen'] = '1'
            detection['multDestino'] = '*'
            detection['label'] = 'compone'
        elif tipo == 'Generalization':
            detection['from'] = 'clase_hijo'
            detection['to'] = 'clase_padre'
            detection['multOrigen'] = ''
            detection['multDestino'] = ''
            detection['label'] = 'hereda'
        elif tipo == 'RecursiveRelation':
            detection['from'] = 'clase'
            detection['to'] = 'clase'
            detection['multOrigen'] = '1'
            detection['multDestino'] = '*'
            detection['label'] = 'recursiva'
        elif tipo == 'ManyToManyRelation':
            detection['from'] = 'clase1'
            detection['to'] = 'clase2'
            detection['multOrigen'] = '*'
            detection['multDestino'] = '*'
            detection['label'] = 'muchos a muchos'
        
        return detection
    
    def process_relations(self, detections):
        """
        Procesa las relaciones para usar IDs reales de las clases
        """
        # Obtener clases detectadas
        classes = [d for d in detections if d['tipo'] == 'Class']
        
        if len(classes) < 2:
            return detections
        
        # Asignar IDs reales a las relaciones
        for detection in detections:
            if detection['tipo'] in ['Association', 'Dependency', 'Aggregation', 'Composition', 'Generalization', 'RecursiveRelation', 'ManyToManyRelation']:
                # Usar IDs de las clases detectadas
                if len(classes) >= 2:
                    detection['from'] = classes[0]['id']
                    detection['to'] = classes[1]['id']
                elif len(classes) == 1:
                    # Para relaciones recursivas
                    detection['from'] = classes[0]['id']
                    detection['to'] = classes[0]['id']
        
        return detections
    
    def train_model(self, dataset_path, epochs=100):
        """
        Entrena el modelo con un dataset UML personalizado
        """
        try:
            # Configurar entrenamiento
            self.model.train(
                data=dataset_path,
                epochs=epochs,
                imgsz=640,
                batch=16,
                name='uml_detector',
                device='cpu'  # Cambiar a 'cuda' si tienes GPU
            )
            
            print("Entrenamiento UML completado")
            return True
            
        except Exception as e:
            print(f"Error en entrenamiento UML: {e}")
            return False

def main():
    if len(sys.argv) < 2:
        print("Uso: python uml_detector.py <imagen_path>")
        return
    
    image_path = sys.argv[1]
    
    # Inicializar detector - usar el modelo entrenado si existe
    model_path = None
    if os.path.exists("best.pt"):
        model_path = "best.pt"
    elif os.path.exists("best_uml.pt"):
        model_path = "best_uml.pt"
    
    detector = UMLDetector(model_path=model_path)
    
    # Detectar elementos UML
    detections = detector.detect_uml_elements(image_path)
    
    # Mostrar resultados en formato JSON para la pizarra (sin indentación para evitar problemas)
    print(json.dumps(detections))

if __name__ == "__main__":
    main()
