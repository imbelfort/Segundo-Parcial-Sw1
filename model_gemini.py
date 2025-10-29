# ...existing code...
import google.generativeai as genai
import os
import json # Para manejar la respuesta JSON

import psycopg2
from psycopg2.extras import Json, RealDictCursor

# Conexión a la BDD PostgreSQL (lee DATABASE_URL o usa valores por defecto)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/pizarra")

def get_db_conn():
    return psycopg2.connect(DATABASE_URL)

def load_board_from_db(pizarra_id: int) -> dict | None:
    """Carga los elementos de una pizarra desde la tabla 'elementos' y devuelve { 'elementos': [...] } o None."""
    try:
        with get_db_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT propiedades FROM elementos WHERE pizarra_id = %s ORDER BY id", (pizarra_id,))
                rows = cur.fetchall()
                if not rows:
                    return {"elementos": []}
                elementos = [r['propiedades'] for r in rows]
                return {"elementos": elementos}
    except Exception as e:
        print(f"❌ Error al cargar pizarra {pizarra_id} desde DB: {e}")
        return None

def sync_board_elements_to_db(pizarra_id: int, elementos: list) -> bool:
    """
    Sincroniza la lista completa de elementos en la BDD:
    - Borra los elementos actuales de la pizarra y vuelve a insertar los recibidos.
    Nota: requiere pizarra_id válido.
    """
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM elementos WHERE pizarra_id = %s", (pizarra_id,))
                insert_sql = "INSERT INTO elementos (pizarra_id, tipo, propiedades) VALUES (%s, %s, %s)"
                for el in elementos:
                    tipo = el.get("tipo", "Class")
                    cur.execute(insert_sql, (pizarra_id, tipo, Json(el)))
            return True
    except Exception as e:
        print(f"❌ Error al sincronizar elementos en DB para pizarra {pizarra_id}: {e}")
        return False


# ...existing code...

def merge_elements(original_elements: list, generated_elements: list) -> list:
    """
    Merge generated_elements into original_elements for an 'update' operation:
    - If generated element has same 'id' as an original -> update that original (preserve original id).
    - Else if a generated element matches by (name, tipo) -> update that original (preserve original id).
    - Else -> append generated element as new.
    - Do NOT remove originals that are not referenced (safe partial update).
    """
    if not original_elements:
        return generated_elements.copy() if generated_elements else []

    orig_by_id = {el.get("id"): el for el in original_elements if el.get("id") is not None}
    orig_by_name = {(el.get("name"), el.get("tipo")): el for el in original_elements if el.get("name")}
    result = original_elements.copy()  # shallow copy; we'll replace items by index

    def replace_orig(orig, new_el):
        try:
            idx = original_elements.index(orig)
            merged = orig.copy()
            merged.update(new_el)  # new fields overwrite
            merged["id"] = orig.get("id")  # preserve original id
            result[idx] = merged
        except ValueError:
            # if not found, append merged
            merged = orig.copy()
            merged.update(new_el)
            merged["id"] = orig.get("id")
            result.append(merged)

    handled_orig_ids = set()

    for gen in generated_elements or []:
        gen_id = gen.get("id")
        if gen_id and gen_id in orig_by_id:
            replace_orig(orig_by_id[gen_id], gen)
            handled_orig_ids.add(gen_id)
            continue

        key = (gen.get("name"), gen.get("tipo"))
        if key in orig_by_name:
            orig = orig_by_name[key]
            replace_orig(orig, gen)
            handled_orig_ids.add(orig.get("id"))
            continue

        # New element: append as-is (ensure it has an id string)
        if gen.get("id") is None:
            # generate a fallback id if missing
            gen = gen.copy()
            gen["id"] = f"gen_{len(result)+1}"
        result.append(gen)

    return result

# ...existing code...

# --- 2. Configuración del modelo Gemini ---

GOOGLE_API_KEY = "AIzaSyD1gNn3pHWdWm7MhAexDXRdpmxJdOWamt0"

if GOOGLE_API_KEY is None:
    raise ValueError("La variable de entorno GOOGLE_API_KEY no está configurada.")

genai.configure(api_key=GOOGLE_API_KEY)


# Cambiado a un modelo más capaz. Puedes alternar entre opciones comentadas si hace falta.
#model = genai.GenerativeModel('models/gemini-1.5-pro')
#model = genai.GenerativeModel('models/gemini-1.5-flash')
model = genai.GenerativeModel('models/gemma-3n-e4b-it') # versión anterior
# ...existing code...

# --- 3. El Prompt Maestro (para el modelo de IA) ---
CLASS_VISIBILITY = ["public", "private", "protected", "package"]
CLASS_STEREOTYPES = ["abstract", "interface", "enumeration", "utility", "entity", "service", "controller", "repository", "dto", "component"]

