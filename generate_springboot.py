# generate_springboot.py
import os
import sys
import json
import zipfile
import re
from jinja2 import Environment, FileSystemLoader

# --- INICIO DE LA CORRECCIÓN: Funciones de Casing Robustas ---

def to_pascal_case(s):
    """
    Convierte 'id_telefono' a 'IdTelefono'
    Convierte 'id_NIT' a 'IdNit'
    Convierte 'id_eliminar com defec' a 'IdEliminarComDefec'
    """
    s = s.replace('_', ' ').replace('-', ' ')
    parts = s.split()
    if not parts:
        return ""
    
    # Maneja casos especiales como 'id_NIT' -> 'idNit' -> 'IdNit'
    # o 'id_telefono' -> 'idTelefono' -> 'IdTelefono'
    
    # Primero a camelCase para manejar siglas como NIT
    camel_case = to_camel_case(s) 
    # Luego a PascalCase
    return camel_case[0].upper() + camel_case[1:]

def to_camel_case(s):
    """
    Convierte 'id_telefono' a 'idTelefono'
    Convierte 'id_NIT' a 'idNit'
    Convierte 'id_eliminar com defec' a 'idEliminarComDefec'
    """
    s = s.replace('_', ' ').replace('-', ' ')
    parts = s.split()
    if not parts:
        return ""

    # Toma la primera palabra (ej. 'id') y la pone en minúscula
    # Capitaliza el resto (ej. 'Eliminar', 'Com', 'Defec')
    # Maneja siglas (ej. 'NIT' se vuelve 'Nit')
    first_word = parts[0].lower()
    rest_words = "".join(word.capitalize() for word in parts[1:])
    
    return first_word + rest_words

def to_snake_case(s):
    """Convierte 'PascalCase' o 'camelCase' a 'snake_case'"""
    if not s:
        return ""
    s = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1_\2', s)
    s = re.sub(r'([a-z\d])([A-Z])', r'\1_\2', s)
    return s.replace('-', '_').replace(' ', '_').lower()
# --- FIN DE LA CORRECCIÓN ---


def get_java_type(uml_type):
    """Mapea tipos de UML a (TipoJava, ImportJava, TipoDart)"""
    uml_type = uml_type.lower().strip()
    if uml_type in ['int', 'integer']:
        return ('Integer', None, 'int')
    if uml_type in ['string', 'varchar', 'text']:
        return ('String', None, 'String')
    if uml_type in ['float', 'decimal', 'double']:
        return ('Double', None, 'double')
    if uml_type in ['boolean', 'bool']:
        return ('Boolean', None, 'bool')
    if uml_type in ['date', 'datetime', 'timestamp']:
        return ('LocalDate', 'java.time.LocalDate', 'String')
    if not uml_type:
        return ('String', None, 'String')
    java_type = to_pascal_case(uml_type)
    return (java_type, None, java_type) 

def parse_attribute(attr_str):
    """Parsea un string como '+ name: String' a un dict"""
    attr_str = re.sub(r'^[+\-#~]\s*', '', attr_str).strip()
    parts = attr_str.split(':')
    name_str = parts[0].strip().split('(')[0].strip() # ej: 'id_NIT' or 'id_eliminar com defec'
    
    # --- INICIO DE LA CORRECCIÓN: Lógica de consistencia ---
    
    # 1. Generar el nombre camelCase (ej: idNit or idEliminarComDefec)
    java_name = to_camel_case(name_str)
    
    # 2. Generar el nombre PascalCase (ej: IdNit or IdEliminarComDefec)
    pascal_name = to_pascal_case(name_str) # Usar la función corregida
    
    # --- FIN DE LA CORRECCIÓN ---
    
    # 3. Obtener los tipos
    if len(parts) > 1:
        type_str = parts[1].strip()
        java_type, import_needed, dart_type = get_java_type(type_str)
    else:
        java_type, import_needed, dart_type = 'String', None, 'String'
        
    return {
        'name': java_name,
        'pascal_name': pascal_name, # <-- Ahora es 100% consistente
        'type': java_type,
        'dart_type': dart_type,
        'import': import_needed
    }

def get_postman_body(entity):
    """Genera un cuerpo JSON de ejemplo para Postman"""
    body = {}
    for attr in entity.get('attributes', []):
        attr_type = attr.get('dart_type') 
        attr_name = attr.get('name')
        if attr_type == 'int':
            body[attr_name] = 123
        elif attr_type == 'double':
            body[attr_name] = 99.99
        elif attr_type == 'bool':
            body[attr_name] = True
        else:
            body[attr_name] = "Sample " + attr_name
    return json.dumps(body, indent=4)


