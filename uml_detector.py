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
            # Cargar la imagen original para extraer texto
            original_image = cv2.imread(image_path)
            if original_image is None:
                print(f"Error: No se pudo cargar la imagen {image_path}")
                return []
                
            # Preprocesar imagen para detección
            processed_image, original_size = self.preprocess_image(image_path)
            if processed_image is None:
                return []
            
            # Realizar detección
            results = self.model(processed_image, conf=confidence_threshold)
            
            # Procesar resultados
            detections = []
            class_detections = []
            
            # Primero procesar todas las clases
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        class_id = int(box.cls[0].cpu().numpy())
                        if self.classes.get(class_id) == 'Class':
                            # Obtener coordenadas y confianza
                            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                            confidence = float(box.conf[0].cpu().numpy())
                            
                            # Mapear a coordenadas originales si es necesario
                            if original_size:
                                orig_w, orig_h = original_size
                                curr_h, curr_w = processed_image.shape[:2]
                                scale_x = orig_w / curr_w
                                scale_y = orig_h / curr_h
                                
                                x1 = int(x1 * scale_x)
                                x2 = int(x2 * scale_x)
                                y1 = int(y1 * scale_y)
                                y2 = int(y2 * scale_y)
                            
                            # Crear detección
                            detection = {
                                'tipo': 'Class',
                                'x': x1,
                                'y': y1,
                                'w': x2 - x1,
                                'h': y2 - y1,
                                'confidence': confidence
                            }
                            
                            # Extraer texto de la clase
                            detection = self.add_uml_properties(detection, original_image)
                            class_detections.append(detection)
            
            # Luego procesar relaciones
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        class_id = int(box.cls[0].cpu().numpy())
                        if self.classes.get(class_id) != 'Class':  # Es una relación
                            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                            confidence = float(box.conf[0].cpu().numpy())
                            
                            # Mapear a coordenadas originales si es necesario
                            if original_size:
                                orig_w, orig_h = original_size
                                curr_h, curr_w = processed_image.shape[:2]
                                scale_x = orig_w / curr_w
                                scale_y = orig_h / curr_h
                                
                                x1 = int(x1 * scale_x)
                                x2 = int(x2 * scale_x)
                                y1 = int(y1 * scale_y)
                                y2 = int(y2 * scale_y)
                            
                            # Crear detección de relación
                            detection = {
                                'tipo': self.classes.get(class_id, 'Unknown'),
                                'x': x1,
                                'y': y1,
                                'w': x2 - x1,
                                'h': y2 - y1,
                                'confidence': confidence
                            }
                            
                            # Añadir propiedades específicas de la relación
                            detection = self.add_uml_properties(detection)
                            detections.append(detection)
            
            # Combinar clases y relaciones
            detections = class_detections + detections
            
            # Procesar relaciones para usar IDs de clases
            detections = self.process_relations(detections)
            
            return detections
            
        except Exception as e:
            print(f"Error en detección UML: {e}")
            return []
    
    def extract_text_from_roi(self, image, x, y, w, h):
        """
        Extrae texto de una región de interés (ROI) en la imagen
        """
        try:
            # Asegurarse de que las coordenadas estén dentro de los límites de la imagen
            h_img, w_img = image.shape[:2]
            x1, y1 = max(0, x), max(0, y)
            x2, y2 = min(w_img, x + w), min(h_img, y + h)
            
            if x1 >= x2 or y1 >= y2:
                return []
                
            # Recortar la región de interés
            roi = image[y1:y2, x1:x2]
            
            # Convertir a escala de grises
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            
            # Aplicar umbral adaptativo
            thresh = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY_INV, 11, 2
            )
            
            # Usar pytesseract para extraer texto
            try:
                import pytesseract
                # Configurar parámetros para extraer solo texto estructurado
                custom_config = r'--oem 3 --psd 6'
                text = pytesseract.image_to_string(thresh, config=custom_config)
                
                # Procesar el texto extraído
                lines = [line.strip() for line in text.split('\n') if line.strip()]
                return lines
                
            except ImportError:
                print("Advertencia: pytesseract no está instalado. Instálalo con 'pip install pytesseract'")
                return []
                
        except Exception as e:
            print(f"Error al extraer texto: {e}")
            return []
    
    def parse_class_text(self, lines):
        """
        Parsea el texto extraído de una clase para obtener nombre, atributos y métodos
        """
        if not lines:
            return 'Clase', [], []
            
        # El primer elemento es el nombre de la clase
        class_name = lines[0] if lines else 'Clase'
        attributes = []
        methods = []
        in_methods_section = False
        
        for line in lines[1:]:  # Empezar desde la segunda línea
            # Buscar separador de atributos/métodos (línea horizontal)
            if '---' in line or '___' in line or '===' in line:
                in_methods_section = True
                continue
                
            # Limpiar la línea
            line = line.strip()
            if not line:
                continue
                
            # Clasificar como atributo o método
            if in_methods_section:
                if '(' in line and ')' in line:  # Es un método
                    methods.append(line)
            else:
                if ':' in line:  # Es un atributo con tipo
                    attributes.append(line)
        
        return class_name, attributes, methods
    
    def add_uml_properties(self, detection, image=None):
        """
        Añade propiedades específicas según el tipo de elemento UML detectado
        """
        tipo = detection['tipo']
        
        if tipo == 'Class' and image is not None:
            import time
            import random
            
            # Extraer texto de la región de la clase
            x, y, w, h = detection['x'], detection['y'], detection['w'], detection['h']
            text_lines = self.extract_text_from_roi(image, x, y, w, h)
            
            # Parsear el texto extraído
            class_name, attributes, methods = self.parse_class_text(text_lines)
            
            # Actualizar la detección con la información extraída
            detection['id'] = int(time.time() * 1000) + random.randint(0, 999999)
            detection['name'] = class_name if class_name != 'Clase' else f'Clase_{detection["id"]}'
            detection['attributes'] = attributes or ['+ atributo1: Tipo']
            detection['methods'] = methods or ['+ metodo1(): Tipo']
            
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
            print(f"Error durante el entrenamiento: {str(e)}")
            return False


