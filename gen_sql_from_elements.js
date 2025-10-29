/**
 * gen_sql_from_elements.js
 *
 * Lee un JSON con la estructura de tus pizarras/elementos (elementosPorPizarra)
 * y genera sentencias SQL para PostgreSQL (CREATE TABLE, FKs, tablas intermedias).
 *
 * Uso:
 * 1) Exporta desde tu app el JSON de elementosPorPizarra a 'elementos.json'
 *    (o adapta la lectura para tomar los datos desde tu BD).
 * 2) node gen_sql_from_elements.js > schema.sql
 *
 * Nota: Este generador hace heurísticas:
 * - Atributos con formato "+ nombre: Tipo" -> columna 'nombre' con tipo mapeado.
 * - Métodos se ignoran (no son columnas).
 * - Associations:
 *   - Si ambos lados tienen multiplicidad '*' => crea tabla intermedia (join table)
 *   - Si un lado es '1' y el otro '*' -> FK en lado '*' apuntando al '1'
 *   - Compositions/Aggregations se tratan como Associations (FK/comportamiento similar)
 * - Si existe una clase intermedia (nombre incluye 'intermedia' o '_' ) preferimos usarla como tabla join.
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, 'elementos.json'); // adaptalo si necesitas otro origen

if (!fs.existsSync(INPUT)) {
    console.error('Coloca tu export de elementosPorPizarra en elementos.json en la raíz del proyecto.');
    process.exit(1);
}

const raw = fs.readFileSync(INPUT, 'utf8');
const elementosPorPizarra = JSON.parse(raw); // se espera un array de pizarras, cada una con array de elementos

// Aplanamos todas las pizarras a una lista de elementos
const elementos = [].concat(...elementosPorPizarra);

// Obtener solo las clases
const clases = elementos.filter(e => e.tipo === 'Class').map(c => {
    return {
        originalId: c.id,
        name: sanitizeName(c.name || `Clase_${Math.floor(Math.random() * 10000)}`),
        attributes: c.attributes || [],
        methods: c.methods || []
    };
});

// Mapa id -> clase
const claseById = {};
clases.forEach(c => { claseById[c.originalId] = c; });

// Asociaciones (Association / Composition / Aggregation)
const relaciones = elementos.filter(e => ['Association', 'Composition', 'Aggregation'].includes(e.tipo)).map(r => {
    return {
        tipo: r.tipo,
        from: r.from,
        to: r.to,
        multOrigen: r.multOrigen || '',
        multDestino: r.multDestino || '',
        label: r.label || ''
    };
});

// Mapeo simple de tipos UML textual a Postgres
function mapType(umlType) {
    if (!umlType) return 'text';
    const t = umlType.toLowerCase();
    if (['int', 'integer', 'number', 'long', 'short'].includes(t)) return 'integer';
    if (['float', 'double', 'real', 'decimal'].includes(t)) return 'numeric';
    if (['bool', 'boolean'].includes(t)) return 'boolean';
    if (['date', 'datetime', 'timestamp'].includes(t)) return 'timestamp';
    if (['text', 'string', 'char', 'varchar'].includes(t)) return 'text';
    return 'text';
}

function sanitizeName(name) {
    // convertir a snake_case y caracteres válidos
    return name.trim()
        .replace(/\s+/g, '_')
        .replace(/[^\w]/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase() || 'unnamed';
}

// Parse attribute strings "+ nombre: Tipo" o "nombre:Tipo"
function parseAttribute(attrStr) {
    // quitar prefijos + - # ~ y espacios
    const s = attrStr.replace(/^[+\-#~]\s*/, '').trim();
    const parts = s.split(':');
    if (parts.length < 2) {
        return { name: sanitizeName(s), type: 'text' };
    }
    const name = sanitizeName(parts[0].trim());
    const typeStr = parts.slice(1).join(':').trim();
    const type = mapType(typeStr);
    return { name, type };
}

// Construir SQL
let sql = '';
sql += `-- Generado por gen_sql_from_elements.js\n-- Basado en elementos de las pizarras (Classes y Associations)\n\n`;

// Identificar clases intermedias para relaciones recursivas muchos a muchos
const clasesIntermediasRecursivas = new Set();
relaciones.forEach(rel => {
    const toName = classNameForId(rel.to);
    if (toName) {
        // Buscar si hay dos relaciones 1..* desde la misma clase hacia esta clase intermedia
        const relacionesDesdeMismaClase = relaciones.filter(r => 
            r.from === rel.from && r.to === rel.to && r.multOrigen === '1' && r.multDestino.includes('*')
        );
        if (relacionesDesdeMismaClase.length === 2) {
            clasesIntermediasRecursivas.add(rel.to);
        }
    }
});

