// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const Groq = require("groq-sdk");


const app = express();
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
const server = http.createServer(app);
const io = new Server(server);

/*
const db = new Pool({
  connectionString: 'postgres://usuario:password@localhost:5432/tu_basededatos'
});*/
const db = require('./datos/db.js');

// Funciones auxiliares para generar SQL
function sanitizeName(name) {
  // convertir a snake_case y caracteres válidos
  return name.trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'unnamed';
}

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

function addForeignKeyConstraint(tableName, columnName, referencedTable, constraintName, onDelete = 'SET NULL') {
  return `DO $$\n` +
         `BEGIN\n` +
         `  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = '${constraintName}') THEN\n` +
         `    ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${columnName}) REFERENCES ${referencedTable}(id) ON DELETE ${onDelete};\n` +
         `  END IF;\n` +
         `END $$;\n`;
}

function generarSQL(clases, relaciones, claseById) {
  let sql = '';
  sql += `-- Generado automáticamente desde la pizarra\n`;
  sql += `-- Fecha: ${new Date().toISOString()}\n`;
  sql += `-- Clases: ${clases.length}, Relaciones: ${relaciones.length}\n\n`;

  // Identificar clases intermedias para relaciones recursivas muchos a muchos
  const clasesIntermediasRecursivas = new Set();
  relaciones.forEach(rel => {
    const toName = claseById[rel.to]?.name;
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

    // Crear columnas a partir de atributos
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
  const relacionesProcesadas = new Set();
  relaciones.forEach(rel => {
    // Evitar procesar relaciones duplicadas de clases intermedias recursivas
    const relKey = `${rel.from}-${rel.to}`;
    if (relacionesProcesadas.has(relKey)) {
      return;
    }

    const fromName = claseById[rel.from]?.name;
    const toName = claseById[rel.to]?.name;

    // Si alguna clase no existe, saltar con comentario
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
      sql += `-- Relación recursiva simple en ${fromName}\n`;
      sql += `ALTER TABLE ${fromName} ADD COLUMN IF NOT EXISTS parent_id BIGINT;\n`;
      sql += `ALTER TABLE ${fromName} ADD CONSTRAINT fk_${fromName}_parent FOREIGN KEY (parent_id) REFERENCES ${fromName}(id) ON DELETE SET NULL;\n\n`;
      return;
    }

    // Manejo especial para relaciones de tipo 'Composition'
    if (rel.tipo === 'Composition') {
      sql += `-- Relación de Composición entre ${fromName} -> ${toName}\n`;
      sql += `-- La clase destino ${toName} tendrá llave primaria compuesta\n`;

      // Agregar columna de la clase origen en la tabla destino
      sql += `ALTER TABLE ${toName} ADD COLUMN IF NOT EXISTS ${fromName}_id BIGINT NOT NULL;\n`;

      // Crear llave primaria compuesta (id de destino + id de origen)
      sql += `ALTER TABLE ${toName} DROP CONSTRAINT IF EXISTS ${toName}_pkey;\n`;
      sql += `ALTER TABLE ${toName} ADD CONSTRAINT ${toName}_pkey PRIMARY KEY (id, ${fromName}_id);\n`;

      // Agregar foreign key constraint
      sql += `ALTER TABLE ${toName} ADD CONSTRAINT fk_${toName}_${fromName} FOREIGN KEY (${fromName}_id) REFERENCES ${fromName}(id) ON DELETE CASCADE;\n\n`;
      return;
    }

    // Manejo especial para relaciones de tipo 'Generalization' (Herencia)
    if (rel.tipo === 'Generalization') {
      sql += `-- Relación de Generalización (Herencia) entre ${fromName} -> ${toName}\n`;
      sql += `-- ${fromName} es la clase padre (superclase)\n`;
      sql += `-- ${toName} es la clase hija (subclase)\n`;

      // Implementar herencia usando tabla base con discriminador
      // La clase hija hereda de la clase padre
      sql += `-- Agregar columna de herencia en la clase hija\n`;
      sql += `ALTER TABLE ${toName} ADD COLUMN IF NOT EXISTS ${fromName}_id BIGINT;\n`;
      
      // Agregar foreign key constraint usando función auxiliar
      sql += addForeignKeyConstraint(toName, `${fromName}_id`, fromName, `fk_${toName}_${fromName}`, 'CASCADE');
      
      // Agregar columna discriminadora para identificar el tipo específico
      sql += `ALTER TABLE ${toName} ADD COLUMN IF NOT EXISTS tipo_${toName.toLowerCase()} VARCHAR(50) DEFAULT '${toName.toLowerCase()}';\n`;
      
      // Crear índice para mejorar rendimiento en consultas de herencia
      sql += `CREATE INDEX IF NOT EXISTS idx_${toName}_${fromName}_id ON ${toName}(${fromName}_id);\n`;
      sql += `CREATE INDEX IF NOT EXISTS idx_${toName}_tipo ON ${toName}(tipo_${toName.toLowerCase()});\n\n`;
      return;
    }

    // Manejo especial para relaciones de tipo 'Aggregation'
    if (rel.tipo === 'Aggregation') {
      sql += `-- Relación de Agregación (todo-parte débil) entre ${fromName} -> ${toName}\n`;
      sql += `-- El objeto "todo" (${fromName}) conoce a los objetos "parte" (${toName})\n`;
      sql += `-- Las partes pueden existir independientemente del todo\n`;

      // Determinar dirección de la relación basada en multiplicidades
      // Si el origen es '1' y destino es '*', agregar FK en destino
      if ((multFrom === '1' && multTo.includes('*')) || (multFrom === '1' && multTo === '')) {
        sql += `-- Relación 1..* de ${fromName} (todo) -> ${toName} (parte): agregamos FK en ${toName}\n`;
        sql += `ALTER TABLE ${toName} ADD COLUMN IF NOT EXISTS ${fromName}_id BIGINT;\n`;
        sql += addForeignKeyConstraint(toName, `${fromName}_id`, fromName, `fk_${toName}_${fromName}`, 'SET NULL');
        sql += `\n`;
        return;
      }

      // Si el destino es '1' y origen es '*', agregar FK en origen
      if ((multTo === '1' && multFrom.includes('*')) || (multTo === '1' && multFrom === '')) {
        sql += `-- Relación 1..* de ${toName} (todo) -> ${fromName} (parte): agregamos FK en ${fromName}\n`;
        sql += `ALTER TABLE ${fromName} ADD COLUMN IF NOT EXISTS ${toName}_id BIGINT;\n`;
        sql += addForeignKeyConstraint(fromName, `${toName}_id`, toName, `fk_${fromName}_${toName}`, 'SET NULL');
        sql += `\n`;
        return;
      }

      // Fallback: agregar FK en tabla destino (asumiendo que fromName es el "todo")
      sql += `-- Relación de agregación (fallback): agregamos FK en ${toName} (parte)\n`;
      sql += `ALTER TABLE ${toName} ADD COLUMN IF NOT EXISTS ${fromName}_id BIGINT;\n`;
      sql += addForeignKeyConstraint(toName, `${fromName}_id`, fromName, `fk_${toName}_${fromName}`, 'SET NULL');
      return;
    }

    // Many-to-many: ambos lados '*'
    const bothMany = (multFrom.includes('*') && multTo.includes('*'));

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
    if ((multFrom === '1' && multTo.includes('*')) || (multFrom === '1' && multTo === '')) {
      sql += `-- Relación 1..* (o 1..?) de ${fromName} -> ${toName}: agregamos FK en ${toName}\n`;
      sql += `ALTER TABLE ${toName} ADD COLUMN IF NOT EXISTS ${fromName}_id BIGINT;\n`;
      sql += addForeignKeyConstraint(toName, `${fromName}_id`, fromName, `fk_${toName}_${fromName}`, 'SET NULL');
      return;
    }

    // Mismo pero invertido
    if ((multTo === '1' && multFrom.includes('*')) || (multTo === '1' && multFrom === '')) {
      sql += `-- Relación 1..* (o ?..1) de ${toName} -> ${fromName}: agregamos FK en ${fromName}\n`;
      sql += `ALTER TABLE ${fromName} ADD COLUMN IF NOT EXISTS ${toName}_id BIGINT;\n`;
      sql += addForeignKeyConstraint(fromName, `${toName}_id`, toName, `fk_${fromName}_${toName}`, 'SET NULL');
      return;
    }

    // Default fallback: crear FK en tabla 'to' apuntando a 'from'
    sql += `-- Relación (fallback) entre ${fromName} -> ${toName}: agregamos FK en ${toName}\n`;
    sql += `ALTER TABLE ${toName} ADD COLUMN IF NOT EXISTS ${fromName}_id BIGINT;\n`;
    sql += addForeignKeyConstraint(toName, `${fromName}_id`, fromName, `fk_${toName}_${fromName}`, 'SET NULL');
  });

  // Resumen
  sql += `-- FIN del script generado\n`;
  sql += `-- Total de tablas creadas: ${clases.length}\n`;
  sql += `-- Total de relaciones procesadas: ${relaciones.length}\n`;

  return sql;
}




app.use(express.static('public'));
app.use(express.json());
app.use(session({ secret: 'supersecret', resave: false, saveUninitialized: false }));

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes.'));
    }
  }
});

