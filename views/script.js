// Variables globales
let socket;
let canvas;
let ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentPizarra = null;
let elementosPorPizarra = [];

// Inicializar socket y obtener ID del proyecto
document.addEventListener('DOMContentLoaded', () => {
    // Obtener el ID del proyecto
    const proyectoId = window.id;
    if (!proyectoId) {
        console.error('No se pudo obtener el ID del proyecto');
        return;
    }

    // Inicializar socket
    socket = io();
    socket.emit('join-proyecto', proyectoId);

    // Inicializar canvas y elementos
    const pizarras = document.getElementsByClassName('pizarra');
    const pizarrasContainer = document.getElementById('pizarras');
    let pizarraActual = 0;

    // Inicializar cada canvas
    Array.from(pizarras).forEach((canvas, i) => {
        initCanvas(canvas, i);
        dibujarCuadricula(canvas);
    });

    // Escuchar actualizaciones del servidor
    socket.on('ui-update', ({ data }) => {
        try {
            const parsed = JSON.parse(data);
            elementosPorPizarra = parsed;
            render();
        } catch (error) {
            console.error('Error al procesar datos del servidor:', error);
        }
    });

    // Escuchar carga inicial del proyecto
    socket.on('cargar-proyecto', (datos) => {
        try {
            elementosPorPizarra = datos;
            render();
        } catch (error) {
            console.error('Error al cargar proyecto:', error);
        }
    });
});

// Funciones de dibujo y manipulación de elementos
function initCanvas(canvas, index) {
    let seleccionado = null;
    let offsetX = 0, offsetY = 0;

    canvas.addEventListener('mousedown', e => {
        const { offsetX: x, offsetY: y } = e;
        const elementos = elementosPorPizarra[index] || [];
        seleccionado = elementos.find(el =>
            x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h
        );

        if (seleccionado) {
            offsetX = x - seleccionado.x;
            offsetY = y - seleccionado.y;
        }
    });

    canvas.addEventListener('mousemove', e => {
        if (seleccionado) {
            seleccionado.x = e.offsetX - offsetX;
            seleccionado.y = e.offsetY - offsetY;
            render();
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (seleccionado) {
            emitUI();
            seleccionado = null;
        }
    });

    // Doble clic para editar
    canvas.addEventListener('dblclick', e => {
        const { offsetX: x, offsetY: y } = e;
        const elementos = elementosPorPizarra[index] || [];
        const elemento = elementos.find(el =>
            x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h
        );

        if (elemento) {
            editarElemento(elemento);
        }
    });
}

function editarElemento(elemento) {
    let nuevoValor;
    switch (elemento.tipo) {
        case 'Button':
            nuevoValor = prompt('Texto del botón:', elemento.label || 'Button');
            if (nuevoValor !== null) elemento.label = nuevoValor;
            break;
        case 'Input':
            nuevoValor = prompt('Valor del input:', elemento.value || '');
            if (nuevoValor !== null) elemento.value = nuevoValor;
            break;
        case 'Title':
        case 'Subtitle':
        case 'Heading':
        case 'Subheading':
        case 'Caption':
            nuevoValor = prompt('Texto:', elemento.text || elemento.tipo);
            if (nuevoValor !== null) elemento.text = nuevoValor;
            break;
    }
    if (nuevoValor !== null) {
        render();
        emitUI();
    }
}

function render() {
    const pizarras = document.getElementsByClassName('pizarra');
    Array.from(pizarras).forEach((_, i) => dibujarPizarra(i));
}

function dibujarPizarra(index) {
    const canvas = getCanvas(index);
    const ctx = getContext(index);
    ctx.clearRect(0, 0, 400, 550);
    dibujarCuadricula(canvas);

    const elementos = elementosPorPizarra[index] || [];
    elementos.forEach(el => {
        dibujarElemento(ctx, el);
    });
}

function dibujarElemento(ctx, el) {
    switch (el.tipo) {
        case 'Class':
            dibujarClaseUML(ctx, el);
            break;
        // Aquí puedes agregar Association, Inheritance, etc.
        default:
            dibujarElementoBasico(ctx, el);
    }
}

function dibujarBoton(ctx, el) {
    ctx.fillStyle = '#6200EE';
    ctx.strokeStyle = '#3700B3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(el.x, el.y, el.w, el.h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = '16px Roboto';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.label || 'Button', el.x + el.w / 2, el.y + el.h / 2);
}

function dibujarInput(ctx, el) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(el.x + 5, el.y + 25, el.w - 10, el.h - 30);
    ctx.strokeRect(el.x + 5, el.y + 25, el.w - 10, el.h - 30);
    ctx.fillStyle = '#000';
    ctx.font = '14px Roboto';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.value || '', el.x + 10, el.y + 45);
}