def generate_project(diagram_json_str, output_zip_path, template_dir):
    try:
        data = json.loads(diagram_json_str)
        elements = data.get('elementos', [])
        
        env = Environment(loader=FileSystemLoader(template_dir))
        env.filters['capitalize'] = lambda x: x.capitalize()

        project_name = "GeneratedProject"
        if elements:
            project_name = to_pascal_case(elements[0].get('name', 'GeneratedProject'))
        
        base_package = "com.example." + to_camel_case(project_name)
        base_package_path = base_package.replace('.', '/')
        
        entities = []
        for el in elements:
            if el.get('tipo', 'Class') == 'Class':
                class_name = to_pascal_case(el.get('name', 'UnnamedClass'))
                attributes = [parse_attribute(attr) for attr in el.get('attributes', [])]
                imports = set()
                for attr in attributes:
                    if attr['import']:
                        imports.add(attr['import'])
                
                entities.append({
                    'name': class_name,
                    'camel_case_name': to_camel_case(class_name),
                    'table_name': el.get('name', 'unnamed_class').lower().replace(' ', '_'),
                    'attributes': attributes,
                    'imports': sorted(list(imports))
                })
        
        if not entities:
            raise Exception("No se encontraron clases en el diagrama.")
            
        postman_collection = {
            "info": {"name": f"{project_name} API", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
            "item": [], "variable": [{"key": "host", "value": "http://localhost:8080"}]
        }

        with zipfile.ZipFile(output_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.writestr('pom.xml', env.get_template('pom.xml.j2').render(project_name=to_camel_case(project_name)))
            zipf.writestr(f'src/main/resources/application.properties', env.get_template('application.properties.j2').render())
            zipf.writestr(f'src/main/java/{base_package_path}/{project_name}Application.java', env.get_template('MainApplication.java.j2').render(base_package=base_package, project_name=project_name))
            
            for entity in entities:
                class_name = entity["name"]
                camel_case_name = entity["camel_case_name"]
                api_path = f"api/{camel_case_name}" 

                zipf.writestr(f'src/main/java/{base_package_path}/model/{class_name}.java', env.get_template('Entity.java.j2').render(base_package=base_package, entity=entity))
                zipf.writestr(f'src/main/java/{base_package_path}/repository/{class_name}Repository.java', env.get_template('Repository.java.j2').render(base_package=base_package, entity=entity))
                zipf.writestr(f'src/main/java/{base_package_path}/controller/{class_name}Controller.java', env.get_template('Controller.java.j2').render(base_package=base_package, entity=entity, camel_case_name=camel_case_name))

                postman_collection["item"].append({"name": f"Get All {class_name}", "request": {"method": "GET", "header": [], "url": {"raw": f"{{{{host}}}}/{api_path}", "host": ["{{host}}"], "path": [api_path]}}})
                postman_collection["item"].append({"name": f"Create New {class_name}", "request": {"method": "POST", "header": [{"key": "Content-Type", "value": "application/json"}], "body": {"mode": "raw", "raw": get_postman_body(entity)}, "url": {"raw": f"{{{{host}}}}/{api_path}", "host": ["{{host}}"], "path": [api_path]}}})
                postman_collection["item"].append({"name": f"Get {class_name} By ID", "request": {"method": "GET", "header": [], "url": {"raw": f"{{{{host}}}}/{api_path}/1", "host": ["{{host}}"], "path": [api_path, "1"]}}})
        
        postman_path = output_zip_path.replace('.zip', '_postman.json')
        with open(postman_path, 'w', encoding='utf-8') as f:
            json.dump(postman_collection, f, indent=4)
        
        flutter_zip_path = output_zip_path.replace('spring_boot_project.zip', 'flutter_project.zip')
        
        main_entity = entities[0] 
        project_name_snake = to_snake_case(project_name)

        with zipfile.ZipFile(flutter_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.writestr(
                'pubspec.yaml',
                env.get_template('pubspec.yaml.j2').render(project_name_snake=project_name_snake)
            )
            zipf.writestr(
                'lib/main.dart',
                env.get_template('main.dart.j2').render(main_entity=main_entity)
            )

        return json.dumps({
            "zipPath": output_zip_path,
            "postmanPath": postman_path,
            "flutterZipPath": flutter_zip_path 
        })

    except Exception as e:
        print(f"Error en generate_springboot.py: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    input_json_str = sys.argv[1]
    script_dir = os.path.dirname(os.path.abspath(__file__))
    template_folder = os.path.join(script_dir, 'templates')
    output_dir = os.path.join(script_dir, 'generated')
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    zip_path = os.path.join(output_dir, 'spring_boot_project.zip')
    result_json = generate_project(input_json_str, zip_path, template_folder)
    
    print(result_json)