app.set('view engine', 'ejs'); //EJS como motor de plantillas
app.set('views', __dirname + '/views');


//rutas

app.get('/', (req, res) => {
  res.render('login.ejs');
});

app.get('/index', (req, res) => { //ruta no utilizada
  res.render('proyectos', {
    login: true,
    email: req.session.email,
    user_id: req.session.userId,
  });
})

app.get('/logout', function (req, res) {
  req.session.destroy(() => {
    res.redirect('/')
  })
});

//db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
app.get('/proyectos', async (req, res) => {
  let id = req.session.userId;
  if (req.session.loggedin) {
    const results = await db.query('SELECT * FROM proyectos WHERE creador_id = $1', [id]);
    if (!results) {
      // Manejar el error, por ejemplo, enviar una respuesta de error
      res.status(500).send('Error en la consulta a la base de datos');
    } else {
      res.render('proyectos.ejs', {
        login: true,
        email: req.session.email,
        proyect: results.rows
      });
    }
  } else {
    // Manejar el caso en el que el usuario no esté autenticado
    res.status(401).send('No estás autenticado');
  }
});

/*
app.get('/colaboradores', async (req, res) => {
  let id = req.session.userId;
  if (req.session.loggedin) {
    const results = await db.query('SELECT * FROM colaboradores WHERE proyecto_id = $1', [id]);
    if (!results) {
      // Manejar el error, por ejemplo, enviar una respuesta de error
      res.status(500).send('Error en la consulta a la base de datos');
    } else {
      res.render('proyectos.ejs', {
        login: true,
        email: req.session.email,
        proyect: results.rows
      });
    }
  } else {
    // Manejar el caso en el que el usuario no esté autenticado
    res.status(401).send('No estás autenticado');
  }
});*/

