# generate_springboot.py
import os
import sys
import json
import zipfile
import re
from jinja2 import Environment, FileSystemLoader

# --- Funciones de Ayuda (Actualizadas) ---

def to_pascal_case(s):
    s = s.replace('_', ' ').replace('-', ' ')
    return "".join(word.capitalize() for word in s.split())

def to_camel_case(s):
    pascal = to_pascal_case(s)
    return pascal[0].lower() + pascal[1:]

def get_java_type(uml_type):
    uml_type = uml_type.lower().strip()
    if uml_type in ['int', 'integer']:
        return ('Integer', None)
    if uml_type in ['string', 'varchar', 'text']:
        return ('String', None)
    if uml_type in ['float', 'decimal', 'double']:
        return ('Double', None)
    if uml_type in ['boolean', 'bool']:
        return ('Boolean', None)
    if uml_type in ['date', 'datetime', 'timestamp']:
        return ('LocalDate', 'java.time.LocalDate')
    if not uml_type:
        return ('String', None)
    return (to_pascal_case(uml_type), None) 

def parse_attribute(attr_str):
    attr_str = re.sub(r'^[+\-#~]\s*', '', attr_str).strip()
    parts = attr_str.split(':')
    name_str = parts[0].strip().split('(')[0].strip()
    java_name = to_camel_case(name_str)
    
    if len(parts) > 1:
        type_str = parts[1].strip()
        java_type, import_needed = get_java_type(type_str)
    else:
        java_type, import_needed = 'String', None
        
    return {
        'name': java_name,
        'type': java_type,
        'import': import_needed
    }

# --- NUEVA FUNCIÓN: Generar un cuerpo JSON de ejemplo para Postman ---
def get_postman_body(entity):
    body = {}
    for attr in entity.get('attributes', []):
        attr_type = attr.get('type')
        attr_name = attr.get('name')
        if attr_type == 'Integer':
            body[attr_name] = 123
        elif attr_type == 'Double':
            body[attr_name] = 99.99
        elif attr_type == 'Boolean':
            body[attr_name] = True
        elif attr_type == 'LocalDate':
            body[attr_name] = "2025-11-09"
        else:
            body[attr_name] = "Sample " + attr_name
    
    # Devuelve el JSON como un string formateado
    return json.dumps(body, indent=4)

def generate_project(diagram_json_str, output_zip_path, template_dir):
    try:
        data = json.loads(diagram_json_str)
        elements = data.get('elementos', [])
        
        env = Environment(loader=FileSystemLoader(template_dir))

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
                    'table_name': el.get('name', 'unnamed_class').lower().replace(' ', '_'),
                    'attributes': attributes,
                    'imports': sorted(list(imports))
                })
        
        # --- INICIO: Creación de Colección Postman ---
        postman_collection = {
            "info": {
                "name": f"{project_name} API",
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "item": [],
            "variable": [
                {
                    "key": "host",
                    "value": "http://localhost:8080"
                }
            ]
        }
        # --- FIN: Creación de Colección Postman ---

        with zipfile.ZipFile(output_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            
            # 1. Archivos Estáticos (pom.xml, etc.)
            zipf.writestr('pom.xml', env.get_template('pom.xml.j2').render(project_name=to_camel_case(project_name)))
            zipf.writestr(f'src/main/resources/application.properties', env.get_template('application.properties.j2').render())
            zipf.writestr(f'src/main/java/{base_package_path}/{project_name}Application.java', env.get_template('MainApplication.java.j2').render(base_package=base_package, project_name=project_name))
            
            # 2. Archivos Dinámicos (Model, Repository, Controller)
            for entity in entities:
                class_name = entity["name"]
                camel_case_name = to_camel_case(class_name)
                api_path = f"api/{camel_case_name}" # ej. api/proveedores

                # Crear Model, Repo, Controller (igual que antes)
                zipf.writestr(f'src/main/java/{base_package_path}/model/{class_name}.java', env.get_template('Entity.java.j2').render(base_package=base_package, entity=entity))
                zipf.writestr(f'src/main/java/{base_package_path}/repository/{class_name}Repository.java', env.get_template('Repository.java.j2').render(base_package=base_package, entity=entity))
                zipf.writestr(f'src/main/java/{base_package_path}/controller/{class_name}Controller.java', env.get_template('Controller.java.j2').render(base_package=base_package, entity=entity, camel_case_name=camel_case_name))

                # --- INICIO: Añadir endpoints a Postman ---
                postman_collection["item"].append({
                    "name": f"Get All {class_name}",
                    "request": {
                        "method": "GET",
                        "header": [],
                        "url": {
                            "raw": f"{{{{host}}}}/{api_path}",
                            "host": ["{{host}}"],
                            "path": [api_path]
                        }
                    }
                })
                postman_collection["item"].append({
                    "name": f"Create New {class_name}",
                    "request": {
                        "method": "POST",
                        "header": [{"key": "Content-Type", "value": "application/json"}],
                        "body": {
                            "mode": "raw",
                            "raw": get_postman_body(entity)
                        },
                        "url": {
                            "raw": f"{{{{host}}}}/{api_path}",
                            "host": ["{{host}}"],
                            "path": [api_path]
                        }
                    }
                })
                postman_collection["item"].append({
                    "name": f"Get {class_name} By ID",
                    "request": {
                        "method": "GET",
                        "header": [],
                        "url": {
                            "raw": f"{{{{host}}}}/{api_path}/1",
                            "host": ["{{host}}"],
                            "path": [api_path, "1"]
                        }
                    }
                })
                # --- FIN: Añadir endpoints a Postman ---
        
        # --- INICIO: Guardar archivo Postman ---
        postman_path = output_zip_path.replace('.zip', '_postman.json')
        with open(postman_path, 'w', encoding='utf-8') as f:
            json.dump(postman_collection, f, indent=4)
        # --- FIN: Guardar archivo Postman ---
            
        # Devolver AMBOS paths como un JSON
        return json.dumps({
            "zipPath": output_zip_path,
            "postmanPath": postman_path
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

    # Generar el proyecto y el JSON de postman
    result_json = generate_project(input_json_str, zip_path, template_folder)
    
    # Imprimir el JSON con ambas rutas
    print(result_json)