function dibujarTexto(ctx, el) {
    let fontSize;
    switch (el.tipo) {
        case 'Title': fontSize = 'bold 24px'; break;
        case 'Subtitle': fontSize = 'bold 20px'; break;
        case 'Heading': fontSize = 'bold 18px'; break;
        case 'Subheading': fontSize = 'bold 16px'; break;
        case 'Caption': fontSize = '14px'; break;
        default: fontSize = '16px';
    }

    ctx.font = `${fontSize} Roboto`;
    ctx.fillStyle = '#000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(el.text || el.tipo, el.x, el.y);
}

function dibujarCard(ctx, el) {
    // Fondo
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(el.x, el.y, el.w, el.h, 8);
    ctx.fill();
    ctx.stroke();

    // Contenido
    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px Roboto';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(el.title || 'Card Title', el.x + 16, el.y + 16);

    ctx.font = '14px Roboto';
    ctx.fillText(el.content || 'Card content goes here', el.x + 16, el.y + 40);
}

function dibujarAppBar(ctx, el) {
    // Fondo
    ctx.fillStyle = '#6200EE';
    ctx.fillRect(el.x, el.y, el.w, el.h);

    // Título
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Roboto';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.title || 'App Bar', el.x + el.w / 2, el.y + el.h / 2);
}

function dibujarTabBar(ctx, el) {
    const tabWidth = el.w / (el.tabs?.length || 1);

    // Fondo
    ctx.fillStyle = '#fff';
    ctx.fillRect(el.x, el.y, el.w, el.h);

    // Tabs
    (el.tabs || ['Tab 1']).forEach((tab, i) => {
        const isSelected = i === (el.selectedTab || 0);
        ctx.fillStyle = isSelected ? '#6200EE' : '#fff';
        ctx.fillRect(el.x + i * tabWidth, el.y, tabWidth, el.h);

        ctx.fillStyle = isSelected ? '#fff' : '#000';
        ctx.font = '14px Roboto';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tab, el.x + i * tabWidth + tabWidth / 2, el.y + el.h / 2);
    });
}

function dibujarFAB(ctx, el) {
    ctx.beginPath();
    ctx.arc(el.x + el.w / 2, el.y + el.h / 2, el.w / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#6200EE';
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = '24px Roboto';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', el.x + el.w / 2, el.y + el.h / 2);
}

function dibujarSearch(ctx, el) {
    // Fondo
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(el.x, el.y, el.w, el.h, 20);
    ctx.fill();
    ctx.stroke();

    // Icono de búsqueda
    ctx.beginPath();
    ctx.arc(el.x + 20, el.y + el.h / 2, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(el.x + 25, el.y + el.h / 2 + 5);
    ctx.lineTo(el.x + 35, el.y + el.h / 2 + 15);
    ctx.stroke();

    // Texto
    ctx.fillStyle = '#666';
    ctx.font = '14px Roboto';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.placeholder || 'Search...', el.x + 40, el.y + el.h / 2);
}

function dibujarNavigationRail(ctx, el) {
    const itemHeight = el.h / (el.items?.length || 1);

    // Fondo
    ctx.fillStyle = '#fff';
    ctx.fillRect(el.x, el.y, el.w, el.h);

    // Items
    (el.items || ['Item 1']).forEach((item, i) => {
        const isSelected = i === (el.selectedIndex || 0);
        ctx.fillStyle = isSelected ? '#e3f2fd' : '#fff';
        ctx.fillRect(el.x, el.y + i * itemHeight, el.w, itemHeight);

        ctx.fillStyle = isSelected ? '#6200EE' : '#666';
        ctx.font = '14px Roboto';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item, el.x + el.w / 2, el.y + i * itemHeight + itemHeight / 2);
    });
}