app.get('/proyecto/:id', async (req, res) => {
  const id = req.params.id;
  try {
    if (req.session.loggedin) {
      const results = await db.query('SELECT * FROM proyectos WHERE id = $1', [id]);
      if (!results) {
        res.status(500).send('Error en la consulta a la base de datos');
      } else {
        res.render('proyecto.ejs', {
          login: true,
          proyect_id: id,
          proyect: results.rows
        });
      }
    } else {
      res.render('index', {
        login: false,
        name: 'Debe iniciar sesión',
      });
    }
  } catch (error) {
    console.error(error);
    res.render('error', {
      message: 'Proyecto no encontrado',
      error: error
    });
  }
});

app.get('/proyectocolaboracion/', async (req, res) => {
  let id = req.session.userId;
  if (req.session.loggedin) {
    const results = await db.query('SELECT proyecto_id,nombre FROM colaboradores,proyectos WHERE id=proyecto_id AND usuario_id = $1', [id]);
    if (!results) {
      // Manejar el error, por ejemplo, enviar una respuesta de error
      res.status(500).send('Error en la consulta a la base de datos');
    } else {
      res.render('proyectocolaboracion.ejs', {
        login: true,
        email: req.session.email,
        proyect: results.rows
      });
    }
  } else {
    // Manejar el caso en el que el usuario no esté autenticado
    res.status(401).send('No estás autenticado');
  }
});

