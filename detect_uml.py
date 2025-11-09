# detect_uml.py
import os
import base64
import requests
import argparse
from dotenv import load_dotenv
import json
import sys

# Configurar la codificación de salida para Windows
if sys.platform == "win32":
    import io
    import sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='ignore')

# Cargar variables de entorno
load_dotenv()

# Configuración de Groq
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
if not GROQ_API_KEY:
    print("ERROR: No se encontró GROQ_API_KEY en las variables de entorno", file=sys.stderr)
    sys.exit(1)

def encode_image_to_base64(image_path):
    """Codifica una imagen a base64."""
    try:
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        print(f"ERROR al leer la imagen: {str(e)}", file=sys.stderr)
        sys.exit(1)

def analyze_uml_with_groq(image_path):
    """Analiza una imagen de diagrama UML usando la API de Groq y devuelve los elementos en formato para el frontend."""
    print(f"Analizando imagen: {image_path}", file=sys.stderr)
    
    # Codificar la imagen
    try:
        base64_image = encode_image_to_base64(image_path)
        file_ext = os.path.splitext(image_path)[1].lower()
        mime_type = "image/jpeg"
        if file_ext == '.png':
            mime_type = "image/png"
        elif file_ext == '.gif':
            mime_type = "image/gif"
        elif file_ext == '.webp':
            mime_type = "image/webp"
    except Exception as e:
        print(f"ERROR al procesar la imagen: {str(e)}", file=sys.stderr)
        sys.exit(1)

    # Configurar la solicitud
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    # Crear el prompt para Groq
    prompt = """
    Analiza el diagrama UML en la imagen proporcionada y devuelve un JSON con los siguientes campos:
    - elements: lista de elementos (clases, interfaces, etc.)
    - relationships: lista de relaciones entre elementos (asociaciones, herencias, etc.)
    
    Para cada elemento, incluye:
    - type: tipo de elemento (ej: "Class", "Interface")
    - name: nombre del elemento
    - attributes: lista de atributos (solo el nombre, sin visibilidad ni tipo)
    - methods: lista de métodos (solo el nombre, sin parámetros ni tipo de retorno)
    - x, y: posición en el diagrama (usa valores razonables si no se pueden determinar)
    - width: ancho fijo de 150
    - height: altura calculada basada en la cantidad de atributos y métodos
    
    Para cada relación, incluye:
    - type: tipo de relación ("Asociacion", "Composicion", "Agregacion", "Generalizacion")
    - desde: nombre del elemento origen
    - hacia: nombre del elemento destino
    - etiqueta: etiqueta opcional (vacía si no aplica)
    
    Los nombres de los elementos deben ser únicos. 
    Devuelve SOLO el JSON, sin texto adicional, sin marcas de código (```json o ```).
    """

    # Crear el payload para Groq
    payload = {
        "model": "meta-llama/llama-4-scout-17b-16e-instruct",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        "temperature": 0.3,
        "max_tokens": 4096,
        "response_format": {"type": "json_object"}
    }

    try:
        print("Enviando solicitud a Groq API...", file=sys.stderr)
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=120  # Aumentar tiempo de espera
        )
        response.raise_for_status()
        
        # Extraer el contenido de la respuesta
        content = response.json()['choices'][0]['message']['content']
        print("Respuesta recibida de Groq API", file=sys.stderr)
        
        # Limpiar la respuesta (eliminar markdown si existe)
        content = content.strip()
        if content.startswith('```json'):
            content = content[7:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()
        
        # Intentar cargar el JSON
        try:
            result = json.loads(content)
            
            # Transformar el resultado al formato esperado por el frontend
            transformed = transform_to_frontend_format(result)
            return transformed
            
        except json.JSONDecodeError as e:
            print(f"ERROR al decodificar JSON: {str(e)}", file=sys.stderr)
            print(f"Respuesta recibida: {content}", file=sys.stderr)
            sys.exit(1)
            
    except requests.exceptions.RequestException as e:
        error_msg = f"Error en la solicitud a Groq API: {str(e)}"
        if hasattr(e, 'response') and e.response is not None:
            error_msg += f"\nCódigo de estado: {e.response.status_code}"
            error_msg += f"\nRespuesta: {e.response.text}"
        print(error_msg, file=sys.stderr)
        sys.exit(1)

def transform_to_frontend_format(data):
    """Transforma el JSON de Groq al formato esperado por el frontend."""
    from datetime import datetime
    import uuid
    
    # Inicializar estructuras de datos
    elementos = []
    relaciones = []
    
    # Mapeo de tipos de relación
    relacion_map = {
        'Association': 'Asociacion',
        'Inheritance': 'Generalizacion',
        'Composition': 'Composicion',
        'Aggregation': 'Agregacion',
        'Asociacion': 'Asociacion',
        'Generalizacion': 'Generalizacion',
        'Composicion': 'Composicion',
        'Agregacion': 'Agregacion'
    }
    
    # Procesar elementos
    if 'elements' in data:
        for element in data['elements']:
            # Generar ID único
            element_id = str(uuid.uuid4())
            
            # Calcular altura basada en atributos y métodos
            attr_count = len(element.get('attributes', []))
            methods_count = len(element.get('methods', []))
            height = max(100, 30 + (attr_count + methods_count) * 20)
            
            # Crear elemento en formato del frontend
            elemento = {
                'id': element_id,
                'tipo': element.get('type', 'Class'),
                'nombre': element.get('name', 'SinNombre'),
                'atributos': element.get('attributes', []),
                'metodos': element.get('methods', []),
                'x': element.get('x', 100 + len(elementos) * 200),
                'y': element.get('y', 100),
                'width': 150,  # Ancho fijo
                'height': height,
                'seleccionado': False,
                'arrastrando': False,
                'ultimoX': 0,
                'ultimoY': 0
            }
            
            # Asegurar que los atributos y métodos sean listas de strings
            if not isinstance(elemento['atributos'], list):
                elemento['atributos'] = []
            if not isinstance(elemento['metodos'], list):
                elemento['metodos'] = []
                
            elementos.append(elemento)
    
    # Procesar relaciones
    if 'relationships' in data:
        for rel in data['relationships']:
            # Mapear tipo de relación
            rel_type = rel.get('type', 'Asociacion')
            rel_type = relacion_map.get(rel_type, 'Asociacion')
            
            # Obtener nombres de elementos de origen y destino
            from_name = rel.get('desde', '')
            to_name = rel.get('hacia', '')
            
            # Buscar los elementos correspondientes
            from_elem = next((e for e in elementos if e['nombre'] == from_name), None)
            to_elem = next((e for e in elementos if e['nombre'] == to_name), None)
            
            if from_elem and to_elem:
                relacion = {
                    'id': str(uuid.uuid4()),
                    'tipo': rel_type,
                    'desde': from_elem['id'],
                    'hacia': to_elem['id'],
                    'etiqueta': rel.get('label', '')
                }
                relaciones.append(relacion)
    
    return {
        'elementos': elementos,
        'relaciones': relaciones
    }

def main():
    # Configurar el parser de argumentos
    parser = argparse.ArgumentParser(description='Analiza un diagrama UML usando Groq')
    parser.add_argument('--image', type=str, required=True, help='Ruta a la imagen del diagrama UML')
    args = parser.parse_args()

    # Verificar que el archivo existe
    if not os.path.exists(args.image):
        print(f"ERROR: El archivo {args.image} no existe", file=sys.stderr)
        sys.exit(1)

    # Analizar la imagen
    result = analyze_uml_with_groq(args.image)
    
    # Imprimir el resultado en formato JSON
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()