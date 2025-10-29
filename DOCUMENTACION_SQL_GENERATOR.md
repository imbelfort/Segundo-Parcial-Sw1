# Generador de Script SQL para PostgreSQL

## Descripción

Se ha implementado una funcionalidad completa para convertir elementos de clases y relaciones UML de la pizarra en un script SQL válido para PostgreSQL. Esta funcionalidad permite a los usuarios generar automáticamente el esquema de base de datos a partir de sus diagramas UML.

## Características Implementadas

### 1. Endpoint del Servidor (`/generar-sql`)
- **Método**: POST
- **Entrada**: JSON con `elementosPorPizarra`
- **Salida**: Script SQL completo con estadísticas

### 2. Funcionalidad del Frontend
- Botón "Generar SQL" en la barra de herramientas
- Modal para visualizar el SQL generado
- Descarga automática del archivo `.sql`
- Copia al portapapeles
- Notificaciones de estado

### 3. Generación Inteligente de SQL

#### Mapeo de Tipos UML a PostgreSQL
- `int`, `integer`, `number` → `integer`
- `float`, `double`, `decimal` → `numeric`
- `boolean`, `bool` → `boolean`
- `date`, `datetime`, `timestamp` → `timestamp`
- `string`, `text`, `char` → `text`

#### Manejo de Relaciones
- **Relaciones 1..***: Crea foreign key en la tabla del lado "*"
- **Relaciones muchos-a-muchos**: Crea tabla intermedia automáticamente
- **Relaciones recursivas**: Crea columna `parent_id` con auto-referencia
- **Composición y Agregación**: Tratadas como asociaciones normales

#### Sanitización de Nombres
- Convierte nombres a `snake_case`
- Elimina caracteres especiales
- Evita colisiones con palabras reservadas

## Estructura de Datos Soportada

### Clases UML
```json
{
  "id": 1,
  "tipo": "Class",
  "name": "Usuario",
  "attributes": [
    "+ id: int",
    "+ nombre: String",
    "+ email: String"
  ],
  "methods": [
    "+ getNombre(): String"
  ]
}
```

### Relaciones UML
```json
{
  "tipo": "Association",
  "from": 1,
  "to": 2,
  "multOrigen": "1",
  "multDestino": "*",
  "label": "participa"
}
```

## Ejemplo de Uso

### 1. Desde la Interfaz Web
1. Crear clases UML en la pizarra
2. Definir relaciones entre clases
3. Hacer clic en "Generar SQL"
4. El sistema genera y descarga automáticamente el script

### 2. Desde el Servidor (API)
```javascript
const response = await fetch('/generar-sql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ elementosPorPizarra: datos })
});

const result = await response.json();
console.log(result.sql); // Script SQL generado
```

## Ejemplo de Salida SQL

```sql
-- Generado automáticamente desde la pizarra
-- Fecha: 2025-09-24T04:30:57.516Z
-- Clases: 4, Relaciones: 3

-- Tabla para clase usuario
CREATE TABLE IF NOT EXISTS usuario (
  id BIGSERIAL PRIMARY KEY,
  nombre text,
  email text,
  fecharegistro timestamp
);

-- Tabla para clase proyecto
CREATE TABLE IF NOT EXISTS proyecto (
  id BIGSERIAL PRIMARY KEY,
  titulo text,
  descripcion text,
  fechacreacion timestamp
);

-- Relación 1..* de usuario -> usuarioproyecto
ALTER TABLE usuarioproyecto ADD COLUMN IF NOT EXISTS usuario_id BIGINT;
ALTER TABLE usuarioproyecto ADD CONSTRAINT IF NOT EXISTS fk_usuarioproyecto_usuario 
  FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE SET NULL;
```

## Archivos Modificados

### 1. `server.js`
- Agregado endpoint `/generar-sql`
- Funciones auxiliares: `sanitizeName()`, `mapType()`, `parseAttribute()`, `generarSQL()`

### 2. `public/script.js`
- Función `generarScriptSQL()` para comunicación con el servidor
- Función `mostrarModalSQL()` para visualización del resultado
- Manejo de errores y notificaciones

### 3. `views/proyecto.ejs`
- Botón "Generar SQL" en la barra de herramientas
- Icono de base de datos (`storage`)

## Archivos de Prueba Creados

### 1. `ejemplo_elementos.json`
- Datos de ejemplo con clases y relaciones UML
- Estructura completa para pruebas

### 2. `test_sql_generator.js`
- Script independiente para probar la funcionalidad
- Genera SQL desde archivo JSON estático

### 3. `ejemplo_schema.sql`
- Salida SQL generada automáticamente
- Ejemplo del resultado final

## Características Técnicas

### Validaciones
- Verificación de existencia de clases antes de crear relaciones
- Manejo de errores en parsing de atributos
- Validación de multiplicidades

### Optimizaciones
- Uso de `IF NOT EXISTS` para evitar errores en ejecuciones múltiples
- Constraints con nombres únicos para evitar conflictos
- Comentarios descriptivos en el SQL generado

### Compatibilidad
- PostgreSQL 9.6+
- Manejo de caracteres especiales en nombres
- Soporte para tipos de datos estándar

## Limitaciones Actuales

1. **Métodos UML**: Se ignoran (no se convierten a SQL)
2. **Herencia**: No implementada completamente
3. **Tipos personalizados**: Se mapean a `text` por defecto
4. **Validaciones complejas**: Solo foreign keys básicas

## Mejoras Futuras Sugeridas

1. Implementar soporte para herencia UML
2. Agregar validaciones de datos más complejas
3. Soporte para índices automáticos
4. Generación de triggers y funciones
5. Exportación a otros motores de base de datos

## Conclusión

La funcionalidad implementada proporciona una solución completa y robusta para convertir diagramas UML en scripts SQL de PostgreSQL. Es fácil de usar, genera código limpio y está bien integrada con la interfaz existente de la aplicación.