app.get('/createproyecto/', async (req, res) => {
  try {
    if (req.session.loggedin) {
      res.render('createproyecto.ejs', {
        login: true,
        email: req.session.email,
      });
    } else {
      res.render('login.ejs', {
        login: false,
        name: 'Debe iniciar sesión',
      });
    }
  } catch (error) {
    console.error(error);
    res.render('error', {
      message: 'Error al crear proyecto',
      error: error
    });
  }
});

app.get('/agregacolaborador/:id', async (req, res) => {
  const id = req.params.id;
  try {
    if (req.session.loggedin) {
      const results = await db.query('SELECT email FROM colaboradores,usuarios WHERE usuario_id=id AND proyecto_id = $1', [id]);
      if (!results) {
        res.status(500).send('Error en la consulta a la base de datos');
      } else {
        res.render('agregacolaborador.ejs', {
          login: true,
          proyect_id: id,
          proyect: results.rows
        });
      }
    } else {
      res.render('index', {
        login: false,
        name: 'Debe iniciar sesión',
      });
    }
  } catch (error) {
    console.error(error);
    res.render('error', {
      message: 'Proyecto no encontrado',
      error: error
    });
  }
});



// Registro
app.post('/registro', async (req, res) => {
  const { email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await db.query('INSERT INTO usuarios (email, password_hash) VALUES ($1, $2)', [email, hash]);
  res.sendStatus(201);
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.sendStatus(401);
  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.loggedin = true; //para verificar si el usuario está logueado
  res.sendStatus(200);
});



// Crear proyecto
app.post('/proyectos', async (req, res) => {
  const { nombre } = req.body;
  const userId = req.session.userId;
  const proyecto = await db.query(
    'INSERT INTO proyectos (nombre, creador_id) VALUES ($1, $2) RETURNING id',
    [nombre, userId]
  );
  await db.query('INSERT INTO colaboradores (usuario_id, proyecto_id) VALUES ($1, $2)', [userId, proyecto.rows[0].id]);
  res.json({ proyectoId: proyecto.rows[0].id });
});

app.post('/createproyecto', async (req, res) => {
  const { nombre } = req.body;
  const userId = req.session.userId;
  const proyecto = await db.query(
    'INSERT INTO proyectos (nombre, creador_id) VALUES ($1, $2) RETURNING id',
    [nombre, userId]
  );
  res.json({ id: proyecto.rows[0].id });
  //res.redirect(`/proyecto/${proyecto.rows[0].id}`);
});

app.delete('/eliminarproyecto/:id', async (req, res) => {
  const { id } = req.params;
  await db.query('DELETE FROM proyectos WHERE id = $1', [id]);
  res.sendStatus(200);
});

// agregar colaborador a un proyecto
// Invitar colaborador
app.post('/invitar', async (req, res) => {
  const { email, proyecto_id } = req.body;
  const user = await db.query('SELECT id FROM usuarios WHERE email = $1', [email]);
  if (!user.rows.length) return res.status(404).send('Usuario no encontrado');
  await db.query('INSERT INTO colaboradores (usuario_id, proyecto_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [user.rows[0].id, proyecto_id]);
  res.sendStatus(200);
});

// Endpoint para generar script SQL desde elementos de la pizarra
app.post('/generar-sql', async (req, res) => {
  try {
    const { elementosPorPizarra } = req.body;

    if (!elementosPorPizarra || !Array.isArray(elementosPorPizarra)) {
      return res.status(400).json({ error: 'Datos de elementos no válidos' });
    }

    // Aplanar todas las pizarras a una lista de elementos
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

    // Asociaciones (Association / Composition / Aggregation / Generalization)
    const relaciones = elementos.filter(e => ['Association', 'Composition', 'Aggregation', 'Generalization'].includes(e.tipo)).map(r => {
      return {
        tipo: r.tipo,
        from: r.from,
        to: r.to,
        multOrigen: r.multOrigen || '',
        multDestino: r.multDestino || '',
        label: r.label || ''
      };
    });

    // Generar SQL
    const sql = generarSQL(clases, relaciones, claseById);

    res.json({
      success: true,
      sql: sql,
      estadisticas: {
        clases: clases.length,
        relaciones: relaciones.length,
        tablas: clases.length + relaciones.filter(r => {
          const multFrom = (r.multOrigen || '').trim();
          const multTo = (r.multDestino || '').trim();
          return multFrom.includes('*') && multTo.includes('*');
        }).length
      }
    });

  } catch (error) {
    console.error('Error al generar SQL:', error);
    res.status(500).json({ error: 'Error interno al generar el script SQL' });
  }
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Reemplaza el endpoint existente por este:
app.post('/procesar-comando-ia', async (req, res) => {
  try {
    const { comando, elementos } = req.body;
    
    const systemPrompt = `Eres un asistente que ayuda a modificar diagramas UML. 
    El usuario te dará instrucciones en lenguaje natural y tú debes devolver un JSON con los cambios a realizar.
    
    Formato de respuesta esperado:
    {
      "respuesta": "Mensaje de confirmación para el usuario",
      "cambios": {
        "agregar": [/* nuevos elementos */],
        "actualizar": [/* {id, campos} */],
        "eliminar": [/* ids de elementos a eliminar */]
      }
    }`;
    
    const userPrompt = `Elementos actuales del diagrama: ${JSON.stringify(elementos, null, 2)}
    
    Instrucción del usuario: "${comando}"
    
    Por favor, genera un JSON con los cambios necesarios. Responde ÚNICAMENTE con el JSON.`;
    
    // Llamar a la API de Groq
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: "llama-3.1-70b-versatile",
      temperature: 0.3,
      max_tokens: 4000
    });
    
    // Obtener la respuesta
    const respuesta = chatCompletion.choices[0]?.message?.content;
    let respuestaJson;
    
    try {
      // Extraer el JSON de la respuesta
      const jsonMatch = respuesta.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No se encontró un JSON válido en la respuesta');
      
      respuestaJson = JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error al parsear la respuesta de la IA:', error);
      throw new Error('Error al procesar la respuesta de la IA');
    }
    
    res.json(respuestaJson);
    
  } catch (error) {
    console.error('Error en /procesar-comando-ia:', error);
    res.status(500).json({
      respuesta: `Lo siento, hubo un error al procesar tu solicitud: ${error.message}`,
      cambios: null
    });
  }
});

// Endpoint para procesar imágenes con el detector UML personalizado
app.post('/procesar-imagen', upload.single('imagen'), async (req, res) => {
  let imagePath;
  let pythonProcess;
  const timeoutDuration = 120000; // 2 minutos de timeout
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

    imagePath = req.file.path;
    console.log('Procesando imagen UML con modelo personalizado:', imagePath);

    // Configurar el timeout para la respuesta HTTP
    const timeout = setTimeout(() => {
      if (pythonProcess) {
        pythonProcess.kill();
      }
      if (!res.headersSent) {
        res.status(408).json({ 
          error: 'Tiempo de espera agotado',
          details: 'El procesamiento de la imagen está tomando más tiempo de lo esperado. Por favor, intente con una imagen más pequeña o más simple.'
        });
      }
    }, timeoutDuration);

    // Función para limpiar recursos
    const cleanup = () => {
      clearTimeout(timeout);
      if (imagePath && fs.existsSync(imagePath)) {
        fs.unlink(imagePath, (err) => {
          if (err) console.error('Error al eliminar archivo temporal:', err);
        });
      }
    };

    // Set paths
    const scriptPath = path.join(__dirname, 'detect_uml.py');
    const weightsPath = path.resolve(__dirname, 'best.pt');
    
    console.log('Python script path:', scriptPath);
    console.log('Custom model path:', weightsPath);
    console.log('Model exists:', fs.existsSync(weightsPath));
    
    // Verify model file exists before proceeding
    if (!fs.existsSync(weightsPath)) {
        console.error('Error: Custom model not found at', weightsPath);
        return res.status(500).json({ 
            success: false,
            error: 'Modelo personalizado no encontrado',
            details: `No se encontró el archivo del modelo en: ${weightsPath}`,
            code: 'MODEL_NOT_FOUND'
        });
    }
    
    // Try with 'python3' first, fall back to 'python' if needed
    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    
    // Configure Python command with proper arguments
    const pythonProcess = spawn(pythonCommand, [
      scriptPath,
      '--weights', `"${weightsPath}"`,
      '--source', `"${imagePath}"`,
      '--conf', '0.5',
      '--imgsz', '640',
      '--device', '0'  // Use GPU if available, fallback to CPU
    ], {
      shell: true,  // Use shell to handle paths with spaces
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        YOLO_VERBOSE: 'False'  // Disable YOLO download messages
      }
    });
    
    // Set a timeout for the process (in milliseconds)
    const processTimeout = setTimeout(() => {
      if (!pythonProcess.killed) {
        pythonProcess.kill('SIGKILL');
      }
    }, 120000);  // 2 minutes timeout

    let result = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Error del proceso Python:', data.toString());
    });

    pythonProcess.on('error', (err) => {
      console.error('Error al iniciar el proceso Python:', err);
      console.error('Error details:', {
        code: err.code,
        errno: err.errno,
        syscall: err.syscall,
        path: err.path,
        spawnargs: err.spawnargs
      });
      
      cleanup();
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Error al iniciar el procesamiento de la imagen',
          details: `No se pudo ejecutar el comando Python. Asegúrate de que Python esté instalado y en el PATH. Error: ${err.message}`
        });
      }
    });

    pythonProcess.on('close', (code, signal) => {
      // Clear the process timeout
      clearTimeout(processTimeout);
      
      // Clean up resources
      cleanup();
      
      // If we've already sent a response, don't send another one
      if (res.headersSent) return;
      
      // Handle process exit
      if (code !== 0 || signal) {
        const errorMessage = signal 
          ? `Proceso terminado por señal: ${signal}`
          : `Código de salida: ${code}`;
          
        console.error('Error en el proceso de detección UML.');
        console.error(errorMessage);
        console.error('Salida de error:', errorOutput);
        
        let userMessage = 'Error al procesar la imagen UML';
        if (signal === 'SIGKILL') {
          userMessage = 'El procesamiento de la imagen tomó demasiado tiempo. Por favor, intente con una imagen más pequeña o simple.';
        }
        
        return res.status(500).json({
          error: userMessage,
          details: errorOutput || 'El proceso de detección falló con un error desconocido.'
        });
      }

      try {
        console.log('Respuesta del detector UML:', result);
        
        // Buscar el JSON válido en la respuesta
        const jsonStart = result.indexOf('[');
        const jsonEnd = result.lastIndexOf(']');
        
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error('No se encontró un resultado válido en la respuesta del modelo');
        }
        
        const jsonString = result.substring(jsonStart, jsonEnd + 1);
        console.log('Detecciones JSON extraídas:', jsonString);
        
        const detections = JSON.parse(jsonString);

        const elementosUML = detections.map(det => ({
          class: det.class || 'Class',
          x: Math.max(0, Math.floor(det.x || 0)),
          y: Math.max(0, Math.floor(det.y || 0)),
          w: Math.max(50, Math.min(300, Math.floor(det.w || 150))),
          h: Math.max(30, Math.min(200, Math.floor(det.h || 100))),
          confidence: det.confidence || 0.8
        }));

        console.log(`Procesados ${elementosUML.length} elementos UML`);
        
        res.json({
          success: true,
          elementos: elementosUML,
          total: elementosUML.length
        });
      } catch (parseError) {
        console.error('Error al procesar la respuesta del modelo UML:', parseError);
        console.error('Respuesta cruda:', result);
        res.status(500).json({
          error: 'Error al interpretar los resultados del modelo',
          details: 'El formato de la respuesta no es el esperado.'
        });
      }
    });

  } catch (error) {
    console.error('Error en /procesar-imagen:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Error interno del servidor',
        details: 'Ocurrió un error inesperado al procesar la imagen.'
      });
    }
  }
});

