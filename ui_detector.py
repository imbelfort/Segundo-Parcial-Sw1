import cv2
import numpy as np
from ultralytics import YOLO
import json
import sys
import os
from PIL import Image
import torch

class UIDetector:
    def __init__(self, model_path=None):
        """
        Inicializa el detector de elementos UI
        """
        self.classes = {
            0: 'Button',
            1: 'Input', 
            2: 'Title',
            3: 'Card',
            4: 'Search',
            5: 'AppBar',
            6: 'TabBar',
            7: 'Checkbox',
            8: 'NavigationRail',
            9: 'DataTable',
            10: 'FAB',
            11: 'Image',
            12: 'Text'
        }
        
        if model_path and os.path.exists(model_path):
            self.model = YOLO('best.pt')
        else:
            # Entrenar un modelo personalizado o usar uno preentrenado
            self.model = self.create_custom_model()
    
    def create_custom_model(self):
        """
        Crea un modelo personalizado para detección de elementos UI
        """
        # Configuración del modelo YOLO personalizado
        model_config = {
            'nc': len(self.classes),  # número de clases
            'depth_multiple': 0.33,
            'width_multiple': 0.25,
            'anchors': [
                [10,13, 16,30, 33,23],
                [30,61, 62,45, 59,119],
                [116,90, 156,198, 373,326]
            ]
        }
        
        # Por ahora usamos YOLOv8n como base y lo adaptamos
        model = YOLO('yolov8n.pt')
        return model
    
    def preprocess_image(self, image_path):
        """
        Preprocesa la imagen para la detección
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
    
    def detect_ui_elements(self, image_path, confidence_threshold=0.5):
        """
        Detecta elementos UI en la imagen
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
                        
                        # Añadir propiedades específicas del elemento
                        detection = self.add_element_properties(detection)
                        detections.append(detection)
            
            return detections
            
        except Exception as e:
            print(f"Error en detección: {e}")
            return []
    
    def add_element_properties(self, detection):
        """
        Añade propiedades específicas según el tipo de elemento detectado
        """
        tipo = detection['tipo']
        
        if tipo == 'Button':
            detection['label'] = 'Button'
        elif tipo == 'Input':
            detection['value'] = ''
            detection['placeholder'] = 'Enter text...'
        elif tipo == 'Title':
            detection['text'] = 'Title'
        elif tipo == 'Card':
            detection['title'] = 'Card Title'
            detection['content'] = 'Card content'
        elif tipo == 'AppBar':
            detection['title'] = 'App Bar'
        elif tipo == 'TabBar':
            detection['tabs'] = ['Tab 1', 'Tab 2', 'Tab 3']
            detection['selectedTab'] = 0
        elif tipo == 'Search':
            detection['placeholder'] = 'Search...'
        elif tipo == 'NavigationRail':
            detection['items'] = ['Item 1', 'Item 2', 'Item 3']
            detection['selectedIndex'] = 0
        elif tipo == 'DataTable':
            detection['columns'] = ['Col 1', 'Col 2']
            detection['rows'] = [['', '']]
        elif tipo == 'FAB':
            detection['icon'] = 'add'
        
        return detection
    
    def train_model(self, dataset_path, epochs=100):
        """
        Entrena el modelo con un dataset personalizado
        """
        try:
            # Configurar entrenamiento
            self.model.train(
                data=dataset_path,
                epochs=epochs,
                imgsz=640,
                batch=16,
                name='ui_detector',
                device='cpu'  # Cambiar a 'cuda' si tienes GPU
            )
            
            print("Entrenamiento completado")
            return True
            
        except Exception as e:
            print(f"Error en entrenamiento: {e}")
            return False

def main():
    if len(sys.argv) < 2:
        return
    
    image_path = sys.argv[1]
    
    # Inicializar detector
    detector = UIDetector(model_path="best.pt")
    
    # Detectar elementos
    detections = detector.detect_ui_elements(image_path)
    
    # Mostrar resultados
    print(json.dumps(detections, indent=2))

if __name__ == "__main__":
    main() 