function dibujarDataTable(ctx, el) {
    const { columns = ['Col 1', 'Col 2'], rows = [['', '']] } = el;
    const colWidth = el.w / columns.length;
    const rowHeight = 30;

    // Encabezados
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(el.x, el.y, el.w, rowHeight);
    ctx.strokeRect(el.x, el.y, el.w, rowHeight);

    columns.forEach((col, i) => {
        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px Roboto';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(col, el.x + i * colWidth + colWidth / 2, el.y + rowHeight / 2);
    });

    // Filas
    rows.forEach((row, r) => {
        row.forEach((cell, c) => {
            ctx.strokeRect(el.x + c * colWidth, el.y + (r + 1) * rowHeight, colWidth, rowHeight);
            ctx.fillStyle = '#000';
            ctx.font = '14px Roboto';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cell, el.x + c * colWidth + colWidth / 2, el.y + (r + 1) * rowHeight + rowHeight / 2);
        });
    });
}

function dibujarClaseUML(ctx, el) {
    // Rectángulo principal
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(el.x, el.y, el.w, el.h);
    ctx.strokeRect(el.x, el.y, el.w, el.h);

    // Nombre de la clase
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.fillText(el.name, el.x + el.w / 2, el.y + 20);

    // Línea separadora
    ctx.beginPath();
    ctx.moveTo(el.x, el.y + 30);
    ctx.lineTo(el.x + el.w, el.y + 30);
    ctx.stroke();

    // Atributos
    ctx.font = '14px Arial';
    el.attributes.forEach((attr, i) => {
        ctx.fillText(attr, el.x + 10, el.y + 50 + i * 18);
    });

    // Métodos
    const attrHeight = el.attributes.length * 18;
    ctx.beginPath();
    ctx.moveTo(el.x, el.y + 50 + attrHeight);
    ctx.lineTo(el.x + el.w, el.y + 50 + attrHeight);
    ctx.stroke();

    el.methods.forEach((meth, i) => {
        ctx.fillText(meth, el.x + 10, el.y + 70 + attrHeight + i * 18);
    });
}

function dibujarElementoBasico(ctx, el) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(el.x, el.y, el.w, el.h);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#000';
    ctx.fillText(el.tipo, el.x + 10, el.y + 20);
}

function dibujarCuadricula(canvas, gridSize = 20) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;

    for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
}



function addElement(tipo) {
    const nuevo = {
        tipo,
        x: 50,
        y: 60 + (elementosPorPizarra[pizarraActual]?.length || 0) * 120,
        w: 180,
        h: 100,
        id: Date.now() + Math.random(),
    };

    switch (tipo) {
        case 'Class':
            nuevo.name = 'ClaseNueva';
            nuevo.attributes = ['+ atributo: Tipo'];
            nuevo.methods = ['+ metodo(): Tipo'];
            break;
        case 'Association':
            nuevo.from = null; // id de clase origen
            nuevo.to = null;   // id de clase destino
            nuevo.label = '';
            break;
        case 'Inheritance':
            nuevo.parent = null; // id de clase padre
            nuevo.child = null;  // id de clase hijo
            break;
    }

    if (!elementosPorPizarra[pizarraActual]) {
        elementosPorPizarra[pizarraActual] = [];
    }
    elementosPorPizarra[pizarraActual].push(nuevo);
    render();
    emitUI();
}

function emitUI() {
    socket.emit('ui-update', {
        proyectoId: window.id,
        data: JSON.stringify(elementosPorPizarra)
    });
}

// Funciones de utilidad
function getCanvas(index) {
    return document.getElementsByClassName('pizarra')[index];
}

function getContext(index) {
    return getCanvas(index).getContext('2d');
}

function mostrarPizarra(index) {
    const pizarras = document.getElementsByClassName('pizarra');
    for (let i = 0; i < pizarras.length; i++) {
        pizarras[i].style.display = (i === index) ? 'block' : 'none';
    }
    pizarraActual = index;
    render();
}

