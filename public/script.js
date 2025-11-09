// Variables globales
let socket;
let canvas;
let ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentPizarra = null;
let elementosPorPizarra = [];
let pizarraActual = 0; // Variable global para la pizarra actual

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

    // Inicializar cada canvas
    Array.from(pizarras).forEach((canvas, i) => {
        initCanvas(canvas, i);
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

            // Crear las pizarras adicionales si hay más datos
            if (datos.length > 1) {
                for (let i = 1; i < datos.length; i++) {
                    crearNuevaPizarraUI(i);
                }
            }

            render();
            // Mostrar la primera pizarra por defecto
            mostrarPizarra(0);
        } catch (error) {
            console.error('Error al cargar el proyecto:', error);
        }
    });

    // Escuchar elementos detectados por IA
socket.on('elementos_detectados', (data) => {
    try {
        console.log('Elementos detectados recibidos:', data);
        
        if (data && data.elementos && data.elementos.length > 0) {
            
            // 1. Borra la pizarra actual para cargar los nuevos datos de la IA
            elementosPorPizarra[pizarraActual] = [];
            
            // 2. Mapa para las relaciones
            const elementosMap = new Map();

            // 3. Mapa de tipos de relación (esto sigue siendo necesario)
            const tipoRelacionMap = {
                'Asociacion': 'Association',
                'Generalizacion': 'Generalization',
                'Composicion': 'Composition',
                'Agregacion': 'Aggregation'
            };
            
            // 4. Agregar elementos (YA NO SE NECESITA TRADUCCIÓN NI PARCHES)
            // El servidor ya envía los datos en el formato perfecto (name, attributes, w, h, etc.)
            if (Array.isArray(data.elementos)) {
                data.elementos.forEach(elemento => {
                    // Simplemente copiamos el elemento. No hay nada que traducir.
                    const nuevoElemento = { ...elemento }; 
                    
                    elementosMap.set(nuevoElemento.id, nuevoElemento);
                    elementosPorPizarra[pizarraActual].push(nuevoElemento);
                });
            }
            
            // 5. Agregar relaciones (esto funciona igual)
            if (Array.isArray(data.relaciones)) {
                data.relaciones.forEach(relacion => {
                    const desdeElemento = elementosMap.get(relacion.desde);
                    const haciaElemento = elementosMap.get(relacion.hacia);
                    
                    if (desdeElemento && haciaElemento) {
                        const nuevaRelacion = {
                            id: relacion.id || `rel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            tipo: tipoRelacionMap[relacion.tipo] || 'Association',
                            from: desdeElemento.id,
                            to: haciaElemento.id,
                            label: relacion.etiqueta || ''
                        };
                        elementosPorPizarra[pizarraActual].push(nuevaRelacion);
                    } else {
                        console.warn('No se pudo crear la relación. Elementos no encontrados:', {
                            desde: relacion.desde,
                            hacia: relacion.hacia
                        });
                    }
                });
            }
            
            console.log('Elementos actualizados en la pizarra:', elementosPorPizarra[pizarraActual]);
            
            render();
            emitUI();
            
            mostrarNotificacion('Elementos detectados y cargados correctamente', 'success');
        } else {
            console.error('Formato de datos inválido para elementos detectados:', data);
            mostrarNotificacion('Error: Formato de datos inválido', 'error');
        }
    } catch (error) {
        console.error('Error al procesar elementos detectados:', error);
        mostrarNotificacion('Error al procesar elementos: ' + error.message, 'error');
    }
});

    // Manejo de eventos de teclado
    document.addEventListener('keydown', (e) => {

        if (e.ctrlKey && e.key.toLowerCase() === 'g') {
            // Buscar el elemento seleccionado en la pizarra actual
            const canvas = getCanvas(pizarraActual);
            const elementos = elementosPorPizarra[pizarraActual] || [];
            // Suponiendo que tienes una variable global 'seleccionado' o puedes obtener el último seleccionado
            if (window.ultimoSeleccionado && window.ultimoSeleccionado.tipo === 'Button' && typeof window.ultimoSeleccionado.refPizarra === 'number') {
                mostrarPizarra(window.ultimoSeleccionado.refPizarra);
                mostrarNotificacion(`Navegaste a la pizarra ${window.ultimoSeleccionado.refPizarra + 1} por atajo`, 'info');
            }
        }
        // Solo manejar eventos si estamos en la página del proyecto
        if (window.id && e.key === 'Delete') {
            // Encontrar elemento seleccionado en la pizarra actual
            // Esta funcionalidad se podría expandir para rastrear selección
            console.log('Tecla Delete presionada - funcionalidad disponible via clic derecho');
        }
    });
});


// Variables para asociación UML
let modoAsociacion = false;
let claseOrigen = null;

// Llama esto al hacer clic en el botón "Asociación"
function iniciarAsociacion() {
    modoAsociacion = true;
    claseOrigen = null;
    mostrarNotificacion('Haz clic en la clase origen y luego en la clase destino para crear la asociación.', 'info');
}

// Funciones de dibujo y manipulación de elementos
function initCanvas(canvas, index) {
    let seleccionado = null;
    let offsetX = 0, offsetY = 0;
    let isResizing = false;
    let resizeStartX = 0, resizeStartY = 0;
    let resizeStartWidth = 0, resizeStartHeight = 0;

    // Agregar evento para el botón derecho del mouse
    canvas.addEventListener('contextmenu', e => {
        e.preventDefault();
        const { offsetX: x, offsetY: y } = e;
        const elementos = elementosPorPizarra[index] || [];

        const elemento = elementos.find(el =>
            x >= el.x && x <= el.x + (el.w || 0) && y >= el.y && y <= el.y + (el.h || 0)
        );

        // Detección de relaciones (Association, Composition y Aggregation)
        if (!elemento) {
            // Busca si el clic está cerca de una línea de asociación o composición
            const relacion = elementos.find(el =>
                (el.tipo === 'Association' || el.tipo === 'Composition' || el.tipo === 'Aggregation' || el.tipo === 'Generalization') &&
                isNearAssociationLine(x, y, el, elementos)
            );
            if (relacion) {
                if (confirm('¿Deseas eliminar esta relación?')) {
                    const indice = elementos.findIndex(el => el === relacion);
                    if (indice !== -1) {
                        elementos.splice(indice, 1);
                        render();
                        emitUI();
                    }
                }
                return;
            }
        }

        if (elemento) {
            let mensaje = elemento.tipo === 'Association' || elemento.tipo === 'Composition' || elemento.tipo === 'Aggregation' || elemento.tipo === 'Generalization'
                ? '¿Deseas eliminar esta relación?'
                : '¿Deseas eliminar este elemento?';
            if (confirm(mensaje)) {
                // Si es clase intermedia, elimina también las asociaciones conectadas
                // Si es una clase, elimina todas las asociaciones conectadas (como origen o destino)
                if (elemento.tipo === 'Class') {
                    for (let i = elementos.length - 1; i >= 0; i--) {
                        const el = elementos[i];
                        if ((el.tipo === 'Association' || el.tipo === 'Composition' || el.tipo === 'Aggregation' || el.tipo === 'Generalization') && (el.from === elemento.id || el.to === elemento.id)) { //agregar relaciones para que se eliminen cuando la clase se elimina
                            elementos.splice(i, 1);
                        }
                    }
                }
                const indice = elementos.findIndex(el => el === elemento);
                if (indice !== -1) {
                    elementos.splice(indice, 1);
                    render();
                    emitUI();
                }
            }
        }
    });


    canvas.addEventListener('mousedown', e => {
        const { offsetX: x, offsetY: y } = e;
        const elementos = elementosPorPizarra[index] || [];
        seleccionado = elementos.find(el =>
            x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h
        );
        window.ultimoSeleccionado = seleccionado;

        // Verificar si se hizo clic en el controlador de redimensionamiento
        if (seleccionado) {
            const handleSize = 8;
            const { x: ex, y: ey, w, h } = seleccionado;
            if (x >= ex + w - handleSize && x <= ex + w &&
                y >= ey + h - handleSize && y <= ey + h) {
                isResizing = true;
                resizeStartX = x;
                resizeStartY = y;
                resizeStartWidth = seleccionado.w;
                resizeStartHeight = seleccionado.h;
                return;
            }
        }

        if (seleccionado) {
            offsetX = x - seleccionado.x;
            offsetY = y - seleccionado.y;
        }

    });

    canvas.addEventListener('mousemove', e => {
        const { offsetX: x, offsetY: y } = e;

        if (isResizing && seleccionado) {
            const deltaX = x - resizeStartX;
            const deltaY = y - resizeStartY;

            seleccionado.w = Math.max(50, resizeStartWidth + deltaX);
            seleccionado.h = Math.max(30, resizeStartHeight + deltaY);

            render();
            return;
        }

        if (seleccionado) {
            seleccionado.x = x - offsetX;
            seleccionado.y = y - offsetY;
            render();
        }

        // Cambiar cursor según la posición
        if (seleccionado) {
            const handleSize = 8;
            const { x: ex, y: ey, w, h } = seleccionado;
            if (x >= ex + w - handleSize && x <= ex + w &&
                y >= ey + h - handleSize && y <= ey + h) {
                canvas.style.cursor = 'nwse-resize';
            } else {
                canvas.style.cursor = 'move';
            }
        } else {
            canvas.style.cursor = 'default';
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (isResizing || seleccionado) {
            isResizing = false;
            seleccionado = null;
            render();
            emitUI();
            canvas.style.cursor = 'default';
        }
    });

    // Doble clic para editar
    //evento para editar el elemento
    canvas.addEventListener('dblclick', e => {
        const { offsetX: x, offsetY: y } = e;
        const elementos = elementosPorPizarra[index] || [];
        // Primero busca elementos con área (clases, etc.)
        let elemento = elementos.find(el =>
            x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h
        );
        // Si no hay, busca si el doble clic está cerca de una línea de asociación
        if (!elemento) {
            elemento = elementos.find(el =>
                el.tipo === 'Association' && isNearAssociationLine(x, y, el, elementos)
            );
        }
        if (elemento) {
            editarElemento(elemento);
        }
    });
}

// Función para saber si el clic está cerca de una línea de asociación
function isNearAssociationLine(x, y, asoc, elementos) {
    const claseFrom = elementos.find(e => e.tipo === 'Class' && e.id === asoc.from);
    const claseTo = elementos.find(e => e.tipo === 'Class' && e.id === asoc.to);
    if (!claseFrom || !claseTo) return false;

    if (asoc.from === asoc.to) {
        // Detección para bucle recursivo
        const loopRadius = 50;
        const cx = claseFrom.x + claseFrom.w - loopRadius;
        const cy = claseFrom.y + 20;
        // Distancia del punto al centro del bucle
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        // Considera cerca si está a unos 15 píxeles del radio del bucle
        return Math.abs(dist - loopRadius) < 15;
    }

    // Detección para línea normal
    const x1 = claseFrom.x + claseFrom.w / 2;
    const y1 = claseFrom.y + claseFrom.h / 2;
    const x2 = claseTo.x + claseTo.w / 2;
    const y2 = claseTo.y + claseTo.h / 2;
    const dist = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) /
        Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);
    return dist < 10;
}

function editarElemento(elemento) {
    let nuevoValor;
    switch (elemento.tipo) {
        case 'Class':
            mostrarModalUML(elemento);
            return;
        case 'Association':
            // Permitir editar la etiqueta y multiplicidades
            let nuevaEtiqueta = prompt('Etiqueta de la relación:', elemento.label || '');
            if (nuevaEtiqueta !== null) elemento.label = nuevaEtiqueta;

            let nuevaMultOrigen = prompt('Multiplicidad origen:', elemento.multOrigen || '');
            if (nuevaMultOrigen !== null) elemento.multOrigen = nuevaMultOrigen;

            let nuevaMultDestino = prompt('Multiplicidad destino:', elemento.multDestino || '');
            if (nuevaMultDestino !== null) elemento.multDestino = nuevaMultDestino;

            render();
            emitUI();
            return;
    }
    if (nuevoValor !== null) {
        render();
        emitUI();
    }
}

function render() {
    // Solo dibujar la pizarra actual para mejor rendimiento
    dibujarPizarra(pizarraActual);
}

function dibujarPizarra(index) {
    const canvas = getCanvas(index);
    const ctx = getContext(index);
    ctx.clearRect(0, 0, 400, 550);

    // Fondo blanco sin cuadrícula
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const elementos = elementosPorPizarra[index] || [];

    // 1. Dibuja primero todas las asociaciones
    elementos.filter(el => el.tipo === 'Association').forEach(el => {
        dibujarElemento(ctx, el);
    });

    // 2. Luego dibuja el resto de elementos (clases, etc.)
    elementos.filter(el => el.tipo !== 'Association').forEach(el => {
        dibujarElemento(ctx, el);
    });
}

function dibujarElemento(ctx, el) {
    switch (el.tipo) {
        case 'Class':
            dibujarClaseUML(ctx, el);
            break;
        case 'Association':
            dibujarAsociacionUML(ctx, el);
            break;
        case 'Composition':
            dibujarComposicionUML(ctx, el);
            break;
        case 'Aggregation':
            dibujarAgregacionUML(ctx, el);
            break;
        case 'Generalization':
            dibujarGeneralizacionUML(ctx, el);
            break;
        default:
            dibujarElementoBasico(ctx, el);
    }
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

function dibujarClaseUML(ctx, el) {
    // Dimensiones y estilos
    const { x, y, w, h, name, attributes = [], methods = [] } = el;
    const padding = 10;
    const sectionHeight = 28;
    const attrHeight = attributes.length * 20;
    const methHeight = methods.length * 20;
    // El alto real es el máximo entre el alto calculado y el alto definido por el usuario
    const contentHeight = sectionHeight + attrHeight + methHeight;
    const realHeight = Math.max(h, contentHeight);

    ctx.save();

    // Fondo y borde principal
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#fdf6e3';
    ctx.shadowColor = '#bbb';
    ctx.shadowBlur = 6;
    ctx.fillRect(x, y, w, realHeight);
    ctx.shadowBlur = 0;
    ctx.strokeRect(x, y, w, realHeight);

    // Nombre de la clase (centrado, negrita, fondo sutil)
    ctx.fillStyle = '#f5e9c9';

    if (el.name && (el.name.toLowerCase().includes('intermedia') || el.name.includes('_'))) {
        ctx.fillStyle = '#e0f7fa'; // Azul claro para clase intermedia
    } else {
        ctx.fillStyle = '#fdf6e3';
    }
    ctx.fillRect(x, y, w, realHeight);
    ctx.fillRect(x, y, w, sectionHeight);

    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + w / 2, y + sectionHeight / 2);

    // Línea separadora atributos
    ctx.beginPath();
    ctx.moveTo(x, y + sectionHeight);
    ctx.lineTo(x + w, y + sectionHeight);
    ctx.stroke();

    // Atributos
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2d3436';
    attributes.forEach((attr, i) => {
        ctx.fillText(attr, x + padding, y + sectionHeight + 16 + i * 20);
    });

    // Línea separadora métodos (solo si hay atributos)
    const methodSectionY = y + sectionHeight + attrHeight;
    ctx.beginPath();
    ctx.moveTo(x, methodSectionY);
    ctx.lineTo(x + w, methodSectionY);
    ctx.stroke();

    // Métodos
    methods.forEach((meth, i) => {
        ctx.fillText(meth, x + padding, methodSectionY + 16 + i * 20);
    });



    // Controlador de redimensionamiento en la esquina inferior derecha
    const handleSize = 8;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.fillRect(x + w - handleSize, y + realHeight - handleSize, handleSize, handleSize);
    ctx.strokeRect(x + w - handleSize, y + realHeight - handleSize, handleSize, handleSize);

    ctx.restore();
}

function dibujarAsociacionUML(ctx, el) {
    const elementos = elementosPorPizarra[pizarraActual] || [];
    const claseFrom = elementos.find(e => e.tipo === 'Class' && e.id === el.from);
    const claseTo = elementos.find(e => e.tipo === 'Class' && e.id === el.to);
    if (!claseFrom || !claseTo) return;

    ctx.save();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;

    if (el.from === el.to) {
        // Asociación recursiva UML: bucle con flecha en la esquina superior derecha
        const loopRadius = 50;
        const x = claseFrom.x + claseFrom.w - loopRadius;
        const y = claseFrom.y + 20;
        ctx.beginPath();
        ctx.arc(x, y, loopRadius, Math.PI * 0.2, Math.PI * 1.7, false);
        ctx.stroke();

        // Flecha en el bucle
        const angle = Math.PI * 1.7;
        const arrowX = x + loopRadius * Math.cos(angle);
        const arrowY = y + loopRadius * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - 8, arrowY - 4);
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - 8, arrowY + 4);
        ctx.stroke();

        // Multiplicidad y etiqueta mejoradas para relación recursiva
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';

        if (el.multOrigen) {
            // Dibujar fondo para mejor visibilidad
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x + loopRadius + 2, y - 20, 16, 16);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + loopRadius + 2, y - 20, 16, 16);

            // Dibujar texto
            ctx.fillStyle = '#333';
            ctx.fillText(el.multOrigen, x + loopRadius + 10, y - 8);
        }

        if (el.multDestino) {
            // Dibujar fondo para mejor visibilidad
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x + loopRadius + 2, y + loopRadius - 40, 16, 16);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + loopRadius + 2, y + loopRadius - 40, 16, 16);

            // Dibujar texto
            ctx.fillStyle = '#333';
            ctx.fillText(el.multDestino, x + loopRadius + 10, y + loopRadius - 28);
        }

        if (el.label) {
            ctx.font = 'bold 13px Arial';
            ctx.fillStyle = '#0077cc';
            ctx.textAlign = 'center';
            ctx.fillText(el.label, x + 20, y + loopRadius - 110);
        }
    } else {
        // Asociación normal UML: línea con flecha y multiplicidad
        // Usar puntos de conexión mejorados para evitar ocultamiento
        const puntosConexion = calcularPuntosConexionMejorados(claseFrom, claseTo);
        const x1 = puntosConexion.x1;
        const y1 = puntosConexion.y1;
        const x2 = puntosConexion.x2;
        const y2 = puntosConexion.y2;

        // Línea principal
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Flecha en el extremo destino
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowLength = 12;
        const arrowAngle = Math.PI / 8;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
            x2 - arrowLength * Math.cos(angle - arrowAngle),
            y2 - arrowLength * Math.sin(angle - arrowAngle)
        );
        ctx.moveTo(x2, y2);
        ctx.lineTo(
            x2 - arrowLength * Math.cos(angle + arrowAngle),
            y2 - arrowLength * Math.sin(angle + arrowAngle)
        );
        ctx.stroke();

        // Multiplicidad mejorada - posicionamiento inteligente para evitar ocultamiento
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';

        // Calcular distancia total de la línea
        const distanciaTotal = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const distanciaMinima = 40; // Distancia mínima para evitar ocultamiento

        // Multiplicidad origen - posicionamiento inteligente
        if (el.multOrigen) {
            let multX1, multY1;

            if (distanciaTotal < distanciaMinima) {
                // Si las clases están muy cerca, posicionar fuera de la línea
                const offsetPerpendicular = 25;
                const perpX = -Math.sin(angle) * offsetPerpendicular;
                const perpY = Math.cos(angle) * offsetPerpendicular;
                multX1 = x1 + perpX;
                multY1 = y1 + perpY;
            } else {
                // Posicionamiento normal en la línea
                const factorPosicion = Math.max(0.15, distanciaMinima / distanciaTotal);
                multX1 = x1 + (x2 - x1) * factorPosicion;
                multY1 = y1 + (y2 - y1) * factorPosicion;
            }

            // Dibujar fondo para mejor visibilidad
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(multX1 - 10, multY1 - 10, 20, 20);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(multX1 - 10, multY1 - 10, 20, 20);

            // Dibujar texto
            ctx.fillStyle = '#333';
            ctx.fillText(el.multOrigen, multX1, multY1 + 4);
        }

        // Multiplicidad destino - posicionamiento inteligente
        if (el.multDestino) {
            let multX2, multY2;

            if (distanciaTotal < distanciaMinima) {
                // Si las clases están muy cerca, posicionar fuera de la línea
                const offsetPerpendicular = 25;
                const perpX = Math.sin(angle) * offsetPerpendicular;
                const perpY = -Math.cos(angle) * offsetPerpendicular;
                multX2 = x2 + perpX;
                multY2 = y2 + perpY;
            } else {
                // Posicionamiento normal en la línea
                const factorPosicion = Math.min(0.85, 1 - distanciaMinima / distanciaTotal);
                multX2 = x1 + (x2 - x1) * factorPosicion;
                multY2 = y1 + (y2 - y1) * factorPosicion;
            }

            // Dibujar fondo para mejor visibilidad
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(multX2 - 10, multY2 - 10, 20, 20);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(multX2 - 10, multY2 - 10, 20, 20);

            // Dibujar texto
            ctx.fillStyle = '#333';
            ctx.fillText(el.multDestino, multX2, multY2 + 4);
        }
        // Etiqueta de la relación (opcional)
        if (el.label) {
            ctx.fillText(el.label, (x1 + x2) / 2, (y1 + y2) / 2 - 14);
        }
    }
    ctx.restore();
}

function dibujarComposicionUML(ctx, el) {
    const elementos = elementosPorPizarra[pizarraActual] || [];
    const claseFrom = elementos.find(e => e.tipo === 'Class' && e.id === el.from);
    const claseTo = elementos.find(e => e.tipo === 'Class' && e.id === el.to);
    if (!claseFrom || !claseTo) return;

    // Calcular puntos de conexión mejorados
    const puntosConexion = calcularPuntosConexionMejorados(claseFrom, claseTo);
    const x1 = puntosConexion.x1;
    const y1 = puntosConexion.y1;
    const x2 = puntosConexion.x2;
    const y2 = puntosConexion.y2;

    ctx.save();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;

    // Dibujar el rombo negro en el extremo "from" (composición)
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const romboSize = 20;

    // Calcular la posición del rombo en la línea
    const romboDistance = 15; // Distancia desde el punto de conexión
    const romboX = x1 + Math.cos(angle) * romboDistance;
    const romboY = y1 + Math.sin(angle) * romboDistance;

    // Dibujar el rombo negro (composición)
    ctx.save();
    ctx.translate(romboX, romboY);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0); // Punta del rombo hacia la clase destino
    ctx.lineTo(romboSize / 2, romboSize / 3);
    ctx.lineTo(0, romboSize * 2 / 3);
    ctx.lineTo(-romboSize / 2, romboSize / 3);
    ctx.closePath();
    ctx.fillStyle = '#222'; // Negro sólido para composición
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Dibujar línea desde la punta del rombo hasta la clase destino
    const puntaRomboX = romboX + Math.cos(angle) * (romboSize * 2 / 3);
    const puntaRomboY = romboY + Math.sin(angle) * (romboSize * 2 / 3);

    ctx.beginPath();
    ctx.moveTo(puntaRomboX, puntaRomboY);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Flecha en el extremo destino
    const arrowLength = 12;
    const arrowAngle = Math.PI / 8;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - arrowLength * Math.cos(angle - arrowAngle),
        y2 - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - arrowLength * Math.cos(angle + arrowAngle),
        y2 - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.stroke();

    // Multiplicidad mejorada - cerca de los puntos de conexión
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';

    // Multiplicidad origen - cerca del punto de conexión origen
    if (el.multOrigen) {
        const multX1 = x1 + (x2 - x1) * 0.1;
        const multY1 = y1 + (y2 - y1) * 0.1;

        // Dibujar fondo para mejor visibilidad
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(multX1 - 8, multY1 - 8, 16, 16);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(multX1 - 8, multY1 - 8, 16, 16);

        // Dibujar texto
        ctx.fillStyle = '#333';
        ctx.fillText(el.multOrigen, multX1, multY1 + 4);
    }

    // Multiplicidad destino - cerca del punto de conexión destino
    if (el.multDestino) {
        const multX2 = x1 + (x2 - x1) * 0.9;
        const multY2 = y1 + (y2 - y1) * 0.9;

        // Dibujar fondo para mejor visibilidad
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(multX2 - 8, multY2 - 8, 16, 16);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(multX2 - 8, multY2 - 8, 16, 16);

        // Dibujar texto
        ctx.fillStyle = '#333';
        ctx.fillText(el.multDestino, multX2, multY2 + 4);
    }
    // Etiqueta cerca de la flecha
    if (el.label) {
        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = '#0077cc';
        ctx.textAlign = 'left';
        ctx.fillText(el.label, x2 + 10, y2 - 10);
    }

    ctx.restore();
}

function dibujarAgregacionUML(ctx, el) {
    const elementos = elementosPorPizarra[pizarraActual] || [];
    const claseFrom = elementos.find(e => e.tipo === 'Class' && e.id === el.from);
    const claseTo = elementos.find(e => e.tipo === 'Class' && e.id === el.to);
    if (!claseFrom || !claseTo) return;

    // Calcular puntos de conexión mejorados
    const puntosConexion = calcularPuntosConexionMejorados(claseFrom, claseTo);
    const x1 = puntosConexion.x1;
    const y1 = puntosConexion.y1;
    const x2 = puntosConexion.x2;
    const y2 = puntosConexion.y2;

    ctx.save();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;

    // Dibujar el rombo blanco en el extremo "from" (agregación)
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const romboSize = 20;

    // Calcular la posición del rombo en la línea
    const romboDistance = 15; // Distancia desde el punto de conexión
    const romboX = x1 + Math.cos(angle) * romboDistance;
    const romboY = y1 + Math.sin(angle) * romboDistance;

    // Dibujar el rombo blanco (agregación)
    ctx.save();
    ctx.translate(romboX, romboY);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0); // Punta del rombo hacia la clase destino
    ctx.lineTo(romboSize / 2, romboSize / 3);
    ctx.lineTo(0, romboSize * 2 / 3);
    ctx.lineTo(-romboSize / 2, romboSize / 3);
    ctx.closePath();
    ctx.fillStyle = '#ffffff'; // Blanco para agregación
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Dibujar línea desde la punta del rombo hasta la clase destino
    const puntaRomboX = romboX + Math.cos(angle) * (romboSize * 2 / 3);
    const puntaRomboY = romboY + Math.sin(angle) * (romboSize * 2 / 3);

    ctx.beginPath();
    ctx.moveTo(puntaRomboX, puntaRomboY);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Flecha en el extremo destino
    const arrowLength = 12;
    const arrowAngle = Math.PI / 8;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - arrowLength * Math.cos(angle - arrowAngle),
        y2 - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - arrowLength * Math.cos(angle + arrowAngle),
        y2 - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.stroke();

    // Multiplicidad mejorada - cerca de los puntos de conexión
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';

    // Multiplicidad origen - cerca del punto de conexión origen
    if (el.multOrigen) {
        const multX1 = x1 + (x2 - x1) * 0.1;
        const multY1 = y1 + (y2 - y1) * 0.1;

        // Dibujar fondo para mejor visibilidad
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(multX1 - 8, multY1 - 8, 16, 16);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(multX1 - 8, multY1 - 8, 16, 16);

        // Dibujar texto
        ctx.fillStyle = '#333';
        ctx.fillText(el.multOrigen, multX1, multY1 + 4);
    }

    // Multiplicidad destino - cerca del punto de conexión destino
    if (el.multDestino) {
        const multX2 = x1 + (x2 - x1) * 0.9;
        const multY2 = y1 + (y2 - y1) * 0.9;

        // Dibujar fondo para mejor visibilidad
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(multX2 - 8, multY2 - 8, 16, 16);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(multX2 - 8, multY2 - 8, 16, 16);

        // Dibujar texto
        ctx.fillStyle = '#333';
        ctx.fillText(el.multDestino, multX2, multY2 + 4);
    }
    // Etiqueta cerca de la flecha
    if (el.label) {
        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = '#0077cc';
        ctx.textAlign = 'left';
        ctx.fillText(el.label, x2 + 10, y2 - 10);
    }

    ctx.restore();
}

function dibujarGeneralizacionUML(ctx, el) {
    const elementos = elementosPorPizarra[pizarraActual] || [];
    const claseFrom = elementos.find(e => e.tipo === 'Class' && e.id === el.from);
    const claseTo = elementos.find(e => e.tipo === 'Class' && e.id === el.to);
    if (!claseFrom || !claseTo) return;

    // Coordenadas de los centros
    const x1 = claseFrom.x + claseFrom.w / 2;
    const y1 = claseFrom.y + claseFrom.h + 18;
    const x2 = claseTo.x + claseTo.w / 2;
    const y2 = claseTo.y + claseTo.h / 20;

    ctx.save();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;

    // Línea principal
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Dibuja el rombo blanco en el extremo "from"
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const romboSize = 25;
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(romboSize / 20, romboSize / 4);
    ctx.lineTo(0, romboSize / 2);
    ctx.lineTo(-romboSize / 2, romboSize / 4);
    ctx.closePath();
    ctx.fillStyle = '#fff'; // Blanco para agregación
    ctx.strokeStyle = '#222';
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Flecha en el extremo destino
    const arrowLength = 12;
    const arrowAngle = Math.PI / 28;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - arrowLength * Math.cos(angle - arrowAngle),
        y2 - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - arrowLength * Math.cos(angle + arrowAngle),
        y2 - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.stroke();

    // Multiplicidad mejorada - cerca de los puntos de conexión
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';

    // Multiplicidad origen - cerca del punto de conexión origen
    if (el.multOrigen) {
        const multX1 = x1 + (x2 - x1) * 0.1;
        const multY1 = y1 + (y2 - y1) * 0.1;

        // Dibujar fondo para mejor visibilidad
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(multX1 - 8, multY1 - 8, 16, 16);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(multX1 - 8, multY1 - 8, 16, 16);

        // Dibujar texto
        ctx.fillStyle = '#333';
        ctx.fillText(el.multOrigen, multX1, multY1 + 4);
    }

    // Multiplicidad destino - cerca del punto de conexión destino
    if (el.multDestino) {
        const multX2 = x1 + (x2 - x1) * 0.9;
        const multY2 = y1 + (y2 - y1) * 0.9;

        // Dibujar fondo para mejor visibilidad
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(multX2 - 8, multY2 - 8, 16, 16);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(multX2 - 8, multY2 - 8, 16, 16);

        // Dibujar texto
        ctx.fillStyle = '#333';
        ctx.fillText(el.multDestino, multX2, multY2 + 4);
    }
    // Etiqueta cerca de la flecha
    if (el.label) {
        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = '#0077cc';
        ctx.textAlign = 'left';
        ctx.fillText(el.label, x2 + 10, y2 - 10);
    }

    ctx.restore();
}

function calcularPuntosConexionMejorados(claseFrom, claseTo) {
    // Calcular centros de las clases
    const centroFrom = {
        x: claseFrom.x + claseFrom.w / 2,
        y: claseFrom.y + claseFrom.h / 2
    };
    const centroTo = {
        x: claseTo.x + claseTo.w / 2,
        y: claseTo.y + claseTo.h / 2
    };

    // Calcular dirección del vector entre centros
    const dx = centroTo.x - centroFrom.x;
    const dy = centroTo.y - centroFrom.y;
    const distancia = Math.sqrt(dx * dx + dy * dy);

    if (distancia === 0) {
        // Si las clases están en la misma posición
        return {
            x1: centroFrom.x,
            y1: centroFrom.y,
            x2: centroTo.x,
            y2: centroTo.y
        };
    }

    // Normalizar el vector dirección
    const dirX = dx / distancia;
    const dirY = dy / distancia;

    // Calcular puntos de intersección con los bordes de las clases
    const puntoFrom = calcularInterseccionBordeMejorado(claseFrom, dirX, dirY, centroFrom);
    const puntoTo = calcularInterseccionBordeMejorado(claseTo, -dirX, -dirY, centroTo);

    return {
        x1: puntoFrom.x,
        y1: puntoFrom.y,
        x2: puntoTo.x,
        y2: puntoTo.y
    };
}

function calcularInterseccionBordeMejorado(clase, dirX, dirY, centro) {
    // Calcular intersección con cada borde de la clase
    const bordes = [
        { // Borde izquierdo
            x: clase.x,
            y: centro.y + (clase.x - centro.x) * dirY / dirX,
            valido: dirX < 0 && clase.y <= centro.y + (clase.x - centro.x) * dirY / dirX &&
                centro.y + (clase.x - centro.x) * dirY / dirX <= clase.y + clase.h
        },
        { // Borde derecho
            x: clase.x + clase.w,
            y: centro.y + (clase.x + clase.w - centro.x) * dirY / dirX,
            valido: dirX > 0 && clase.y <= centro.y + (clase.x + clase.w - centro.x) * dirY / dirX &&
                centro.y + (clase.x + clase.w - centro.x) * dirY / dirX <= clase.y + clase.h
        },
        { // Borde superior
            x: centro.x + (clase.y - centro.y) * dirX / dirY,
            y: clase.y,
            valido: dirY < 0 && clase.x <= centro.x + (clase.y - centro.y) * dirX / dirY &&
                centro.x + (clase.y - centro.y) * dirX / dirY <= clase.x + clase.w
        },
        { // Borde inferior
            x: centro.x + (clase.y + clase.h - centro.y) * dirX / dirY,
            y: clase.y + clase.h,
            valido: dirY > 0 && clase.x <= centro.x + (clase.y + clase.h - centro.y) * dirX / dirY &&
                centro.x + (clase.y + clase.h - centro.y) * dirX / dirY <= clase.x + clase.w
        }
    ];

    // Encontrar el primer borde válido
    const bordeValido = bordes.find(borde => borde.valido);

    if (bordeValido) {
        return { x: bordeValido.x, y: bordeValido.y };
    }

    // Fallback: usar el centro si no se puede calcular intersección
    return { x: centro.x, y: centro.y };
}

function dibujarElementoBasico(ctx, el) {
    // Dibujar el elemento
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(el.x, el.y, el.w, el.h);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#000';
    ctx.fillText(el.tipo, el.x + 10, el.y + 20);

    // Dibujar controlador de redimensionamiento en la esquina inferior derecha
    const handleSize = 8;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.fillRect(el.x + el.w - handleSize, el.y + el.h - handleSize, handleSize, handleSize);
    ctx.strokeRect(el.x + el.w - handleSize, el.y + el.h - handleSize, handleSize, handleSize);
}



function addElement(tipo) {
    const canvas = getCanvas(pizarraActual);
    const rect = canvas.getBoundingClientRect();
    const x = 50;  // Posición fija para consistencia
    const y = 50; //+ (elementosPorPizarra[pizarraActual]?.length || 0) * 70; // Espaciar elementos

    // Crear nuevo elemento con propiedades por defecto
    const nuevoElemento = {
        tipo: tipo,
        x: x,
        y: y,
        w: 170,
        h: 200
    };

    // Agregar propiedades específicas según el tipo
    switch (tipo) {
        case 'Class':
            nuevoElemento.id = Date.now() + Math.random(); // ID único
            nuevoElemento.name = 'ClaseNueva';
            nuevoElemento.attributes = ['+ atributo: Tipo'];
            nuevoElemento.methods = ['+ metodo(): Tipo'];
            break;
    }
    if (window.ultimoSeleccionado && window.ultimoSeleccionado.tipo === 'Card') {
        // Asegúrate de que children es un array
        if (!Array.isArray(window.ultimoSeleccionado.children)) {
            window.ultimoSeleccionado.children = [];
        }
        window.ultimoSeleccionado.children.push(nuevoElemento);
    } else {
        // Agregar el elemento a la pizarra actual
        if (!elementosPorPizarra[pizarraActual]) {
            elementosPorPizarra[pizarraActual] = [];
        }
        elementosPorPizarra[pizarraActual].push(nuevoElemento);
    }

    // Actualizar la vista y emitir cambios
    render();
    emitUI();
}

function emitUI() {
    socket.emit('ui-update', {
        proyectoId: window.id,
        data: JSON.stringify(elementosPorPizarra)
    });
}

function guardarCanvas() {
    // Esta función guarda automáticamente a través de emitUI()
    // que ya se llama en cada cambio
    emitUI();

    // Mostrar confirmación visual
    const nombreProyecto = window.proyectoNombre || 'Proyecto';
    mostrarNotificacion(`💾 ${nombreProyecto} guardado correctamente`, 'success');
}

// Funciones de descarga de pizarras
function descargarPizarraActual() {
    const canvas = getCanvas(pizarraActual);
    const nombreProyecto = limpiarNombreArchivo(window.proyectoNombre || 'Proyecto');
    const nombreArchivo = `${nombreProyecto}_Pizarra_${pizarraActual + 1}.png`;

    descargarCanvas(canvas, nombreArchivo, () => {
        mostrarNotificacion(`📥 Pizarra ${pizarraActual + 1} descargada`, 'success');
    });
}

function limpiarNombreArchivo(nombre) {
    // Eliminar caracteres especiales y espacios para nombres de archivo válidos
    return nombre.replace(/[^a-zA-Z0-9\-_]/g, '_').replace(/_+/g, '_');
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    // Crear notificación temporal
    const notif = document.createElement('div');

    let backgroundColor;
    switch (tipo) {
        case 'success': backgroundColor = '#10b981'; break;
        case 'error': backgroundColor = '#ef4444'; break;
        case 'info': backgroundColor = '#6366f1'; break;
        default: backgroundColor = '#6366f1';
    }

    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${backgroundColor};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: 'Roboto', sans-serif;
        font-size: 14px;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    notif.textContent = mensaje;

    // Agregar animación CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notif);

    // Remover después de 3 segundos
    setTimeout(() => {
        notif.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
            document.body.removeChild(notif);
            document.head.removeChild(style);
        }, 300);
    }, 3000);
}


//-------------------------------Llamada a Modales ------------------//
// Modal UML para editar clases
let claseUmlActual = null;

function mostrarModalUML(elemento) {
    claseUmlActual = elemento;
    document.getElementById('uml-nombre').value = elemento.name || '';
    document.getElementById('uml-atributos').value = (elemento.attributes || []).join('\n');
    document.getElementById('uml-metodos').value = (elemento.methods || []).join('\n');
    document.getElementById('uml-modal').style.display = 'flex';
}

function ocultarModalUML() {
    document.getElementById('uml-modal').style.display = 'none';
    claseUmlActual = null;
}

// Manejar el envío del formulario
document.getElementById('uml-form').onsubmit = function (e) {
    e.preventDefault();
    if (!claseUmlActual) return;

    const nombre = document.getElementById('uml-nombre').value.trim() || 'ClaseNueva';
    const atributos = document.getElementById('uml-atributos').value.split('\n').map(a => a.trim()).filter(a => a.length > 0);
    const metodos = document.getElementById('uml-metodos').value.split('\n').map(m => m.trim()).filter(m => m.length > 0);

    // Validaciones
    if (!validarAtributos(atributos)) {
        alert('Cada atributo debe tener el formato: "+ nombre: Tipo"\nEjemplo: "+ edad: int"');
        return;
    }
    if (!validarMetodos(metodos)) {
        alert('Cada método debe tener el formato: "+ getEdad(): Tipo"\nEjemplo: "+ getEdad(): int"');
        return;
    }

    claseUmlActual.name = nombre;
    claseUmlActual.attributes = atributos;
    claseUmlActual.methods = metodos;
    ocultarModalUML();
    render();
    emitUI();
};

// Botón cancelar
document.getElementById('uml-cancelar').onclick = function () {
    ocultarModalUML();
};


function validarAtributos(atributos) {
    // Cada atributo debe tener al menos un ':' para indicar el tipo
    for (let attr of atributos) {
        if (!/^([+\-#~] )?[\w\d_]+ *: *[\w\d_]+$/i.test(attr)) {
            return false;
        }
    }
    return true;
}

function validarMetodos(metodos) {
    // Cada método debe tener al menos '()' y ':' para el tipo de retorno
    for (let met of metodos) {
        if (!/^([+\-#~] )?[\w\d_]+\s*\([^\)]*\)\s*:\s*[\w\d_]+$/i.test(met)) {
            return false;
        }
    }
    return true;
}

// Modal UML para editar Asociacion
function mostrarModalAsociacion() {
    // Llena los selects con las clases de la pizarra actual
    const clases = (elementosPorPizarra[pizarraActual] || []).filter(e => e.tipo === 'Class');
    const selectOrigen = document.getElementById('asoc-origen');
    const selectDestino = document.getElementById('asoc-destino');
    selectOrigen.innerHTML = '';
    selectDestino.innerHTML = '';
    clases.forEach(clase => {
        const opt1 = document.createElement('option');
        opt1.value = clase.id;
        opt1.textContent = clase.name;
        selectOrigen.appendChild(opt1);
        const opt2 = document.createElement('option');
        opt2.value = clase.id;
        opt2.textContent = clase.name;
        selectDestino.appendChild(opt2);
    });
    document.getElementById('asoc-mult-origen').value = '1';
    document.getElementById('asoc-mult-destino').value = '*';
    document.getElementById('asoc-label').value = '';
    document.getElementById('asociacion-modal').style.display = 'flex';
}

function ocultarModalAsociacion() {
    document.getElementById('asociacion-modal').style.display = 'none';
}

// Manejar el envío del formulario de asociación
document.getElementById('asociacion-form').onsubmit = function (e) {
    e.preventDefault();
    const origenId = document.getElementById('asoc-origen').value;
    const destinoId = document.getElementById('asoc-destino').value;
    const multOrigen = document.getElementById('asoc-mult-origen').value.trim();
    const multDestino = document.getElementById('asoc-mult-destino').value.trim();
    const label = document.getElementById('asoc-label').value.trim();

    /*if (origenId === destinoId) {
        alert('Las clases deben ser diferentes.');
        return;
    }*/

    const nuevaAsociacion = {
        tipo: 'Association',
        from: Number(origenId),
        to: Number(destinoId),
        multOrigen: multOrigen,
        multDestino: multDestino,
        label: label
    };

    if (!elementosPorPizarra[pizarraActual]) elementosPorPizarra[pizarraActual] = [];
    elementosPorPizarra[pizarraActual].push(nuevaAsociacion);

    ocultarModalAsociacion();
    render();
    emitUI();
};

// Botón cancelar
document.getElementById('asoc-cancelar').onclick = function () {
    ocultarModalAsociacion();
};

function mostrarModalMuchosAMuchos() {
    // Llena los selects con las clases de la pizarra actual
    const clases = (elementosPorPizarra[pizarraActual] || []).filter(e => e.tipo === 'Class');
    const selectA = document.getElementById('mm-clase-a');
    const selectB = document.getElementById('mm-clase-b');
    selectA.innerHTML = '';
    selectB.innerHTML = '';
    clases.forEach(clase => {
        const optA = document.createElement('option');
        optA.value = clase.id;
        optA.textContent = clase.name;
        selectA.appendChild(optA);
        const optB = document.createElement('option');
        optB.value = clase.id;
        optB.textContent = clase.name;
        selectB.appendChild(optB);
    });
    document.getElementById('mm-clase-intermedia').value = '';
    document.getElementById('modal-muchos-a-muchos').style.display = 'flex';
}

function ocultarModalMuchosAMuchos() {
    document.getElementById('modal-muchos-a-muchos').style.display = 'none';
}

// Manejar el envío del formulario
document.getElementById('form-muchos-a-muchos').onsubmit = function (e) {
    e.preventDefault();
    const claseAId = document.getElementById('mm-clase-a').value;
    const claseBId = document.getElementById('mm-clase-b').value;
    const nombreIntermedia = document.getElementById('mm-clase-intermedia').value.trim();

    if (claseAId === claseBId) {
        alert('Las clases deben ser diferentes.');
        return;
    }
    if (!nombreIntermedia) {
        alert('Debes ingresar el nombre de la clase intermedia.');
        return;
    }

    const elementos = elementosPorPizarra[pizarraActual] || [];
    const claseA = elementos.find(e => e.tipo === 'Class' && e.id == claseAId);
    const claseB = elementos.find(e => e.tipo === 'Class' && e.id == claseBId);

    // Crea la clase intermedia
    const claseIntermedia = {
        tipo: 'Class',
        id: Date.now() + Math.random(),
        name: nombreIntermedia,
        attributes: [],
        methods: [],
        x: Math.min(claseA.x, claseB.x) + Math.abs(claseA.x - claseB.x) / 2,
        y: Math.min(claseA.y, claseB.y) + Math.abs(claseA.y - claseB.y) / 2,
        w: 170,
        h: 200
    };
    elementos.push(claseIntermedia);

    // Crea las asociaciones muchos a muchos
    elementos.push({
        tipo: 'Association',
        from: claseA.id,
        to: claseIntermedia.id,
        multOrigen: '1',
        multDestino: '*',
        label: ''
    });
    elementos.push({
        tipo: 'Association',
        from: claseB.id,
        to: claseIntermedia.id,
        multOrigen: '1',
        multDestino: '*',
        label: ''
    });

    ocultarModalMuchosAMuchos();
    render();
    emitUI();
    mostrarNotificacion('Relación muchos a muchos creada.', 'success');
};

// Botón cancelar
document.getElementById('mm-cancelar').onclick = function () {
    ocultarModalMuchosAMuchos();
};

/*
function crearRelacionRecursivaMuchosAMuchos(claseId) {
    const elementos = elementosPorPizarra[pizarraActual] || [];
    const clase = elementos.find(e => e.tipo === 'Class' && e.id == claseId);
    if (!clase) {
        mostrarNotificacion('No se encontró la clase para la relación recursiva.', 'error');
        return;
    }
    elementos.push({
        tipo: 'Association',
        from: clase.id,
        to: clase.id,
        multOrigen: '*',
        multDestino: '*',
        label: 'relación recursiva'
    });
    render();
    emitUI();
    mostrarNotificacion('Relación recursiva muchos a muchos creada.', 'success');
}*/

function mostrarModalRecursivaMuchosAMuchos() {
    const clases = (elementosPorPizarra[pizarraActual] || []).filter(e => e.tipo === 'Class');
    const selectClase = document.getElementById('rec-mm-clase');
    selectClase.innerHTML = '';
    clases.forEach(clase => {
        const opt = document.createElement('option');
        opt.value = clase.id;
        opt.textContent = clase.name;
        selectClase.appendChild(opt);
    });
    document.getElementById('rec-mm-clase-intermedia').value = '';
    document.getElementById('modal-recursiva-mm').style.display = 'flex';
}

function ocultarModalRecursivaMuchosAMuchos() {
    document.getElementById('modal-recursiva-mm').style.display = 'none';
}

document.getElementById('form-recursiva-mm').onsubmit = function (e) {
    e.preventDefault();
    const claseId = document.getElementById('rec-mm-clase').value;
    const nombreIntermedia = document.getElementById('rec-mm-clase-intermedia').value.trim();

    if (!nombreIntermedia) {
        alert('Debes ingresar el nombre de la clase intermedia.');
        return;
    }

    const elementos = elementosPorPizarra[pizarraActual] || [];
    const clase = elementos.find(e => e.tipo === 'Class' && e.id == claseId);

    // Crea la clase intermedia
    const claseIntermedia = {
        tipo: 'Class',
        id: Date.now() + Math.random(),
        name: nombreIntermedia,
        attributes: [],
        methods: [],
        x: clase.x + 100,
        y: clase.y + 100,
        w: 170,
        h: 200
    };
    elementos.push(claseIntermedia);

    // Crea dos asociaciones desde la clase principal a la clase intermedia
    elementos.push({
        tipo: 'Association',
        from: clase.id,
        to: claseIntermedia.id,
        multOrigen: '1',
        multDestino: '*',
        label: ''
    });
    elementos.push({
        tipo: 'Association',
        from: clase.id,
        to: claseIntermedia.id,
        multOrigen: '1',
        multDestino: '*',
        label: ''
    });

    ocultarModalRecursivaMuchosAMuchos();
    render();
    emitUI();
    mostrarNotificacion('Relación recursiva muchos a muchos creada.', 'success');
};

document.getElementById('rec-mm-cancelar').onclick = function () {
    ocultarModalRecursivaMuchosAMuchos();
};

function mostrarModalComposicion() {
    const clases = (elementosPorPizarra[pizarraActual] || []).filter(e => e.tipo === 'Class');
    const selectTodo = document.getElementById('comp-todo');
    const selectParte = document.getElementById('comp-parte');
    selectTodo.innerHTML = '';
    selectParte.innerHTML = '';
    clases.forEach(clase => {
        const optTodo = document.createElement('option');
        optTodo.value = clase.id;
        optTodo.textContent = clase.name;
        selectTodo.appendChild(optTodo);
        const optParte = document.createElement('option');
        optParte.value = clase.id;
        optParte.textContent = clase.name;
        selectParte.appendChild(optParte);
    });
    document.getElementById('comp-label').value = '';
    document.getElementById('modal-composicion').style.display = 'flex';
}

function ocultarModalComposicion() {
    document.getElementById('modal-composicion').style.display = 'none';
}

document.getElementById('form-composicion').onsubmit = function (e) {
    e.preventDefault();
    const idClaseTodo = Number(document.getElementById('comp-todo').value);
    const idClaseParte = Number(document.getElementById('comp-parte').value);
    const label = document.getElementById('comp-label').value.trim();

    if (idClaseTodo === idClaseParte) {
        alert('Las clases deben ser diferentes.');
        return;
    }

    const nuevaComposicion = {
        tipo: 'Composition',
        from: idClaseTodo,
        to: idClaseParte,
        multOrigen: '1',
        multDestino: '*',
        label: label || ''
    };

    if (!elementosPorPizarra[pizarraActual]) elementosPorPizarra[pizarraActual] = [];
    elementosPorPizarra[pizarraActual].push(nuevaComposicion);

    ocultarModalComposicion();
    render();
    emitUI();
};

document.getElementById('comp-cancelar').onclick = function () {
    ocultarModalComposicion();
};

function mostrarModalAgregacion() {
    const clases = (elementosPorPizarra[pizarraActual] || []).filter(e => e.tipo === 'Class');
    const selectTodo = document.getElementById('agreg-todo');
    const selectParte = document.getElementById('agreg-parte');
    selectTodo.innerHTML = '';
    selectParte.innerHTML = '';
    clases.forEach(clase => {
        const optTodo = document.createElement('option');
        optTodo.value = clase.id;
        optTodo.textContent = clase.name;
        selectTodo.appendChild(optTodo);
        const optParte = document.createElement('option');
        optParte.value = clase.id;
        optParte.textContent = clase.name;
        selectParte.appendChild(optParte);
    });
    document.getElementById('agreg-label').value = '';
    document.getElementById('modal-agregacion').style.display = 'flex';
}

function ocultarModalAgregacion() {
    document.getElementById('modal-agregacion').style.display = 'none';
}

document.getElementById('form-agregacion').onsubmit = function (e) {
    e.preventDefault();
    const idClaseTodo = Number(document.getElementById('agreg-todo').value);
    const idClaseParte = Number(document.getElementById('agreg-parte').value);
    const label = document.getElementById('agreg-label').value.trim();

    if (idClaseTodo === idClaseParte) {
        alert('Las clases deben ser diferentes.');
        return;
    }

    const nuevaAgregacion = {
        tipo: 'Aggregation',
        from: idClaseTodo,
        to: idClaseParte,
        multOrigen: '1',
        multDestino: '*',
        label: label || ''
    };

    if (!elementosPorPizarra[pizarraActual]) elementosPorPizarra[pizarraActual] = [];
    elementosPorPizarra[pizarraActual].push(nuevaAgregacion);

    ocultarModalAgregacion();
    render();
    emitUI();
};

document.getElementById('agreg-cancelar').onclick = function () {
    ocultarModalAgregacion();
};

function mostrarModalGeneralizacion() {
    const clases = (elementosPorPizarra[pizarraActual] || []).filter(e => e.tipo === 'Class');
    const selectTodo = document.getElementById('gener-todo');
    const selectParte = document.getElementById('gener-parte');
    selectTodo.innerHTML = '';
    selectParte.innerHTML = '';
    clases.forEach(clase => {
        const optTodo = document.createElement('option');
        optTodo.value = clase.id;
        optTodo.textContent = clase.name;
        selectTodo.appendChild(optTodo);
        const optParte = document.createElement('option');
        optParte.value = clase.id;
        optParte.textContent = clase.name;
        selectParte.appendChild(optParte);
    });
    document.getElementById('gener-label').value = '';
    document.getElementById('modal-generalizacion').style.display = 'flex';
}

function ocultarModalGeneralizacion() {
    document.getElementById('modal-generalizacion').style.display = 'none';
}

document.getElementById('form-generalizacion').onsubmit = function (e) {
    e.preventDefault();
    const idClaseTodo = Number(document.getElementById('gener-todo').value);
    const idClaseParte = Number(document.getElementById('gener-parte').value);
    const label = document.getElementById('gener-label').value.trim();

    if (idClaseTodo === idClaseParte) {
        alert('Las clases deben ser diferentes.');
        return;
    }

    const nuevaGeneralizacion = {
        tipo: 'Generalization',
        from: idClaseTodo,
        to: idClaseParte,
        multOrigen: '1',
        multDestino: '*',
        label: label || ''
    };

    if (!elementosPorPizarra[pizarraActual]) elementosPorPizarra[pizarraActual] = [];
    elementosPorPizarra[pizarraActual].push(nuevaGeneralizacion);

    ocultarModalGeneralizacion();
    render();
    emitUI();
};

document.getElementById('gener-cancelar').onclick = function () {
    ocultarModalGeneralizacion();
};

//--------------------------------------------------//

//-------Funciones de descarga de pizarras-------//
function descargarTodasLasPizarras() {
    const nombreProyecto = limpiarNombreArchivo(window.proyectoNombre || 'Proyecto');
    const totalPizarras = document.getElementsByClassName('pizarra').length;
    const pizarraOriginal = pizarraActual;

    if (totalPizarras === 0) {
        mostrarNotificacion('❌ No hay pizarras para descargar', 'error');
        return;
    }

    // Confirmar descarga múltiple
    if (!confirm(`¿Deseas descargar todas las ${totalPizarras} pizarras del proyecto "${window.proyectoNombre}"?`)) {
        return;
    }

    mostrarNotificacion(`🔄 Iniciando descarga de ${totalPizarras} pizarras...`, 'info');

    let descargasCompletadas = 0;

    // Función recursiva para descargar pizarras una por una
    function descargarPizarra(index) {
        if (index >= totalPizarras) {
            // Restaurar pizarra original y mostrar mensaje
            mostrarPizarra(pizarraOriginal);
            mostrarNotificacion(`✅ Descarga completada: ${totalPizarras} pizarras descargadas`, 'success');
            return;
        }

        // Renderizar la pizarra actual
        dibujarPizarra(index);

        const canvas = getCanvas(index);
        const nombreArchivo = `${nombreProyecto}_Pizarra_${index + 1}.png`;

        // Descargar y continuar con la siguiente
        setTimeout(() => {
            descargarCanvas(canvas, nombreArchivo, () => {
                descargasCompletadas++;
                mostrarNotificacion(`📥 Pizarra ${index + 1}/${totalPizarras} descargada`, 'info');
                descargarPizarra(index + 1);
            });
        }, 300);
    }

    // Iniciar descarga
    descargarPizarra(0);
}

function descargarCanvas(canvas, nombreArchivo, onSuccess = null) {
    try {
        // Crear un nuevo canvas temporal con fondo blanco
        const canvasTemp = document.createElement('canvas');
        const ctxTemp = canvasTemp.getContext('2d');

        canvasTemp.width = canvas.width;
        canvasTemp.height = canvas.height;

        // Agregar fondo blanco
        ctxTemp.fillStyle = '#ffffff';
        ctxTemp.fillRect(0, 0, canvasTemp.width, canvasTemp.height);

        // Dibujar el contenido del canvas original
        ctxTemp.drawImage(canvas, 0, 0);

        // Convertir a imagen y descargar
        canvasTemp.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const enlace = document.createElement('a');
            enlace.href = url;
            enlace.download = nombreArchivo;
            enlace.style.display = 'none';

            document.body.appendChild(enlace);
            enlace.click();
            document.body.removeChild(enlace);

            // Limpiar URL temporal
            URL.revokeObjectURL(url);

            // Ejecutar callback de éxito si existe
            if (onSuccess && typeof onSuccess === 'function') {
                onSuccess();
            }
        }, 'image/png');

    } catch (error) {
        console.error('Error al descargar la pizarra:', error);
        mostrarNotificacion('❌ Error al descargar la pizarra', 'error');
    }
}

// Funciones de utilidad
function getCanvas(index) {
    return document.getElementsByClassName('pizarra')[index];
}

function getContext(index) {
    return getCanvas(index).getContext('2d');
}
//----------------------------------//



function mostrarPizarra(index) {
    const pizarras = document.getElementsByClassName('pizarra');
    for (let i = 0; i < pizarras.length; i++) {
        pizarras[i].style.display = (i === index) ? 'block' : 'none';
    }

    // Actualizar tabs activos
    const tabs = document.querySelectorAll('.pizarra-tab');
    tabs.forEach((tab, i) => {
        if (i === index) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    pizarraActual = index;
    render();
}

function agregarNuevaPizarra() {
    const nuevoIndex = document.getElementsByClassName('pizarra').length;

    // Crear la nueva pizarra en el UI
    crearNuevaPizarraUI(nuevoIndex);

    // Inicializar con array vacío
    elementosPorPizarra[nuevoIndex] = [];

    // Mostrar la nueva pizarra
    mostrarPizarra(nuevoIndex);

    // Emitir cambios al servidor
    emitUI();
}

function crearNuevaPizarraUI(index) {
    // Crear el canvas
    const pizarrasContainer = document.getElementById('pizarras');
    const nueva = document.createElement('canvas');
    nueva.className = 'pizarra';
    nueva.width = 400;
    nueva.height = 550;
    nueva.style.display = 'none';
    pizarrasContainer.appendChild(nueva);

    // Crear el tab en el selector
    const selector = document.getElementById('pizarra-selector');
    const btnNueva = selector.querySelector('.btn-nueva-pizarra');

    const nuevoTab = document.createElement('div');
    nuevoTab.className = 'pizarra-tab';
    nuevoTab.textContent = `Pizarra ${index + 1}`;
    nuevoTab.onclick = () => mostrarPizarra(index);

    // Agregar evento de clic derecho para eliminar pizarra (solo si hay más de 1)
    nuevoTab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (document.getElementsByClassName('pizarra').length > 1) {
            if (confirm(`¿Deseas eliminar la Pizarra ${index + 1}?`)) {
                eliminarPizarra(index);
            }
        } else {
            alert('No puedes eliminar la única pizarra del proyecto.');
        }
    });

    // Insertar antes del botón "Nueva Pizarra"
    selector.insertBefore(nuevoTab, btnNueva);

    // Inicializar el canvas
    initCanvas(nueva, index);
}

function eliminarPizarra(index) {
    const pizarras = document.getElementsByClassName('pizarra');
    const tabs = document.querySelectorAll('.pizarra-tab');

    if (pizarras.length <= 1) return; // No eliminar la última pizarra

    // Eliminar el canvas
    pizarras[index].remove();

    // Eliminar el tab
    tabs[index].remove();

    // Eliminar datos de la pizarra
    elementosPorPizarra.splice(index, 1);

    // Reindexar las pizarras restantes
    const pizarrasRestantes = document.getElementsByClassName('pizarra');
    const tabsRestantes = document.querySelectorAll('.pizarra-tab');

    for (let i = 0; i < pizarrasRestantes.length; i++) {
        tabsRestantes[i].textContent = `Pizarra ${i + 1}`;
        tabsRestantes[i].onclick = () => mostrarPizarra(i);
    }

    // Mostrar la primera pizarra si eliminamos la actual
    if (index === pizarraActual || pizarraActual >= pizarrasRestantes.length) {
        mostrarPizarra(0);
    }

    // Emitir cambios
    emitUI();
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




function descargarComoArchivo(contenido, nombreArchivo) {
    const blob = new Blob([contenido], { type: 'text/plain' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
}

// Función para generar script SQL desde los elementos de la pizarra
async function generarScriptSQL() {
    try {
        console.log('🔍 Iniciando generación de SQL...');
        console.log('elementosPorPizarra:', elementosPorPizarra);
        console.log('pizarraActual:', pizarraActual);

        // Verificar que hay elementos en la pizarra
        const elementosActuales = elementosPorPizarra[pizarraActual] || [];
        const clases = elementosActuales.filter(e => e.tipo === 'Class');
        const relaciones = elementosActuales.filter(e => ['Association', 'Composition', 'Aggregation'].includes(e.tipo));

        console.log('elementosActuales:', elementosActuales);
        console.log('clases encontradas:', clases.length);
        console.log('relaciones encontradas:', relaciones.length);

        if (clases.length === 0) {
            mostrarNotificacion('❌ No hay clases en la pizarra para generar SQL', 'error');
            return;
        }

        mostrarNotificacion('🔄 Generando script SQL...', 'info');

        // Enviar datos al servidor
        console.log('📤 Enviando petición a /generar-sql...');
        const requestData = {
            elementosPorPizarra: elementosPorPizarra
        };
        console.log('Datos a enviar:', requestData);

        const response = await fetch('/generar-sql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        console.log('📥 Respuesta recibida:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error del servidor:', errorText);
            throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        if (result.success) {
            // Mostrar estadísticas
            const stats = result.estadisticas;
            mostrarNotificacion(
                `✅ SQL generado: ${stats.clases} clases, ${stats.relaciones} relaciones, ${stats.tablas} tablas`,
                'success'
            );

            // Descargar el archivo SQL
            const nombreProyecto = limpiarNombreArchivo(window.proyectoNombre || 'Proyecto');
            const nombreArchivo = `${nombreProyecto}_schema_${new Date().toISOString().split('T')[0]}.sql`;

            descargarComoArchivo(result.sql, nombreArchivo);

            // Opcional: mostrar el SQL en un modal
            mostrarModalSQL(result.sql, stats);
        } else {
            throw new Error(result.error || 'Error desconocido');
        }

    } catch (error) {
        console.error('Error al generar SQL:', error);
        mostrarNotificacion(`❌ Error al generar SQL: ${error.message}`, 'error');
    }
}

// Función para mostrar el SQL generado en un modal
function mostrarModalSQL(sql, estadisticas) {
    // Crear modal si no existe
    let modal = document.getElementById('sql-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sql-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 8px;
                padding: 20px;
                max-width: 80%;
                max-height: 80%;
                overflow: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #333;">Script SQL Generado</h3>
                    <button id="cerrar-sql-modal" style="
                        background: #ff4757;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 8px 12px;
                        cursor: pointer;
                    ">Cerrar</button>
                </div>
                <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                    <strong>Estadísticas:</strong> ${estadisticas.clases} clases, ${estadisticas.relaciones} relaciones, ${estadisticas.tablas} tablas
                </div>
                <textarea id="sql-content" readonly style="
                    width: 100%;
                    height: 400px;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 10px;
                    resize: vertical;
                "></textarea>
                <div style="margin-top: 15px; text-align: right;">
                    <button id="copiar-sql" style="
                        background: #2ed573;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 8px 16px;
                        cursor: pointer;
                        margin-right: 10px;
                    ">Copiar al Portapapeles</button>
                    <button id="descargar-sql-modal" style="
                        background: #3742fa;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 8px 16px;
                        cursor: pointer;
                    ">Descargar Archivo</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('cerrar-sql-modal').onclick = () => {
            modal.style.display = 'none';
        };

        document.getElementById('copiar-sql').onclick = () => {
            const textarea = document.getElementById('sql-content');
            textarea.select();
            document.execCommand('copy');
            mostrarNotificacion('📋 SQL copiado al portapapeles', 'success');
        };

        document.getElementById('descargar-sql-modal').onclick = () => {
            const sqlContent = document.getElementById('sql-content').value;
            const nombreProyecto = limpiarNombreArchivo(window.proyectoNombre || 'Proyecto');
            const nombreArchivo = `${nombreProyecto}_schema_${new Date().toISOString().split('T')[0]}.sql`;
            descargarComoArchivo(sqlContent, nombreArchivo);
        };

        // Cerrar modal al hacer clic fuera
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    }

    // Llenar el contenido
    document.getElementById('sql-content').value = sql;
    modal.style.display = 'flex';
}

// ...existing code...

async function enviarPromptGemini(event) {
    event.preventDefault();
    const prompt = document.getElementById('prompt-gemini').value;
    const resultado = document.getElementById('resultado-gemini');
    resultado.style.display = 'block';
    resultado.textContent = 'Generando...';

    try {
        // Obtener el id de la pizarra actual desde la variable global que uses en tu app.
        // Asegúrate de asignar window.boardId cuando cargues la pizarra.
        const boardId = window.boardId || window.pizarraDBId || null;

        // Enviar el estado actual para que el modelo pueda hacer merge/update correctamente
        if (typeof pizarraActual === 'undefined') pizarraActual = 0;
        const currentElements = elementosPorPizarra[pizarraActual] ? elementosPorPizarra[pizarraActual] : [];
        const board = currentElements.length ? { elementos: currentElements } : null;

        const response = await fetch('http://127.0.0.1:5000/generate_uml_diagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                board_id: boardId,
                board: board,
                mode: 'update' // usar 'update' para modificar elementos existentes
            })
        });
        const text = await response.text();

        let data;
        try {
            data = JSON.parse(text);
            console.log('Respuesta Gemini (parseada):', data);
        } catch (e) {
            console.error('No se pudo parsear JSON:', e, text);
            resultado.textContent = 'Error al parsear la respuesta de Gemini.';
            return;
        }

        if (data.error) {
            resultado.textContent = 'Error: ' + data.error + '\n' + (data.response_text || '');
            return;
        }

        // Si el backend devuelve "elementos" (estado resultante), reemplazar el estado local y redibujar
        if (data.elementos && Array.isArray(data.elementos)) {
            elementosPorPizarra[pizarraActual] = data.elementos;
            resultado.textContent = 'Pizarra actualizada correctamente.';
            render();
            return;
        }

        // Si el backend devolvió otro formato (p.ej. parsed_json con elementos dentro), intentar usarlo
        if (data.elementos === undefined && data.length && Array.isArray(data)) {
            elementosPorPizarra[pizarraActual] = data;
            resultado.textContent = 'Pizarra actualizada correctamente.';
            render();
            return;
        }

        resultado.textContent = 'Respuesta recibida, pero no contiene "elementos" para actualizar.';
    } catch (err) {
        console.error(err);
        resultado.textContent = 'Error de conexión con el backend UML Gemini: ' + err;
    }
}

// ...existing code...