io.on('connection', (socket) => {
  socket.on('join-proyecto', async (proyectoId) => {
    socket.join(proyectoId);
    try {
      // Obtener pizarras del proyecto
      const pizarras = await db.query('SELECT * FROM pizarras WHERE proyecto_id = $1', [proyectoId]);

      // Si no hay pizarras, crear una por defecto
      if (pizarras.rows.length === 0) {
        const nuevaPizarra = await db.query(
          'INSERT INTO pizarras (proyecto_id, nombre) VALUES ($1, $2) RETURNING id',
          [proyectoId, 'Pizarra 1']
        );
        socket.emit('cargar-proyecto', [[]]);
      } else {
        // Obtener elementos de cada pizarra
        const elementosPorPizarra = [];
        for (const pizarra of pizarras.rows) {
          const elementos = await db.query(
            'SELECT * FROM elementos WHERE pizarra_id = $1',
            [pizarra.id]
          );

          // Procesar cada elemento
          const elementosProcesados = elementos.rows.map(e => {
            try {
              let propiedades = {};
              if (e.propiedades) {
                // Si propiedades es un string, intentar parsearlo
                if (typeof e.propiedades === 'string') {
                  propiedades = JSON.parse(e.propiedades);
                } else if (typeof e.propiedades === 'object') {
                  // Si ya es un objeto, usarlo directamente
                  propiedades = e.propiedades;
                }
              }

              // Asegurar que las propiedades básicas existan
              return {
                id: e.id,
                tipo: e.tipo,
                x: propiedades.x || 0,
                y: propiedades.y || 0,
                w: propiedades.w || 100,
                h: propiedades.h || 50,
                ...propiedades
              };
            } catch (error) {
              console.error('Error al procesar elemento:', error);
              // Devolver un elemento básico en caso de error
              return {
                id: e.id,
                tipo: e.tipo,
                x: 0,
                y: 0,
                w: 100,
                h: 50
              };
            }
          });

          elementosPorPizarra.push(elementosProcesados);
        }

        socket.emit('cargar-proyecto', elementosPorPizarra);
      }
    } catch (error) {
      console.error('Error al cargar proyecto:', error);
      socket.emit('error', 'Error al cargar el proyecto');
    }
  });

  socket.on('ui-update', async ({ proyectoId, data }) => {
    try {
      const elementos = JSON.parse(data);

      // Obtener pizarras existentes del proyecto
      const pizarrasExistentes = await db.query('SELECT * FROM pizarras WHERE proyecto_id = $1 ORDER BY id', [proyectoId]);

      // Si hay más pizarras en la BD que en los datos enviados, eliminar las sobrantes
      if (pizarrasExistentes.rows.length > elementos.length) {
        for (let i = elementos.length; i < pizarrasExistentes.rows.length; i++) {
          const pizarraAEliminar = pizarrasExistentes.rows[i];
          // Primero eliminar todos los elementos de la pizarra
          await db.query('DELETE FROM elementos WHERE pizarra_id = $1', [pizarraAEliminar.id]);
          // Luego eliminar la pizarra
          await db.query('DELETE FROM pizarras WHERE id = $1', [pizarraAEliminar.id]);
          console.log(`Pizarra eliminada: ${pizarraAEliminar.nombre} (ID: ${pizarraAEliminar.id})`);
        }
      }

      // Actualizar o crear pizarras según los datos enviados
      for (let i = 0; i < elementos.length; i++) {
        let pizarraId = pizarrasExistentes.rows[i]?.id;

        if (!pizarraId) {
          // Crear nueva pizarra si no existe
          const nuevaPizarra = await db.query(
            'INSERT INTO pizarras (proyecto_id, nombre) VALUES ($1, $2) RETURNING id',
            [proyectoId, `Pizarra ${i + 1}`]
          );
          pizarraId = nuevaPizarra.rows[0].id;
          console.log(`Nueva pizarra creada: Pizarra ${i + 1} (ID: ${pizarraId})`);
        }

        // Eliminar elementos existentes de esta pizarra
        await db.query('DELETE FROM elementos WHERE pizarra_id = $1', [pizarraId]);

        // Insertar nuevos elementos
        for (const el of elementos[i]) {
          // Crear objeto de propiedades sin el ID
          const propiedades = {
            x: el.x || 0,
            y: el.y || 0,
            w: el.w || 100,
            h: el.h || 50
          };

          // Agregar propiedades específicas según el tipo
          switch (el.tipo) {
            case 'Class':
              propiedades.id = el.id; // Mantener el ID original si existe
              propiedades.name = el.name || 'ClaseNueva';
              propiedades.attributes = el.attributes || ['+ atributo: Tipo'];
              propiedades.methods = el.methods || ['+ metodo(): Tipo'];
              break;
            case 'Association':
              propiedades.from = el.from;
              propiedades.to = el.to;
              propiedades.multOrigen = el.multOrigen || '';
              propiedades.multDestino = el.multDestino || '';
              propiedades.label = el.label || '';
              break;
            case 'Composition':
              propiedades.from = el.from;
              propiedades.to = el.to;
              propiedades.multOrigen = el.multOrigen || '';
              propiedades.multDestino = el.multDestino || '';
              propiedades.label = el.label || '';
              break;
            case 'Aggregation':
              propiedades.from = el.from;
              propiedades.to = el.to;
              propiedades.multOrigen = el.multOrigen || '';
              propiedades.multDestino = el.multDestino || '';
              propiedades.label = el.label || '';
              break;
            case 'Generalization':
              propiedades.from = el.from;
              propiedades.to = el.to;
              propiedades.multOrigen = el.multOrigen || '';
              propiedades.multDestino = el.multDestino || '';
              propiedades.label = el.label || '';
              break;
            case 'Button':
              propiedades.label = el.label || 'Button';
              if (typeof el.refPizarra === 'number') {
                propiedades.refPizarra = el.refPizarra; // <-- Guarda la referencia a la pizarra
              }
              break;
          }

          await db.query(
            'INSERT INTO elementos (pizarra_id, tipo, propiedades) VALUES ($1, $2, $3)',
            [pizarraId, el.tipo, JSON.stringify(propiedades)]
          );
        }
      }

      // Emitir actualización a todos los clientes en la sala
      socket.to(proyectoId).emit('ui-update', { data });
    } catch (error) {
      console.error('Error al actualizar UI:', error);
      socket.emit('error', 'Error al actualizar la interfaz');
    }
  });
});

