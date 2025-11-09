# generate_springboot.py
import os
import sys
import json
import zipfile
import re
from jinja2 import Environment, FileSystemLoader

# --- Funciones de Ayuda ---

def to_pascal_case(s):
    """Convierte 'nombre_de_clase' o 'nombre de clase' a 'NombreDeClase'"""
    s = s.replace('_', ' ').replace('-', ' ')
    return "".join(word.capitalize() for word in s.split())

def to_camel_case(s):
    """Convierte a 'nombreDeClase'"""
    pascal = to_pascal_case(s)
    return pascal[0].lower() + pascal[1:]

def get_java_type(uml_type):
    """Mapea tipos de UML/Python a tipos de Java"""
    uml_type = uml_type.lower().strip()
    if uml_type in ['int', 'integer']:
        return 'Integer'
    if uml_type in ['string', 'varchar', 'text']:
        return 'String'
    if uml_type in ['float', 'decimal']:
        return 'Double'
    if uml_type in ['double']:
        return 'Double'
    if uml_type in ['boolean', 'bool']:
        return 'Boolean'
    if uml_type in ['date', 'datetime']:
        return 'LocalDate'
    # Fallback para tipos complejos (ej. 'Usuario')
    if not uml_type:
        return 'String'
    return to_pascal_case(uml_type)

def parse_attribute(attr_str):
    """Parsea un string como '+ name: String' a un dict"""
    # Elimina visibilidad (+, -, #)
    attr_str = re.sub(r'^[+\-#~]\s*', '', attr_str).strip()
    
    parts = attr_str.split(':')
    name_str = parts[0].strip()
    # Quita paréntesis de métodos si se colaron aquí
    name_str = name_str.split('(')[0].strip()

    java_name = to_camel_case(name_str)
    
    if len(parts) > 1:
        type_str = parts[1].strip()
        java_type = get_java_type(type_str)
    else:
        java_type = 'String' # Tipo por defecto si no se especifica
        
    return {
        'name': java_name,
        'type': java_type
    }

def generate_project(diagram_json_str, output_zip_path, template_dir):
    try:
        data = json.loads(diagram_json_str)
        elements = data.get('elementos', [])
        
        # Configurar Jinja2
        env = Environment(loader=FileSystemLoader(template_dir))

        # --- Datos para las plantillas ---
        # Usamos el nombre de la primera clase como nombre del proyecto (o 'GeneratedProject')
        project_name = "GeneratedProject"
        if elements:
            project_name = to_pascal_case(elements[0].get('name', 'GeneratedProject'))
        
        base_package = "com.example." + to_camel_case(project_name)
        base_package_path = base_package.replace('.', '/')
        
        # Procesar clases (Entidades)
        entities = []
        for el in elements:
            if el.get('tipo', 'Class') == 'Class':
                class_name = to_pascal_case(el.get('name', 'UnnamedClass'))
                attributes = [parse_attribute(attr) for attr in el.get('attributes', [])]
                entities.append({
                    'name': class_name,
                    'table_name': el.get('name', 'unnamed_class').lower().replace(' ', '_'),
                    'attributes': attributes
                })
        
        # --- Escribir en el archivo ZIP ---
        with zipfile.ZipFile(output_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            
            # 1. Archivos Estáticos (pom.xml, application.properties, MainApp)
            zipf.writestr(
                'pom.xml',
                env.get_template('pom.xml.j2').render(project_name=to_camel_case(project_name))
            )
            zipf.writestr(
                f'src/main/resources/application.properties',
                env.get_template('application.properties.j2').render()
            )
            zipf.writestr(
                f'src/main/java/{base_package_path}/{project_name}Application.java',
                env.get_template('MainApplication.java.j2').render(
                    base_package=base_package,
                    project_name=project_name
                )
            )
            
            # 2. Archivos Dinámicos (Model, Repository, Controller) por cada entidad
            for entity in entities:
                # Crear Model (Entity)
                zipf.writestr(
                    f'src/main/java/{base_package_path}/model/{entity["name"]}.java',
                    env.get_template('Entity.java.j2').render(
                        base_package=base_package,
                        entity=entity
                    )
                )
                # Crear Repository
                zipf.writestr(
                    f'src/main/java/{base_package_path}/repository/{entity["name"]}Repository.java',
                    env.get_template('Repository.java.j2').render(
                        base_package=base_package,
                        entity=entity
                    )
                )
                # Crear Controller
                zipf.writestr(
                    f'src/main/java/{base_package_path}/controller/{entity["name"]}Controller.java',
                    env.get_template('Controller.java.j2').render(
                        base_package=base_package,
                        entity=entity,
                        camel_case_name=to_camel_case(entity["name"])
                    )
                )
        
        return output_zip_path

    except Exception as e:
        # Imprimir el error a stderr para que Node.js lo capture
        print(f"Error en generate_springboot.py: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    # Recibe el JSON como un string desde la línea de comandos
    input_json_str = sys.argv[1]
    
    # Define dónde se guardarán las plantillas y el zip
    # Asume que 'templates' está en la misma carpeta que el script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    template_folder = os.path.join(script_dir, 'templates')
    
    # Asume que 'generated' está en la misma carpeta
    output_dir = os.path.join(script_dir, 'generated')
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    zip_path = os.path.join(output_dir, 'spring_boot_project.zip')

    # Generar el proyecto
    generated_file = generate_project(input_json_str, zip_path, template_folder)
    
    # Imprimir la ruta del archivo ZIP a stdout para que Node.js la reciba
    print(generated_file)