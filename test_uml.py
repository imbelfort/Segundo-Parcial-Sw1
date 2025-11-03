import cv2
import numpy as np

def create_uml_diagram():
    # Crear una imagen en blanco
    img = np.ones((500, 800, 3), dtype=np.uint8) * 255
    
    # Dibujar una clase
    cv2.rectangle(img, (100, 100), (300, 300), (0, 0, 255), 2)
    cv2.putText(img, 'Persona', (150, 140), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    cv2.line(img, (100, 170), (300, 170), (0, 0, 0), 1)
    cv2.putText(img, '+ nombre: String', (110, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
    cv2.putText(img, '+ edad: int', (110, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
    cv2.line(img, (100, 250), (300, 250), (0, 0, 0), 1)
    cv2.putText(img, '+ saludar(): void', (110, 280), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
    
    # Dibujar otra clase
    cv2.rectangle(img, (500, 100), (700, 300), (0, 0, 255), 2)
    cv2.putText(img, 'Estudiante', (550, 140), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    cv2.line(img, (500, 170), (700, 170), (0, 0, 0), 1)
    cv2.putText(img, '+ matricula: String', (510, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
    cv2.putText(img, '+ carrera: String', (510, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
    cv2.line(img, (500, 250), (700, 250), (0, 0, 0), 1)
    cv2.putText(img, '+ estudiar(): void', (510, 280), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
    
    # Dibujar una relación de herencia
    points = np.array([[400, 200], [450, 150], [500, 200]], np.int32)
    cv2.fillPoly(img, [points], (255, 255, 255))
    cv2.polylines(img, [points], True, (0, 0, 0), 2)
    
    # Guardar la imagen
    cv2.imwrite('diagrama_uml.png', img)
    print("Imagen de prueba creada: diagrama_uml.png")

if __name__ == "__main__":
    create_uml_diagram()