// Test endpoint to verify Python environment
app.get('/test-python', (req, res) => {
  const { exec } = require('child_process');
  const path = require('path');
  
  // Test Python version
  exec('python --version', (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Python is not installed or not in PATH',
        details: error.message
      });
    }
    
    const pythonVersion = stdout || stderr;
    const scriptPath = path.join(__dirname, 'detect_uml.py');
    const weightsPath = path.join(__dirname, 'best.pt');
    
    // Check if required files exist
    const fs = require('fs');
    const fileChecks = {
      'detect_uml.py': fs.existsSync(scriptPath),
      'best.pt': fs.existsSync(weightsPath)
    };
    
    // Test Python script execution
    const testScript = `
import sys
import json
import os

try:
    result = {
        "python_version": sys.version,
        "executable": sys.executable,
        "platform": sys.platform,
        "cwd": os.getcwd(),
        "files": ${JSON.stringify(fileChecks)},
        "modules": {}
    }
    
    # Test module imports
    for module in ['torch', 'cv2', 'ultralytics']:
        try:
            __import__(module)
            result["modules"][module] = True
        except ImportError as e:
            result["modules"][module] = False
            result[module + "_error"] = str(e)
    
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e), "type": type(e).__name__}))
    `;
    
    exec(`python -c "${testScript.replace(/\n/g, ';')}"`, (error, stdout, stderr) => {
      let pythonInfo = {};
      let parseError = null;
      
      try {
        if (stdout) {
          pythonInfo = JSON.parse(stdout);
        }
      } catch (e) {
        parseError = e;
      }
      
      if (error || parseError) {
        return res.status(500).json({
          success: false,
          pythonVersion: pythonVersion.trim(),
          fileChecks,
          error: 'Error executing Python script',
          execError: error ? error.message : null,
          parseError: parseError ? parseError.message : null,
          stdout: stdout,
          stderr: stderr
        });
      }
      
      res.json({
        success: true,
        pythonVersion: pythonVersion.trim(),
        fileChecks,
        pythonInfo
      });
    });
  });
});

// Start the server
server.listen(3000, () => console.log('✅ Servidor en http://localhost:3000'));