def main():
    if len(sys.argv) < 2:
        print("Uso: python uml_detector.py <ruta_imagen> [ruta_modelo]")
        print("Ejemplo: python uml_detector.py diagrama.png best_uml.pt")
        sys.exit(1)
        
    image_path = sys.argv[1]
    
    # Usar la ruta del modelo proporcionada o la predeterminada
    model_path = sys.argv[2] if len(sys.argv) > 2 else 'best_uml.pt'
    
    # Verificar si el modelo existe
    if not os.path.exists(model_path):
        print(f"Error: No se encontró el modelo en {os.path.abspath(model_path)}")
        print("Directorio actual:", os.getcwd())
        print("Archivos en el directorio:", os.listdir('.'))
        sys.exit(1)
    
    print(f"Usando modelo: {os.path.abspath(model_path)}")
    
    # Inicializar detector
    try:
        detector = UMLDetector(model_path)
        print("Detector UML inicializado correctamente")
    except Exception as e:
        print(f"Error al inicializar el detector: {str(e)}")
        sys.exit(1)
    
    # Verificar si la imagen existe
    if not os.path.exists(image_path):
        print(f"Error: No se encontró la imagen en {os.path.abspath(image_path)}")
        sys.exit(1)
    
    print(f"Procesando imagen: {os.path.abspath(image_path)}")
    
    # Procesar imagen
    try:
        result = detector.detect_uml_elements(image_path)
        # Asegurarse de que el resultado sea serializable a JSON
        if result is not None:
            print(json.dumps(result, indent=2))
        else:
            print(json.dumps({"error": "No se detectaron elementos UML"}))
    except Exception as e:
        print(f"Error al procesar la imagen: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
