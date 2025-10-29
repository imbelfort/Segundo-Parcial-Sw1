# 🤖 Detector UML para Diagramas de Clases

Sistema de detección automática de elementos UML en diagramas de clases usando inteligencia artificial (YOLO).

## 🎯 Elementos que puede detectar

- **Clases** con atributos y métodos
- **Asociaciones** (relaciones simples)
- **Dependencias** (relaciones de dependencia)
- **Agregaciones** (relaciones todo-parte)
- **Composiciones** (relaciones de composición)
- **Generalizaciones** (herencia)
- **Relaciones recursivas** (auto-referencias)
- **Relaciones muchos a muchos**

## 🚀 Instalación y Configuración

### 1. Instalar dependencias
```bash
python setup_uml_detector.py
```

### 2. Generar dataset de entrenamiento
```bash
python train_uml_model.py --generate-data
```

### 3. Entrenar el modelo
```bash
python train_uml_model.py --train --epochs 100
```

### 4. Probar detección
```bash
python uml_detector.py imagen_diagrama.jpg
```

## 📁 Archivos del sistema

- `uml_detector.py` - Detector principal de elementos UML
- `uml_dataset_generator.py` - Generador de datos sintéticos
- `train_uml_model.py` - Script de entrenamiento
- `uml_dataset_config.yaml` - Configuración del dataset
- `setup_uml_detector.py` - Instalador automático

## 🔧 Uso del detector

### Detección básica
```python
from uml_detector import UMLDetector

detector = UMLDetector(model_path="best_uml.pt")
detections = detector.detect_uml_elements("diagrama.jpg")

for detection in detections:
    print(f"Tipo: {detection['tipo']}")
    print(f"Posición: ({detection['x']}, {detection['y']})")
    print(f"Tamaño: {detection['w']} x {detection['h']}")
```

### Formato de salida JSON
```json
[
  {
    "tipo": "Class",
    "x": 100,
    "y": 50,
    "w": 150,
    "h": 120,
    "confidence": 0.95,
    "name": "Usuario",
    "attributes": ["+ nombre: String", "+ edad: Integer"],
    "methods": ["+ getNombre(): String", "+ setEdad(int): void"]
  },
  {
    "tipo": "Association",
    "x": 200,
    "y": 100,
    "w": 50,
    "h": 20,
    "confidence": 0.87,
    "from": "Usuario",
    "to": "Pedido",
    "multOrigen": "1",
    "multDestino": "*",
    "label": "realiza"
  }
]
```

## 🎨 Generación de datos sintéticos

El sistema genera automáticamente diagramas UML sintéticos para entrenar el modelo:

- **Clases aleatorias** con nombres, atributos y métodos
- **Relaciones variadas** entre clases
- **Posicionamiento aleatorio** de elementos
- **Anotaciones YOLO** automáticas

## 📊 Entrenamiento del modelo

### Parámetros configurables
- **Épocas**: Número de iteraciones de entrenamiento
- **Batch size**: Tamaño del lote de entrenamiento
- **Tamaño de imagen**: Resolución de entrada (640x640)
- **Augmentación**: Transformaciones de datos

### Proceso de entrenamiento
1. **Generación de datos** sintéticos
2. **División** en train/val/test
3. **Entrenamiento** con YOLO
4. **Evaluación** del modelo
5. **Guardado** del modelo entrenado

## 🔍 Evaluación y pruebas

### Evaluar modelo entrenado
```bash
python train_uml_model.py --evaluate
```

### Probar en imagen específica
```bash
python train_uml_model.py --test imagen.jpg
```

### Métricas de evaluación
- **Precisión** por clase
- **Recall** por clase
- **F1-score** por clase
- **mAP** (mean Average Precision)

## 🎯 Integración con la pizarra

El detector está diseñado para integrarse perfectamente con tu sistema de pizarra:

1. **Usuario sube imagen** de diagrama UML
2. **Servidor ejecuta** `uml_detector.py`
3. **Se detectan elementos** automáticamente
4. **Se renderizan** en la pizarra
5. **Usuario puede editar** elementos detectados

## 🛠️ Personalización

### Añadir nuevos tipos de elementos
1. Modificar `classes` en `uml_detector.py`
2. Actualizar `uml_dataset_config.yaml`
3. Regenerar dataset de entrenamiento
4. Reentrenar modelo

### Ajustar parámetros de detección
- **Confianza mínima**: `confidence_threshold`
- **Tamaño de imagen**: `max_size`
- **Preprocesamiento**: `preprocess_image()`

## 📈 Rendimiento

### Requisitos del sistema
- **CPU**: Mínimo 4 cores
- **RAM**: 8GB recomendado
- **GPU**: Opcional (CUDA)
- **Espacio**: 2GB para dataset

### Tiempos de procesamiento
- **Detección**: ~1-2 segundos por imagen
- **Entrenamiento**: ~2-4 horas (100 épocas)
- **Generación de datos**: ~10-15 minutos

## 🐛 Solución de problemas

### Error: "No se pudo cargar la imagen"
- Verificar formato de imagen (JPG, PNG)
- Comprobar permisos de archivo
- Verificar ruta del archivo

### Error: "Modelo no encontrado"
- Ejecutar entrenamiento primero
- Verificar ruta del modelo
- Copiar `best.pt` a `best_uml.pt`

### Detecciones incorrectas
- Aumentar épocas de entrenamiento
- Mejorar calidad del dataset
- Ajustar umbral de confianza

## 📞 Soporte

Para problemas o preguntas:
1. Revisar logs de entrenamiento
2. Verificar configuración YAML
3. Probar con imágenes de ejemplo
4. Consultar documentación YOLO

---

**¡Disfruta detectando elementos UML automáticamente! 🎉**