// Crear tablas para cada clase (excluyendo clases intermedias recursivas)
clases.forEach(clase => {
    // Si es una clase intermedia recursiva, no crear tabla individual
    if (clasesIntermediasRecursivas.has(clase.originalId)) {
        return;
    }
    
    sql += `-- Tabla para clase ${clase.name}\n`;
    sql += `CREATE TABLE IF NOT EXISTS ${clase.name} (\n`;
    sql += `  id BIGSERIAL PRIMARY KEY,\n`;
    // intentamos crear columnas a partir de atributos
    const cols = [];
    clase.attributes.forEach(attrStr => {
        const a = parseAttribute(attrStr);
        // evitar colisiones con id
        if (a.name === 'id') a.name = 'attr_id';
        cols.push(`  ${a.name} ${a.type}`);
    });
    if (cols.length === 0) {
        // agregar columna por defecto para datos
        cols.push(`  data jsonb`);
    }
    sql += cols.join(',\n') + '\n';
    sql += `);\n\n`;
});

// Generar relaciones
// función auxiliar para encontrar nombre de clase por id
function classNameForId(id) {
    if (claseById[id]) return claseById[id].name;
    return null;
}

// buscar clases intermedias (heurística: nombre contiene 'intermedia' o '_' con pocas columnas)
const intermediaNames = new Set();
clases.forEach(c => {
    if (c.name.includes('intermedia') || c.name.includes('_')) intermediaNames.add(c.name);
});

