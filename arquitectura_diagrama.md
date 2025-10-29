# 🏗️ Arquitectura Híbrida - Multi-Pizarra

## Diagrama de Arquitectura

```mermaid
graph TB
    %% Cliente Frontend
    subgraph "🖥️ Frontend (Cliente Web)"
        UI[📱 Interfaz de Usuario<br/>HTML5 + CSS3 + JavaScript]
        Canvas[🎨 Canvas API<br/>Renderizado de Pizarras]
        Speech[🎤 Web Speech API<br/>Reconocimiento de Voz]
        SocketClient[🔌 Socket.IO Client<br/>Comunicación Tiempo Real]
        HTTPClient[🌐 Fetch API<br/>Llamadas REST]
    end

    %% Backend Principal
    subgraph "🔧 Backend Principal (Node.js - Puerto 3000)"
        Express[⚡ Express.js<br/>Servidor Web]
        SocketServer[🔌 Socket.IO Server<br/>WebSockets]
        Routes[🛣️ Express Routes<br/>Controladores]
        Session[🔐 Express-Session<br/>Autenticación]
        Multer[📁 Multer<br/>Upload Archivos]
    end

    %% Base de Datos
    subgraph "🗄️ Persistencia"
        PostgreSQL[(🐘 PostgreSQL<br/>Base de Datos)]
        Pool[🏊 Connection Pool<br/>Gestión Conexiones]
    end

    %% Microservicio IA
    subgraph "🤖 Microservicio IA (Python - Puerto 5000)"
        Flask[🌶️ Flask<br/>API REST]
        Gemini[🧠 Google Gemini API<br/>Gemma-3n-e4b-it]
        UMLGen[📊 Generador UML<br/>JSON Estructurado]
    end

    %% Microservicio Detección
    subgraph "🔍 Microservicio Detección (Python)"
        YOLO[🎯 YOLO + PyTorch<br/>Detección UML]
        OpenCV[👁️ OpenCV<br/>Procesamiento Imágenes]
        Detector[🔍 UML Detector<br/>Análisis Automático]
    end

    %% Servicios Externos
    subgraph "☁️ Servicios Externos"
        GoogleAPI[🌐 Google Generative AI<br/>API Externa]
    end

    %% Conexiones Frontend
    UI --> Canvas
    UI --> Speech
    UI --> SocketClient
    UI --> HTTPClient

    %% Conexiones Backend
    Express --> SocketServer
    Express --> Routes
    Express --> Session
    Express --> Multer
    Routes --> Pool
    Pool --> PostgreSQL

    %% Comunicación Tiempo Real
    SocketClient <--> SocketServer

    %% Comunicación REST
    HTTPClient --> Flask
    Flask --> Gemini
    Gemini --> UMLGen

    %% Servicios de IA
    Flask --> GoogleAPI
    YOLO --> OpenCV
    OpenCV --> Detector

    %% Flujos de Datos
    SocketServer --> Routes
    Routes --> PostgreSQL
    Flask --> HTTPClient
    Detector --> HTTPClient

    %% Estilos
    classDef frontend fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef backend fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef database fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef microservice fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef external fill:#fce4ec,stroke:#880e4f,stroke-width:2px

    class UI,Canvas,Speech,SocketClient,HTTPClient frontend
    class Express,SocketServer,Routes,Session,Multer backend
    class PostgreSQL,Pool database
    class Flask,Gemini,UMLGen,YOLO,OpenCV,Detector microservice
    class GoogleAPI external
```

## 🔄 Flujos de Comunicación

### 1. Colaboración en Tiempo Real
```mermaid
sequenceDiagram
    participant U1 as Usuario A
    participant C as Cliente
    participant S as Socket.IO
    participant N as Node.js
    participant DB as PostgreSQL
    participant U2 as Usuario B

    U1->>C: Dibuja en Canvas
    C->>S: Emite 'ui-update'
    S->>N: Procesa evento
    N->>DB: Guarda cambios
    N->>S: Broadcast a sala
    S->>U2: Actualiza Canvas
```

### 2. Generación con IA
```mermaid
sequenceDiagram
    participant U as Usuario
    participant C as Cliente
    participant P as Python Flask
    participant G as Gemini API
    participant N as Node.js

    U->>C: Audio/Texto Prompt
    C->>P: POST /generate_uml_diagram
    P->>G: Procesa con IA
    G->>P: JSON UML
    P->>C: Respuesta JSON
    C->>N: Agrega a pizarra
    N->>C: Actualiza UI
```

### 3. Detección Automática
```mermaid
sequenceDiagram
    participant U as Usuario
    participant C as Cliente
    participant N as Node.js
    participant Y as YOLO Detector
    participant DB as PostgreSQL

    U->>C: Sube imagen
    C->>N: POST /detect-uml
    N->>Y: Procesa imagen
    Y->>N: Elementos detectados
    N->>DB: Guarda elementos
    N->>C: Actualiza pizarra
```

## 📊 Componentes por Capa

| Capa | Tecnología | Responsabilidad |
|------|------------|-----------------|
| **Frontend** | HTML5, CSS3, JavaScript | Interfaz de usuario, renderizado |
| **Comunicación** | Socket.IO, HTTP REST | Tiempo real, APIs |
| **Backend** | Node.js, Express.js | Lógica de negocio, autenticación |
| **Persistencia** | PostgreSQL | Almacenamiento de datos |
| **IA** | Python, Flask, Gemini | Generación de UML |
| **Detección** | Python, YOLO, OpenCV | Análisis de imágenes |

## 🎯 Patrones Arquitectónicos

- **MVC**: Separación de responsabilidades
- **Microservicios**: Servicios especializados
- **Event-Driven**: Comunicación asíncrona
- **RESTful**: APIs estándar
- **Real-time**: WebSockets para colaboración
