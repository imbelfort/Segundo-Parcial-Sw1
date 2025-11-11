# generate_springboot.py
import os
import sys
import json
import zipfile
import re
from jinja2 import Environment, FileSystemLoader

def to_pascal_case(s):

    s = s.replace('_', ' ').replace('-', ' ')
    parts = s.split()
    if not parts:
        return ""
    
    camel_case = to_camel_case(s) 

    return camel_case[0].upper() + camel_case[1:]

def to_camel_case(s):

    s = s.replace('_', ' ').replace('-', ' ')
    parts = s.split()
    if not parts:
        return ""

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

def find_display_attribute(entity):
    """
    Intenta adivinar el mejor atributo para mostrar en un dropdown o lista.
    Busca en orden de prioridad.
    """
    attr_names = [attr['name'] for attr in entity.get('attributes', [])]
    
    # Lista de prioridades (puedes añadir más si quieres)
    priority_list = [
        'nombre', 'name', 
        'descripcion', 'description', 
        'titulo', 'title', 
        'sku', 'codigo', 'username'
    ]
    
    # 1. Buscar en la lista de prioridades
    for name in priority_list:
        if name in attr_names:
            return name
    
    # 2. Si no se encuentra, usar el segundo atributo 
    #    (asumiendo que el primero es 'id')
    if len(attr_names) > 1:
        return attr_names[1] 
    
    # 3. Como último recurso, usar 'id'
    return 'id'

def get_java_type(uml_type, all_class_names):
    """Mapea tipos de UML a (TipoJava, ImportJava, TipoDart, EsRelacion, EsArray)"""
    uml_type = uml_type.lower().strip()
    is_array = False
    
    # Detecta si es un array (ej. Categoria[] o List<Categoria>)
    if '[]' in uml_type or 'list<' in uml_type:
        is_array = True
        uml_type = uml_type.replace('[]', '').replace('list<', '').replace('>', '')
        
    if uml_type in ['int', 'integer']:
        return ('Integer', None, 'int', False, is_array)
    if uml_type in ['string', 'varchar', 'text']:
        return ('String', None, 'String', False, is_array)
    if uml_type in ['float', 'decimal', 'double']:
        return ('Double', None, 'double', False, is_array)
    if uml_type in ['boolean', 'bool']:
        return ('Boolean', None, 'bool', False, is_array)
    if uml_type in ['date', 'datetime', 'timestamp']:
        return ('LocalDate', 'java.time.LocalDate', 'String', False, is_array)
    
    # Comprueba si es una relación con otra clase
    java_type = to_pascal_case(uml_type)
    if java_type in all_class_names:
        # ¡Es una relación!
        return (java_type, None, java_type, True, is_array)
        
    # Tipo desconocido, por defecto es String
    if not uml_type:
        return ('String', None, 'String', False, is_array)
    return (java_type, None, java_type, False, is_array) # Asume tipo custom no-relación

def parse_attribute(attr_str, all_class_names):
    """Parsea un string como '+ name: String' o '+ categoria: Categoria' a un dict"""
    attr_str = re.sub(r'^[+\-#~]\s*', '', attr_str).strip()
    parts = attr_str.split(':')
    name_str = parts[0].strip().split('(')[0].strip()
    
    java_name = to_camel_case(name_str)
    pascal_name = to_pascal_case(name_str)
    
    if len(parts) > 1:
        type_str = parts[1].strip()
        java_type, import_needed, dart_type, is_rel, is_array = get_java_type(type_str, all_class_names)
    else:
        java_type, import_needed, dart_type, is_rel, is_array = 'String', None, 'String', False, False
        
    return {
        'name': java_name,
        'pascal_name': pascal_name,
        'type': java_type,
        'dart_type': dart_type,
        'import': import_needed,
        'is_relationship': is_rel,  # <-- La clave para el Dropdown
        'is_array': is_array        # <-- La clave para 1-a-N y N-a-N
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
        env.filters['camel_case'] = to_camel_case
        env.filters['pascal_case'] = to_pascal_case
        env.filters['snake_case'] = to_snake_case

        project_name = "GeneratedProject"
        if elements:
            project_name = to_pascal_case(elements[0].get('name', 'GeneratedProject'))
        
        base_package = "com.example." + to_camel_case(project_name)
        base_package_path = base_package.replace('.', '/')

        all_class_names = [to_pascal_case(el.get('name')) for el in elements if el.get('tipo', 'Class') == 'Class']
        
        entities = []
        for el in elements:
            if el.get('tipo', 'Class') == 'Class':
                class_name = to_pascal_case(el.get('name', 'UnnamedClass'))
                attributes = [parse_attribute(attr, all_class_names) for attr in el.get('attributes', [])]
                imports = set()
                for attr in attributes:
                    if attr['import']:
                        imports.add(attr['import'])
                
                entities.append({
                    'name': class_name,
                    'camel_case_name': to_camel_case(class_name),
                    'snake_case_name': to_snake_case(class_name), # <-- Nuevo, para nombres de archivo
                    'table_name': el.get('name', 'unnamed_class').lower().replace(' ', '_'),
                    'attributes': attributes,
                    'imports': sorted(list(imports))
                })
        
        if not entities:
            raise Exception("No se encontraron clases en el diagrama.")

        display_attr_map = {}
        for entity in entities:
            # Asigna el display_attr para su *propia* pantalla (ej. en el ListTile)
            entity_display_attr = find_display_attribute(entity)
            entity['display_attribute'] = entity_display_attr
            display_attr_map[entity['name']] = entity_display_attr

        # 2. VOLVER a iterar y enriquecer los atributos de *relación*
        #    (Esto le dice a 'Producto' qué campo usar de 'Categoria')
        for entity in entities:
            for attr in entity['attributes']:
                if attr['is_relationship']:
                    related_entity_name = attr['type'] # ej. "Categoria"
                    # Asignar el display_attr de la entidad relacionada
                    attr['related_display_attribute'] = display_attr_map.get(related_entity_name, 'id')
        
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
                env.get_template('flutter_pubspec.yaml.j2').render(project_name_snake=project_name_snake)
            )
            # 2. main.dart (Nuevo - solo rutas)
            zipf.writestr(
                'lib/main.dart',
                env.get_template('flutter_main.dart.j2').render(entities=entities, project_name=project_name)
            )
            
            # 3. Pantalla de inicio (Nuevo - un menú)
            zipf.writestr(
                'lib/home_screen.dart',
                env.get_template('flutter_home_screen.dart.j2').render(entities=entities)
            )

            # 4. Genera los archivos PARA CADA ENTIDAD
            for entity in entities:
                entity_name_snake = entity['snake_case_name'] # ej: 'producto'
                
                # 4a. Modelo (producto.dart)
                zipf.writestr(
                    f'lib/models/{entity_name_snake}.dart',
                    env.get_template('flutter_model.dart.j2').render(entity=entity)
                )
                
                # 4b. Servicio (producto_service.dart)
                zipf.writestr(
                    f'lib/services/{entity_name_snake}_service.dart',
                    env.get_template('flutter_service.dart.j2').render(entity=entity)
                )
                
                # 4c. Pantalla (producto_screen.dart)
                zipf.writestr(
                    f'lib/screens/{entity_name_snake}_screen.dart',
                    env.get_template('flutter_screen.dart.j2').render(entity=entity, 
                        entities=entities)
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