#!/usr/bin/env python3
"""
Generador de dataset sintético para entrenar detector UML
Genera imágenes de diagramas de clases con anotaciones YOLO
"""

import os
import random
import json
import math
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import cv2

class UMLDatasetGenerator:
    def __init__(self):
        """
        Inicializa el generador de dataset UML
        """
        self.classes = {
            'Class': 0,
            'Association': 1, 
            'Dependency': 2,
            'Aggregation': 3,
            'Composition': 4,
            'Generalization': 5,
            'RecursiveRelation': 6,
            'ManyToManyRelation': 7,
            'Attribute': 8,
            'Method': 9
        }
        
        # Configuración de colores
        self.colors = {
            'Class': (255, 255, 255),      # Blanco
            'Association': (0, 0, 0),      # Negro
            'Dependency': (128, 128, 128),  # Gris
            'Aggregation': (0, 0, 255),     # Azul
            'Composition': (255, 0, 0),     # Rojo
            'Generalization': (0, 255, 0),  # Verde
            'RecursiveRelation': (255, 165, 0),  # Naranja
            'ManyToManyRelation': (128, 0, 128)  # Púrpura
        }
        
        # Nombres de clases comunes
        self.class_names = [
            'Usuario', 'Producto', 'Pedido', 'Factura', 'Cliente', 'Empleado',
            'Departamento', 'Proyecto', 'Tarea', 'Archivo', 'Documento',
            'Libro', 'Autor', 'Editorial', 'Biblioteca', 'Prestamo',
            'Cuenta', 'Transaccion', 'Banco', 'Tarjeta', 'Movimiento'
        ]
        
        self.attribute_types = ['String', 'Integer', 'Boolean', 'Date', 'Double', 'Float']
        self.method_types = ['void', 'String', 'Integer', 'Boolean', 'List', 'Object']
    
    def generate_class_box(self, draw, x, y, width, height, class_name, attributes, methods):
        """
        Dibuja una caja de clase UML
        """
        # Dibujar rectángulo principal
        draw.rectangle([x, y, x + width, y + height], outline=(0, 0, 0), width=2)
        
        # Dibujar línea separadora para nombre
        name_height = 30
        draw.line([x, y + name_height, x + width, y + name_height], fill=(0, 0, 0), width=1)
        
        # Dibujar línea separadora para atributos
        attr_height = 30 + len(attributes) * 20
        draw.line([x, y + attr_height, x + width, y + attr_height], fill=(0, 0, 0), width=1)
        
        # Escribir nombre de la clase
        try:
            font = ImageFont.truetype("arial.ttf", 14)
        except:
            font = ImageFont.load_default()
        
        # Centrar texto
        text_bbox = draw.textbbox((0, 0), class_name, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_x = x + (width - text_width) // 2
        draw.text((text_x, y + 8), class_name, fill=(0, 0, 0), font=font)
        
        # Escribir atributos
        for i, attr in enumerate(attributes):
            draw.text((x + 5, y + 35 + i * 20), attr, fill=(0, 0, 0), font=font)
        
        # Escribir métodos
        for i, method in enumerate(methods):
            draw.text((x + 5, y + attr_height + 5 + i * 20), method, fill=(0, 0, 0), font=font)
    
    def generate_arrow(self, draw, x1, y1, x2, y2, relation_type):
        """
        Dibuja una flecha para relaciones UML
        """
        # Dibujar línea principal
        draw.line([x1, y1, x2, y2], fill=self.colors[relation_type], width=2)
        
        # Calcular ángulo de la flecha
        angle = math.atan2(y2 - y1, x2 - x1)
        
        # Dibujar punta de flecha según el tipo
        arrow_length = 15
        
        if relation_type == 'Association':
            # Flecha simple
            arrow_x1 = x2 - arrow_length * math.cos(angle - 0.3)
            arrow_y1 = y2 - arrow_length * math.sin(angle - 0.3)
            arrow_x2 = x2 - arrow_length * math.cos(angle + 0.3)
            arrow_y2 = y2 - arrow_length * math.sin(angle + 0.3)
            draw.line([x2, y2, arrow_x1, arrow_y1], fill=(0, 0, 0), width=2)
            draw.line([x2, y2, arrow_x2, arrow_y2], fill=(0, 0, 0), width=2)
            
        elif relation_type == 'Generalization':
            # Flecha hueca (triángulo)
            arrow_x1 = x2 - arrow_length * math.cos(angle - 0.3)
            arrow_y1 = y2 - arrow_length * math.sin(angle - 0.3)
            arrow_x2 = x2 - arrow_length * math.cos(angle + 0.3)
            arrow_y2 = y2 - arrow_length * math.sin(angle + 0.3)
            draw.polygon([(x2, y2), (arrow_x1, arrow_y1), (arrow_x2, arrow_y2)], 
                        outline=(0, 255, 0), fill=None, width=2)
            
        elif relation_type == 'Aggregation':
            # Rombo hueco
            diamond_size = 10
            diamond_x = x1 + diamond_size * math.cos(angle)
            diamond_y = y1 + diamond_size * math.sin(angle)
            draw.polygon([
                (diamond_x, diamond_y - diamond_size),
                (diamond_x + diamond_size, diamond_y),
                (diamond_x, diamond_y + diamond_size),
                (diamond_x - diamond_size, diamond_y)
            ], outline=(0, 0, 255), fill=None, width=2)
    
    def generate_uml_diagram(self, width=800, height=600):
        """
        Genera un diagrama UML sintético
        """
        # Crear imagen en blanco
        image = Image.new('RGB', (width, height), (255, 255, 255))
        draw = ImageDraw.Draw(image)
        
        # Generar clases aleatorias
        num_classes = random.randint(2, 5)
        classes = []
        
        for i in range(num_classes):
            class_name = random.choice(self.class_names)
            attributes = [f"+ {random.choice(['nombre', 'id', 'fecha', 'estado'])}: {random.choice(self.attribute_types)}" 
                         for _ in range(random.randint(1, 3))]
            methods = [f"+ {random.choice(['get', 'set', 'calcular', 'validar'])}({random.choice(self.attribute_types).lower()}): {random.choice(self.method_types)}" 
                      for _ in range(random.randint(1, 3))]
            
            # Posición aleatoria
            x = random.randint(50, width - 200)
            y = random.randint(50, height - 200)
            w = 150
            h = 30 + len(attributes) * 20 + len(methods) * 20 + 10
            
            classes.append({
                'name': class_name,
                'x': x, 'y': y, 'w': w, 'h': h,
                'attributes': attributes,
                'methods': methods
            })
            
            # Dibujar clase
            self.generate_class_box(draw, x, y, w, h, class_name, attributes, methods)
        
        # Generar relaciones aleatorias
        relations = []
        num_relations = random.randint(1, min(3, num_classes))
        
        for _ in range(num_relations):
            if len(classes) < 2:
                break
                
            class1 = random.choice(classes)
            class2 = random.choice([c for c in classes if c != class1])
            
            relation_type = random.choice(['Association', 'Dependency', 'Aggregation', 'Generalization'])
            
            # Calcular puntos de conexión
            x1 = class1['x'] + class1['w'] // 2
            y1 = class1['y'] + class1['h'] // 2
            x2 = class2['x'] + class2['w'] // 2
            y2 = class2['y'] + class2['h'] // 2
            
            # Dibujar relación
            self.generate_arrow(draw, x1, y1, x2, y2, relation_type)
            
            relations.append({
                'type': relation_type,
                'from': class1['name'],
                'to': class2['name'],
                'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2
            })
        
        return image, classes, relations
    
    def create_yolo_annotations(self, classes, relations, image_width, image_height):
        """
        Crea anotaciones en formato YOLO
        """
        annotations = []
        
        # Anotar clases
        for cls in classes:
            # Convertir a formato YOLO (normalizado)
            x_center = (cls['x'] + cls['w'] / 2) / image_width
            y_center = (cls['y'] + cls['h'] / 2) / image_height
            width = cls['w'] / image_width
            height = cls['h'] / image_height
            
            annotations.append({
                'class_id': self.classes['Class'],
                'x_center': x_center,
                'y_center': y_center,
                'width': width,
                'height': height
            })
        
        # Anotar relaciones
        for rel in relations:
            # Para relaciones, usar bounding box que cubra la línea
            x1, y1, x2, y2 = rel['x1'], rel['y1'], rel['x2'], rel['y2']
            
            # Crear bounding box alrededor de la línea
            min_x = min(x1, x2) - 10
            max_x = max(x1, x2) + 10
            min_y = min(y1, y2) - 10
            max_y = max(y1, y2) + 10
            
            x_center = (min_x + max_x) / 2 / image_width
            y_center = (min_y + max_y) / 2 / image_height
            width = (max_x - min_x) / image_width
            height = (max_y - min_y) / image_height
            
            annotations.append({
                'class_id': self.classes[rel['type']],
                'x_center': x_center,
                'y_center': y_center,
                'width': width,
                'height': height
            })
        
        return annotations
    
    def generate_dataset(self, num_train=500, num_val=100, num_test=50):
        """
        Genera dataset completo de diagramas UML
        """
        print("🎨 Generando dataset UML sintético...")
        
        # Crear directorios
        os.makedirs('uml_dataset/images/train', exist_ok=True)
        os.makedirs('uml_dataset/images/val', exist_ok=True)
        os.makedirs('uml_dataset/images/test', exist_ok=True)
        os.makedirs('uml_dataset/labels/train', exist_ok=True)
        os.makedirs('uml_dataset/labels/val', exist_ok=True)
        os.makedirs('uml_dataset/labels/test', exist_ok=True)
        
        # Generar imágenes de entrenamiento
        print(f"📚 Generando {num_train} imágenes de entrenamiento...")
        for i in range(num_train):
            image, classes, relations = self.generate_uml_diagram()
            annotations = self.create_yolo_annotations(classes, relations, image.width, image.height)
            
            # Guardar imagen
            image_path = f'uml_dataset/images/train/uml_train_{i:04d}.jpg'
            image.save(image_path)
            
            # Guardar anotaciones
            label_path = f'uml_dataset/labels/train/uml_train_{i:04d}.txt'
            with open(label_path, 'w') as f:
                for ann in annotations:
                    f.write(f"{ann['class_id']} {ann['x_center']:.6f} {ann['y_center']:.6f} {ann['width']:.6f} {ann['height']:.6f}\n")
        
        # Generar imágenes de validación
        print(f"🔍 Generando {num_val} imágenes de validación...")
        for i in range(num_val):
            image, classes, relations = self.generate_uml_diagram()
            annotations = self.create_yolo_annotations(classes, relations, image.width, image.height)
            
            image_path = f'uml_dataset/images/val/uml_val_{i:04d}.jpg'
            image.save(image_path)
            
            label_path = f'uml_dataset/labels/val/uml_val_{i:04d}.txt'
            with open(label_path, 'w') as f:
                for ann in annotations:
                    f.write(f"{ann['class_id']} {ann['x_center']:.6f} {ann['y_center']:.6f} {ann['width']:.6f} {ann['height']:.6f}\n")
        
        # Generar imágenes de prueba
        print(f"🧪 Generando {num_test} imágenes de prueba...")
        for i in range(num_test):
            image, classes, relations = self.generate_uml_diagram()
            annotations = self.create_yolo_annotations(classes, relations, image.width, image.height)
            
            image_path = f'uml_dataset/images/test/uml_test_{i:04d}.jpg'
            image.save(image_path)
            
            label_path = f'uml_dataset/labels/test/uml_test_{i:04d}.txt'
            with open(label_path, 'w') as f:
                for ann in annotations:
                    f.write(f"{ann['class_id']} {ann['x_center']:.6f} {ann['y_center']:.6f} {ann['width']:.6f} {ann['height']:.6f}\n")
        
        print("✅ Dataset UML generado exitosamente!")
        print(f"📁 Ubicación: uml_dataset/")
        print(f"📊 Total imágenes: {num_train + num_val + num_test}")

def main():
    generator = UMLDatasetGenerator()
    generator.generate_dataset(num_train=500, num_val=100, num_test=50)

if __name__ == "__main__":
    main()
