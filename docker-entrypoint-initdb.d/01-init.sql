CREATE DATABASE pizarra;

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE proyectos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  creador_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE pizarras (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL
);

CREATE TABLE colaboradores (
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  proyecto_id INTEGER REFERENCES proyectos(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, proyecto_id)
);

CREATE TABLE elementos (
  id SERIAL PRIMARY KEY,
  pizarra_id INTEGER REFERENCES pizarras(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  propiedades JSONB NOT NULL
);