// Para cada relación
const relacionesProcesadas = new Set();
relaciones.forEach(rel => {
    // Evitar procesar relaciones duplicadas de clases intermedias recursivas
    const relKey = `${rel.from}-${rel.to}`;
    if (relacionesProcesadas.has(relKey)) {
        return;
    }
    
    const fromName = classNameForId(rel.from);
    const toName = classNameForId(rel.to);

    // Si alguna clase no existe (posible si se usa id no mapeado), saltar con comentario
    if (!fromName || !toName) {
        sql += `-- Ignorada relación (clase no encontrada) from:${rel.from} to:${rel.to} tipo:${rel.tipo}\n\n`;
        return;
    }

    // normalizar multiplicidades
    const multFrom = (rel.multOrigen || '').trim();
    const multTo = (rel.multDestino || '').trim();

    // Si la relación apunta a una clase intermedia recursiva, crear tabla de unión recursiva muchos a muchos
    if (clasesIntermediasRecursivas.has(rel.to)) {
        // Buscar la otra relación que también apunta a esta clase intermedia desde la misma clase
        const otraRelacion = relaciones.find(r => 
            r.from === rel.from && r.to === rel.to && r !== rel && r.multOrigen === '1' && r.multDestino.includes('*')
        );
        
        if (otraRelacion) {
            // Marcar ambas relaciones como procesadas
            relacionesProcesadas.add(`${rel.from}-${rel.to}`);
            relacionesProcesadas.add(`${otraRelacion.from}-${otraRelacion.to}`);
            
            // Crear tabla de unión recursiva muchos a muchos
            const joinName = `${fromName}_recursiva_rel`;
            sql += `-- Tabla intermedia para relación recursiva muchos-a-muchos en ${fromName}\n`;
            sql += `CREATE TABLE IF NOT EXISTS ${joinName} (\n`;
            sql += `  ${fromName}_id1 BIGINT NOT NULL,\n`;
            sql += `  ${fromName}_id2 BIGINT NOT NULL,\n`;
            sql += `  PRIMARY KEY (${fromName}_id1, ${fromName}_id2),\n`;
            sql += `  CONSTRAINT fk_${joinName}_${fromName}_1 FOREIGN KEY (${fromName}_id1) REFERENCES ${fromName}(id) ON DELETE CASCADE,\n`;
            sql += `  CONSTRAINT fk_${joinName}_${fromName}_2 FOREIGN KEY (${fromName}_id2) REFERENCES ${fromName}(id) ON DELETE CASCADE,\n`;
            sql += `  CONSTRAINT chk_${joinName}_diferentes CHECK (${fromName}_id1 != ${fromName}_id2)\n`;
            sql += `);\n\n`;
            return;
        }
    }

    // caso recursivo simple (self relation) - solo una relación recursiva simple
    if (rel.from === rel.to) {
        // agrega columna parent_id
        sql += `-- Relación recursiva simple en ${fromName}\n`;
        sql += `ALTER TABLE ${fromName} ADD COLUMN IF NOT EXISTS parent_id BIGINT;\n`;
        sql += `ALTER TABLE ${fromName} ADD CONSTRAINT fk_${fromName}_parent FOREIGN KEY (parent_id) REFERENCES ${fromName}(id) ON DELETE SET NULL;\n\n`;
        return;
    }

    // Many-to-many heurística: ambos lados '*' OR existe clase intermedia conectada
    const bothMany = (multFrom.includes('*') && multTo.includes('*'));
    const intermediaPresent = Array.from(intermediaNames).some(inter => {
        // si existe una clase cuyo nombre parece intermedia y hay asociaciones apuntando a ella, preferirla
        return false; // (aquí podrías extender: buscar clases intermedia que estén referenciadas por asociaciones)
    });

    if (bothMany) {
        // crear tabla intermedia con fk a ambas
        const joinName = `${fromName}_${toName}_rel`;
        sql += `-- Tabla intermedia para relación muchos-a-muchos entre ${fromName} y ${toName}\n`;
        sql += `CREATE TABLE IF NOT EXISTS ${joinName} (\n`;
        sql += `  id BIGSERIAL PRIMARY KEY,\n`;
        sql += `  ${fromName}_id BIGINT NOT NULL,\n`;
        sql += `  ${toName}_id BIGINT NOT NULL,\n`;
        sql += `  UNIQUE (${fromName}_id, ${toName}_id)\n`;
        sql += `);\n`;
        sql += `ALTER TABLE ${joinName} ADD CONSTRAINT fk_${joinName}_${fromName} FOREIGN KEY (${fromName}_id) REFERENCES ${fromName}(id) ON DELETE CASCADE;\n`;
        sql += `ALTER TABLE ${joinName} ADD CONSTRAINT fk_${joinName}_${toName} FOREIGN KEY (${toName}_id) REFERENCES ${toName}(id) ON DELETE CASCADE;\n\n`;
        return;
    }

    // Si uno es '1' y otro '*', agregar FK en lado '*' apuntando al '1'
    // Heurística: si multFrom == '1' and multTo contains '*' => to side is many -> add fk to 'from' on table 'to'
    if ((multFrom === '1' && multTo.includes('*')) || (multFrom === '1' && multTo === '')) {
        sql += `-- Relación 1..* (o 1..?) de ${fromName} -> ${toName}: agregamos FK en ${toName}\n`;
        sql += `ALTER TABLE ${toName} ADD COLUMN IF NOT EXISTS ${fromName}_id BIGINT;\n`;
        sql += `ALTER TABLE ${toName} ADD CONSTRAINT IF NOT EXISTS fk_${toName}_${fromName} FOREIGN KEY (${fromName}_id) REFERENCES ${fromName}(id) ON DELETE SET NULL;\n\n`;
        return;
    }
    // Mismo pero invertido
    if ((multTo === '1' && multFrom.includes('*')) || (multTo === '1' && multFrom === '')) {
        sql += `-- Relación 1..* (o ?..1) de ${toName} -> ${fromName}: agregamos FK en ${fromName}\n`;
        sql += `ALTER TABLE ${fromName} ADD COLUMN IF NOT EXISTS ${toName}_id BIGINT;\n`;
        sql += `ALTER TABLE ${fromName} ADD CONSTRAINT IF NOT EXISTS fk_${fromName}_${toName} FOREIGN KEY (${toName}_id) REFERENCES ${toName}(id) ON DELETE SET NULL;\n\n`;
        return;
    }

    // Default fallback: crear FK en tabla 'to' apuntando a 'from'
    sql += `-- Relación (fallback) entre ${fromName} -> ${toName}: agregamos FK en ${toName}\n`;
    sql += `ALTER TABLE ${toName} ADD COLUMN IF NOT EXISTS ${fromName}_id BIGINT;\n`;
    sql += `ALTER TABLE ${toName} ADD CONSTRAINT IF NOT EXISTS fk_${toName}_${fromName} FOREIGN KEY (${fromName}_id) REFERENCES ${fromName}(id) ON DELETE SET NULL;\n\n`;
});

// Resumen
sql += `-- FIN del script generado\n`;

// Output
console.log(sql);

// ----------------- end of script -----------------