# Tipos de relaciones UML
UML_RELATIONSHIPS = [
    "association",           # Asociación simple
    "aggregation",          # Agregación (diamante vacío)
    "composition",          # Composición (diamante lleno)
    "inheritance",          # Herencia/Generalización
    "realization",          # Realización (interfaz)
    "dependency",           # Dependencia
    "association_one_to_one",    # Asociación 1:1
    "association_one_to_many",   # Asociación 1:*
    "association_many_to_many"   # Asociación *:*
]

# Tipos de datos UML estándar
UML_DATA_TYPES = [
    "String", "Int", "Boolean", "Float", "Double", "Date", "Time", 
    "DateTime", "Character", "Byte", "Short", "Long", "BigDecimal",
    "Collection", "List", "Set", "Map", "Array", "void"
]

# ...existing code...

def generate_uml_class_diagram_json(user_prompt: str, current_state: dict = None, mode: str = "create") -> str:
    """
    Genera o modifica un JSON de diagrama de clases UML basado en el prompt del usuario.

    Mejoras:
    - Instrucciones más estrictas para que el modelo modifique elementos existentes en lugar de crear nuevos.
    - Si el modelo devuelve elementos sin "id" pero con (name,tipo) que coinciden con el estado actual,
      les asignamos el id original antes de devolver el JSON.
    """
    print(f"🔍 Generando UML (modo={mode}) para prompt: {user_prompt}")

    estado_json = json.dumps(current_state, ensure_ascii=False) if current_state else "null"

    master_prompt = f"""
    Genera SOLO un JSON válido (sin ningún texto adicional) con la forma:
    {{
      "elementos": [
        {{
          "tipo": "Class",
          "id": id_unico,
          "name": "NombreClase",
          "x": 100,
          "y": 100,
          "w": 170,
          "h": 150,
          "attributes": ["+ nombre: String"],
          "methods": ["+ getNombre(): String"]
        }},
        {{
          "tipo": "Association" | "Composition" | "Aggregation",
          "from": id_origen,
          "to": id_destino,
          "label": "opcional etiqueta",
          "multOrigen": "1" | "*",
          "multDestino": "1" | "*"
        }}
      ]
    }}

    INSTRUCCIONES IMPORTANTES (LEER ANTES DE RESPONDER):
    - Modo: {mode}
    - ESTADO_ACTUAL: {estado_json}
    - Si modo == "update": modifica ESTADO_ACTUAL según la PETICIÓN_USUARIO y devuelve SOLO el array completo "elementos" actualizado.
      - Si el usuario indica una clase por su "id", actualiza esa clase y conserva su mismo "id", "x", "y", "w", "h" y "tipo" a menos que explícitamente pida cambiarlos.
      - Si el usuario indica una clase por "name" y no por id, intenta encontrar la clase en ESTADO_ACTUAL por (name,tipo) y conserva su id.
      - No crees una nueva clase si la intención del usuario es modificar una existente.
      - No crees una nueva relacion si la intención del usuario es modificar una clase existente.
      - No modifiques los "from" y "to" en una relacion si la intención del usuario es modificar una clase existente.
      - Si no puedes identificar la clase a modificar, no inventes cambios; devuelve el ESTADO_ACTUAL sin modificaciones y explica brevemente (pero el prompt maestro exige SOLO JSON — en ese caso devuelve el mismo estado).
    - Si modo == "create": genera un JSON nuevo con "elementos".
      - Si la intencion del usuario es agregar atributos/metodos, añádelos a la clase indicada y no crees relaciones.
      - Usa solo los tipos: "Class", "Association", "Composition", "Aggregation".
      - Para los elementos tipo class: incluye "id" único de tipo Number con la funcion Date.now() + Math.random().
      - Para Association, Composition o Aggregation: el "from" sera el id de la clase origen, "to" sera el id de la clase destino
      - Para Composition/Aggregation: multOrigen = '1', multDestino = '*', label = "".
      - Para Association: incluye label opcional y multiplicidades '1' o '*'.
      - Atributos con formato: "+ nombre: Tipo"
      - Métodos con formato: "+ nombre(): TipoRetorno"
    - Responde SOLO con JSON válido. No incluyas explicaciones ni delimitadores ```json```.

    PETICIÓN_USUARIO:
    {user_prompt}
    """

    try:
        print("🤖 Enviando prompt a Gemini...")
        response = model.generate_content(master_prompt)
        json_output = response.text.strip()
        print(f"📝 Texto crudo: {json_output[:400]}...")

        # Limpiar posibles delimitadores
        if json_output.startswith("```json"):
            json_output = json_output[7:]
        if json_output.startswith("```"):
            json_output = json_output.strip("`")
        if json_output.endswith("```"):
            json_output = json_output[:-3]

        # Validar y post-procesar JSON
        print("🔍 Intentando parsear JSON...")
        parsed = json.loads(json_output)  # lanzará error si no es JSON

        # Aceptar también si el modelo devolvió directamente la lista (convertir a dict)
        if isinstance(parsed, list):
            parsed = {"elementos": parsed}

        if not isinstance(parsed, dict) or "elementos" not in parsed or not isinstance(parsed["elementos"], list):
            raise ValueError("El JSON generado no contiene la clave 'elementos' con un array.")

        # Si estamos en modo update y tenemos estado actual, intentar reasignar ids faltantes
        if mode == "update" and current_state and isinstance(current_state.get("elementos"), list):
            orig_by_name = {(el.get("name"), el.get("tipo")): el for el in current_state.get("elementos", []) if el.get("name")}
            for el in parsed["elementos"]:
                if not el.get("id"):
                    key = (el.get("name"), el.get("tipo"))
                    if key in orig_by_name:
                        # reasignar el id original para que el merge lo detecte como actualización
                        el["id"] = orig_by_name[key].get("id")

        # Serializar de nuevo (asegura que el texto devuelto refleja cambios)
        json_output = json.dumps(parsed, ensure_ascii=False)
        print("✅ JSON válido generado")
        return json_output
    except Exception as e:
        print(f"❌ Error al generar JSON: {e}")
        return json.dumps({"error": "No se pudo generar el JSON de UML", "details": str(e)})

