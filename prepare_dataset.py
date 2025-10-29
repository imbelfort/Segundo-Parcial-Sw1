import os
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import random
import yaml

class UIDatasetGenerator:
    def __init__(self, output_dir='ui_dataset'):
        self.output_dir = output_dir
        self.classes = {
            'Button': 0,
            'Input': 1, 
            'Title': 2,
            'Card': 3,
            'Search': 4,
            'AppBar': 5,
            'TabBar': 6,
            'Checkbox': 7,
            'NavigationRail': 8,
            'DataTable': 9,
            'FAB': 10,
            'Image': 11,
            'Text': 12
        }
        
        # Crear estructura de directorios
        self.setup_directories()
        
    def setup_directories(self):
        """Crear estructura de directorios para el dataset"""
        dirs = [
            f'{self.output_dir}/images/train',
            f'{self.output_dir}/images/val',
            f'{self.output_dir}/images/test',
            f'{self.output_dir}/labels/train',
            f'{self.output_dir}/labels/val',
            f'{self.output_dir}/labels/test'
        ]
        
        for dir_path in dirs:
            os.makedirs(dir_path, exist_ok=True)
    
    def generate_button(self, draw, x, y, width, height):
        """Generar un botón en la imagen"""
        # Dibujar rectángulo con bordes redondeados
        draw.rounded_rectangle([x, y, x + width, y + height], 
                             radius=10, fill='#6200EE', outline='#3700B3', width=2)
        
        # Texto del botón
        try:
            font = ImageFont.load_default()
            text = random.choice(['Button', 'Enviar', 'Cancelar', 'OK', 'Siguiente'])
            text_bbox = draw.textbbox((0, 0), text, font=font)
            text_w = text_bbox[2] - text_bbox[0]
            text_h = text_bbox[3] - text_bbox[1]
            text_x = x + (width - text_w) // 2
            text_y = y + (height - text_h) // 2
            draw.text((text_x, text_y), text, fill='white', font=font)
        except:
            pass
        
        return {
            'class': self.classes['Button'],
            'x_center': (x + width/2) / 640,
            'y_center': (y + height/2) / 640,
            'width': width / 640,
            'height': height / 640
        }
    
    def generate_input(self, draw, x, y, width, height):
        """Generar un campo de input"""
        # Campo de entrada
        draw.rectangle([x, y, x + width, y + height], 
                      fill='white', outline='gray', width=1)
        
        # Placeholder text
        try:
            font = ImageFont.load_default()
            placeholder = random.choice(['Enter text...', 'Email', 'Nombre', 'Contraseña'])
            draw.text((x + 10, y + height//2 - 5), placeholder, fill='gray', font=font)
        except:
            pass
        
        return {
            'class': self.classes['Input'],
            'x_center': (x + width/2) / 640,
            'y_center': (y + height/2) / 640,
            'width': width / 640,
            'height': height / 640
        }
    
    def generate_title(self, draw, x, y, width, height):
        """Generar un título"""
        try:
            font = ImageFont.load_default()
            title = random.choice(['Título Principal', 'Mi App', 'Dashboard', 'Configuración'])
            draw.text((x, y), title, fill='black', font=font)
        except:
            pass
        
        return {
            'class': self.classes['Title'],
            'x_center': (x + width/2) / 640,
            'y_center': (y + height/2) / 640,
            'width': width / 640,
            'height': height / 640
        }
    
    def generate_card(self, draw, x, y, width, height):
        """Generar una tarjeta"""
        # Fondo de la tarjeta
        draw.rounded_rectangle([x, y, x + width, y + height], 
                             radius=8, fill='white', outline='#ddd', width=1)
        
        # Título de la tarjeta
        try:
            font = ImageFont.load_default()
            title = random.choice(['Card Title', 'Producto', 'Artículo', 'Elemento'])
            draw.text((x + 10, y + 10), title, fill='black', font=font)
            
            # Contenido
            content = random.choice(['Descripción del contenido', 'Texto de ejemplo', 'Contenido aquí'])
            draw.text((x + 10, y + 30), content, fill='gray', font=font)
        except:
            pass
        
        return {
            'class': self.classes['Card'],
            'x_center': (x + width/2) / 640,
            'y_center': (y + height/2) / 640,
            'width': width / 640,
            'height': height / 640
        }
    
    def generate_checkbox(self, draw, x, y, width, height):
        """Generar un checkbox"""
        # Cuadro del checkbox
        check_size = min(width, height, 20)
        draw.rectangle([x, y, x + check_size, y + check_size], 
                      fill='white', outline='gray', width=2)
        
        # Marca (a veces)
        if random.choice([True, False]):
            draw.line([x + 3, y + check_size//2, x + check_size//2, y + check_size - 3], 
                     fill='#6200EE', width=2)
            draw.line([x + check_size//2, y + check_size - 3, x + check_size - 3, y + 3], 
                     fill='#6200EE', width=2)
        
        # Etiqueta
        try:
            font = ImageFont.load_default()
            label = random.choice(['Acepto términos', 'Recordarme', 'Suscribirse', 'Opción'])
            draw.text((x + check_size + 10, y), label, fill='black', font=font)
        except:
            pass
        
        return {
            'class': self.classes['Checkbox'],
            'x_center': (x + width/2) / 640,
            'y_center': (y + height/2) / 640,
            'width': width / 640,
            'height': height / 640
        }
    
    def generate_synthetic_image(self, num_elements=None):
        """Generar una imagen sintética con elementos UI"""
        # Crear imagen base
        img = Image.new('RGB', (640, 640), color='white')
        draw = ImageDraw.Draw(img)
        
        # Lista para almacenar anotaciones
        annotations = []
        
        # Número aleatorio de elementos si no se especifica
        if num_elements is None:
            num_elements = random.randint(3, 8)
        
        for _ in range(num_elements):
            # Seleccionar tipo de elemento aleatoriamente
            element_type = random.choice(list(self.classes.keys()))
            
            # Generar posición y tamaño aleatorios
            x = random.randint(10, 500)
            y = random.randint(10, 500)
            
            if element_type == 'Button':
                width = random.randint(80, 150)
                height = random.randint(30, 50)
                annotation = self.generate_button(draw, x, y, width, height)
            elif element_type == 'Input':
                width = random.randint(120, 200)
                height = random.randint(30, 40)
                annotation = self.generate_input(draw, x, y, width, height)
            elif element_type == 'Title':
                width = random.randint(100, 200)
                height = random.randint(20, 30)
                annotation = self.generate_title(draw, x, y, width, height)
            elif element_type == 'Card':
                width = random.randint(150, 250)
                height = random.randint(100, 150)
                annotation = self.generate_card(draw, x, y, width, height)
            elif element_type == 'Checkbox':
                width = random.randint(80, 120)
                height = random.randint(20, 25)
                annotation = self.generate_checkbox(draw, x, y, width, height)
            else:
                # Para otros elementos, generar rectángulo básico
                width = random.randint(60, 150)
                height = random.randint(30, 80)
                draw.rectangle([x, y, x + width, y + height], 
                             outline='blue', width=2)
                annotation = {
                    'class': self.classes.get(element_type, 0),
                    'x_center': (x + width/2) / 640,
                    'y_center': (y + height/2) / 640,
                    'width': width / 640,
                    'height': height / 640
                }
            
            annotations.append(annotation)
        
        return img, annotations
    
    def save_yolo_annotation(self, annotations, filename, split='train'):
        """Guardar anotaciones en formato YOLO"""
        label_path = f'{self.output_dir}/labels/{split}/{filename}.txt'
        with open(label_path, 'w') as f:
            for ann in annotations:
                line = f"{ann['class']} {ann['x_center']:.6f} {ann['y_center']:.6f} {ann['width']:.6f} {ann['height']:.6f}\n"
                f.write(line)
    
    def generate_dataset(self, num_train=500, num_val=100, num_test=50):
        """Generar dataset completo"""
        print(f"Generando dataset con {num_train} imágenes de entrenamiento, {num_val} de validación y {num_test} de prueba...")
        
        # Generar datos de entrenamiento
        for i in range(num_train):
            img, annotations = self.generate_synthetic_image()
            img_filename = f'train_{i:04d}'
            
            # Guardar imagen
            img.save(f'{self.output_dir}/images/train/{img_filename}.jpg')
            
            # Guardar anotaciones
            self.save_yolo_annotation(annotations, img_filename, 'train')
            
            if i % 100 == 0:
                print(f"Generadas {i} imágenes de entrenamiento...")
        
        # Generar datos de validación
        for i in range(num_val):
            img, annotations = self.generate_synthetic_image()
            img_filename = f'val_{i:04d}'
            
            img.save(f'{self.output_dir}/images/val/{img_filename}.jpg')
            self.save_yolo_annotation(annotations, img_filename, 'val')
        
        # Generar datos de prueba
        for i in range(num_test):
            img, annotations = self.generate_synthetic_image()
            img_filename = f'test_{i:04d}'
            
            img.save(f'{self.output_dir}/images/test/{img_filename}.jpg')
            self.save_yolo_annotation(annotations, img_filename, 'test')
        
        print("Dataset generado exitosamente!")
        print(f"Ubicación: {self.output_dir}")

def main():
    """Función principal"""
    generator = UIDatasetGenerator()
    
    # Generar dataset sintético
    generator.generate_dataset(num_train=200, num_val=50, num_test=20)
    
    print("\n¡Dataset sintético generado!")
    print("Para entrenar el modelo, ejecuta:")
    print("python ui_detector.py --train ui_dataset_config.yaml")

if __name__ == "__main__":
    main() 