function agregarNuevaPizarra() {
    const pizarrasContainer = document.getElementById('pizarras');
    const nueva = document.createElement('canvas');
    nueva.className = 'pizarra';
    nueva.width = 400;
    nueva.height = 550;
    nueva.style.display = 'none';
    pizarrasContainer.appendChild(nueva);

    const nuevoIndex = document.getElementsByClassName('pizarra').length - 1;
    const boton = document.createElement('button');
    boton.textContent = `Pizarra ${nuevoIndex + 1}`;
    boton.onclick = () => mostrarPizarra(nuevoIndex);
    document.getElementById('canvas-selector').insertBefore(
        boton,
        document.getElementById('canvas-selector').lastElementChild
    );

    elementosPorPizarra[nuevoIndex] = [];
    initCanvas(nueva, nuevoIndex);
    dibujarCuadricula(nueva);
}

// Función para cargar y procesar imagen de diagrama UML
function cargarImagen(event, pizarraIndex) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('imagen', file);

    // Mostrar indicador de carga
    const loadingIndicator = document.createElement('div');
    loadingIndicator.style.position = 'fixed';
    loadingIndicator.style.top = '50%';
    loadingIndicator.style.left = '50%';
    loadingIndicator.style.transform = 'translate(-50%, -50%)';
    loadingIndicator.style.padding = '20px';
    loadingIndicator.style.background = 'rgba(0, 0, 0, 0.8)';
    loadingIndicator.style.color = 'white';
    loadingIndicator.style.borderRadius = '5px';
    loadingIndicator.style.zIndex = '1000';
    loadingIndicator.textContent = 'Procesando diagrama UML...';
    document.body.appendChild(loadingIndicator);

    fetch('/procesar-imagen', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error || `HTTP error! status: ${response.status}`);
            }).catch(() => {
                throw new Error(`HTTP error! status: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Limpiar elementos existentes en la pizarra actual
        elementosPorPizarra[pizarraIndex] = [];
        
        // Procesar los elementos detectados
        data.elementos.forEach(elemento => {
            const nuevoElemento = {
                tipo: elemento.class.toLowerCase(),
                x: elemento.x,
                y: elemento.y,
                w: elemento.w,
                h: elemento.h,
                texto: elemento.class,
                id: Date.now() + Math.random().toString(36).substr(2, 9)
            };
            
            // Ajustar propiedades según el tipo de elemento
            switch(elemento.class.toLowerCase()) {
                case 'class':
                    nuevoElemento.atributos = ['+ atributo1: string', '- atributo2: int'];
                    nuevoElemento.metodos = ['+ metodo1()', '+ metodo2()'];
                    break;
                case 'interface':
                    nuevoElemento.metodos = ['+ metodo1()', '+ metodo2()'];
                    break;
                // Agregar más casos según sea necesario para otros tipos de elementos UML
            }
            
            elementosPorPizarra[pizarraIndex].push(nuevoElemento);
        });
        
        render();
        emitUI();
    })
    .catch(error => {
        console.error('Error al procesar la imagen:', error);
        alert('Error al procesar el diagrama UML: ' + error.message);
    })
    .finally(() => {
        // Limpiar el input de archivo
        event.target.value = '';
        // Eliminar indicador de carga
        if (document.body.contains(loadingIndicator)) {
            document.body.removeChild(loadingIndicator);
        }
    });
}

// Extensión para CanvasRenderingContext2D: rectángulo redondeado
CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
    if (typeof radius === 'number') {
        radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else {
        const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
        for (let side in defaultRadius) {
            radius[side] = radius[side] || defaultRadius[side];
        }
    }
    this.beginPath();
    this.moveTo(x + radius.tl, y);
    this.lineTo(x + width - radius.tr, y);
    this.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    this.lineTo(x + width, y + height - radius.br);
    this.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    this.lineTo(x + radius.bl, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    this.lineTo(x, y + radius.tl);
    this.quadraticCurveTo(x, y, x + radius.tl, y);
    this.closePath();
};