# ...existing code...

# --- 4. Ejemplo de uso en tu sistema (ej. una API REST) ---
from flask import Flask, request, jsonify
from flask_cors import CORS


app = Flask(__name__)
CORS(app)

@app.route('/generate_uml_diagram', methods=['POST'])
def generate_uml_diagram_endpoint():
    print("🚀 Endpoint /generate_uml_diagram llamado")
    data = request.json or {}
    user_prompt = data.get('prompt')
    board = data.get('board')  # estado actual enviado por cliente (opcional)
    board_id = data.get('board_id')  # id de pizarra en la BDD (opcional)
    mode = data.get('mode', 'create')  # "create" o "update"
    print(f"📝 Prompt recibido: {user_prompt}, modo={mode}, board_id={board_id}")

    if not user_prompt:
        print("❌ Error: No se proporcionó prompt")
        return jsonify({"error": "Se requiere un 'prompt' en el cuerpo de la solicitud"}), 400

    # Si no viene board por el cliente pero se proporcionó board_id, cargar desde BD
    if board is None and board_id:
        loaded = load_board_from_db(board_id)
        if loaded is None:
            return jsonify({"error": "No se pudo cargar la pizarra desde la base de datos"}), 500
        board = loaded

    print("🔄 Generando UML...")
    uml_json_string = generate_uml_class_diagram_json(user_prompt, current_state=board, mode=mode)

    try:
        print("🔍 Parseando respuesta...")
        parsed_json = json.loads(uml_json_string)
    except json.JSONDecodeError as e:
        print(f"❌ Error parseando JSON: {e}")
        return jsonify({"error": "El modelo no pudo generar un JSON válido", "response_text": uml_json_string}), 500

    # Si es modo update y tenemos board (estado actual), MERGE en lugar de reemplazar totalmente
    if mode == "update":
        elementos_generados = parsed_json.get("elementos")
        if not isinstance(elementos_generados, list):
            return jsonify({"error": "Respuesta del modelo no contiene 'elementos' como lista"}), 500

        # Si tenemos el estado actual (board) usamos merge para actualizar solo lo que el prompt pidió
        if board and isinstance(board.get("elementos"), list):
            merged_elements = merge_elements(board.get("elementos"), elementos_generados)
        else:
            # si no hay estado actual, usar directamente lo generado
            merged_elements = elementos_generados

        # sincronizar en DB si hay board_id
        if board_id:
            ok = sync_board_elements_to_db(board_id, merged_elements)
            if not ok:
                return jsonify({"error": "No se pudo guardar los elementos en la base de datos"}), 500
            print(f"✅ Elementos sincronizados en DB para pizarra {board_id}")

        # devolver estado resultante al cliente
        return jsonify({"elementos": merged_elements})

    # modo create -> devolver directamente lo generado
    return jsonify(parsed_json)

if __name__ == '__main__':
    # Para ejecutar este ejemplo, necesitas Flask instalado: pip install Flask
    # Y la clave de API configurada.
    print("Iniciando servidor Flask en [http://127.0.0.1:5000](http://127.0.0.1:5000)")
    print("Envía solicitudes POST a /generate_uml_diagram con un JSON: {\"prompt\": \"Tu descripción del sistema aquí\", \"board\": {...}, \"mode\": \"update\"}")
    app.run(debug=True) # debug=True solo para desarrollo
# ...existing code...