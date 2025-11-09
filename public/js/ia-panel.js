// public/js/ia-panel.js

// Asume que las siguientes variables de 'script.js' están en el ámbito global:
// - elementosPorPizarra
// - pizarraActual
// - render()
// - emitUI()
// - mostrarNotificacion()

function initIAPanel() {
    console.log('Inicializando panel de IA...');
    
    // --- Referencias a Elementos ---
    const iaPanel = document.getElementById('ia-panel');
    const iaFab = document.getElementById('ia-fab');
    const iaInput = document.getElementById('ia-input');
    const iaSendButton = document.getElementById('ia-send');
    const iaChat = document.getElementById('ia-chat');
    const iaHeader = document.querySelector('.ia-header');
    
    let isDragging = false;
    let offsetX, offsetY;
    let currentX, currentY;
    let isMobile = window.innerWidth <= 768;
    
    // --- Funciones de UI (Arrastrar y Alternar) ---
    // (Tu código original para startDrag, drag, stopDrag está bien)

    function startDrag(e) {
        if (isMobile) return;
        
        isDragging = true;
        const rect = iaPanel.getBoundingClientRect();
        
        if (e.type === 'mousedown') {
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', stopDrag);
        } else if (e.type === 'touchstart') {
            const touch = e.touches[0];
            offsetX = touch.clientX - rect.left;
            offsetY = touch.clientY - rect.top;
            document.addEventListener('touchmove', drag, { passive: false });
            document.addEventListener('touchend', stopDrag);
        }
        
        iaPanel.style.transition = 'none';
        e.preventDefault();
    }

    function drag(e) {
        if (!isDragging) return;
        
        if (e.type === 'mousemove') {
            currentX = e.clientX - offsetX;
            currentY = e.clientY - offsetY;
        } else if (e.type === 'touchmove') {
            const touch = e.touches[0];
            currentX = touch.clientX - offsetX;
            currentY = touch.clientY - offsetY;
            e.preventDefault();
        }
        
        const maxX = window.innerWidth - iaPanel.offsetWidth;
        const maxY = window.innerHeight - iaPanel.offsetHeight;
        
        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));
        
        iaPanel.style.left = `${currentX}px`;
        iaPanel.style.top = `${currentY}px`;
    }

    function stopDrag() {
        isDragging = false;
        iaPanel.style.transition = 'all 0.3s ease';
        
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('touchend', stopDrag);
    }

    function togglePanel(e) {
        if (e) e.stopPropagation();
        
        if (iaPanel.classList.contains('visible')) {
            iaPanel.classList.remove('visible');
            iaPanel.classList.add('collapsed');
        } else {
            iaPanel.classList.remove('collapsed');
            iaPanel.classList.add('visible');
            setTimeout(() => {
                if (iaInput) iaInput.focus();
            }, 300);
        }
    }

    function setupCloseButton() {
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.className = 'ia-close-button';
        // (Tus estilos para el botón están bien)
        closeButton.style.cssText = "background:none; border:none; color:white; font-size:24px; cursor:pointer; padding: 0 10px; line-height:1; margin-left:auto;";
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePanel(e);
        });
        return closeButton;
    }

    // --- INICIO DE NUEVA LÓGICA DE IA ---

    /**
     * Añade un mensaje al chat de la IA.
     * @param {string} text - El texto del mensaje.
     * @param {'user' | 'ia' | 'error'} type - El tipo de mensaje.
     */
    function addMessageToChat(text, type = 'ia') {
        if (!iaChat) return;
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('ia-message', `ia-message-${type}`);
        
        // Simple sanitización para evitar que se renderice HTML
        msgDiv.textContent = text; 
        
        iaChat.appendChild(msgDiv);
        // Auto-scroll
        iaChat.scrollTop = iaChat.scrollHeight;
    }

    /**
     * Procesa los cambios de la IA en el diagrama.
     */
    function aplicarCambiosIA(cambios) {
        if (!cambios) return;

        let elementosActuales = [];
        // Validación robusta de la pizarra
        if (Array.isArray(elementosPorPizarra) && elementosPorPizarra[pizarraActual]) {
            elementosActuales = elementosPorPizarra[pizarraActual];
        } else {
            console.error('aplicarCambiosIA: No se pudo acceder a elementosPorPizarra. Estado:', elementosPorPizarra);
            addMessageToChat('Error: El estado de la pizarra es inválido. Intenta recargar la página.', 'error');
            return;
        }

        // 1. Eliminar elementos
        if (cambios.eliminar && cambios.eliminar.length > 0) {
            const idsAEliminar = new Set(cambios.eliminar);
            elementosActuales = elementosActuales.filter(el => !idsAEliminar.has(el.id));
            console.log('IA eliminó:', cambios.eliminar);
        }

        // 2. Actualizar elementos
        if (cambios.actualizar && cambios.actualizar.length > 0) {
            cambios.actualizar.forEach(cambio => {
                const elemento = elementosActuales.find(el => el.id == cambio.id);
                if (elemento) {
                    Object.assign(elemento, cambio); // Fusiona los cambios
                    console.log('IA actualizó:', elemento);
                }
            });
        }

        // 3. Agregar nuevos elementos
        if (cambios.agregar && cambios.agregar.length > 0) {
            elementosActuales.push(...cambios.agregar);
            console.log('IA agregó:', cambios.agregar);
        }

        // Guardar el nuevo estado
        elementosPorPizarra[pizarraActual] = elementosActuales;

        render();
        emitUI();
    }

    /**
     * Envía el comando a la IA y maneja la respuesta.
     */
    async function enviarComandoIA() {
        const comando = iaInput.value.trim();
        if (!comando) return;

        addMessageToChat(comando, 'user');
        iaInput.value = ''; // Limpiar input
        iaInput.disabled = true;
        iaSendButton.disabled = true;
        iaSendButton.innerHTML = '...'; // Indicar carga

        let elementosActuales = [];
        if (Array.isArray(elementosPorPizarra) && elementosPorPizarra[pizarraActual]) {
            elementosActuales = elementosPorPizarra[pizarraActual];
        } else {
            console.error('enviarComandoIA: No se pudo acceder a elementosPorPizarra.');
            addMessageToChat('Error: No se pueden leer los elementos de la pizarra. Intenta recargar.', 'error');
            iaInput.disabled = false;
            iaSendButton.disabled = false;
            iaSendButton.innerHTML = 'Enviar';
            return;
        }

        try {
            const response = await fetch('/procesar-comando-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    comando: comando,
                    elementos: elementosActuales
                })
            });

            const resultado = await response.json();

            if (!response.ok) {
                throw new Error(resultado.respuesta || 'Error desconocido del servidor');
            }

            // Mostrar respuesta de la IA en el chat
            addMessageToChat(resultado.respuesta, 'ia');
            
            // Aplicar cambios al diagrama
            aplicarCambiosIA(resultado.cambios);

        } catch (error) {
            console.error('Error al contactar a la IA:', error);
            addMessageToChat(`Error: ${error.message}`, 'error');
        } finally {
            iaInput.disabled = false;
            iaSendButton.disabled = false;
            iaSendButton.innerHTML = 'Enviar';
            iaInput.focus();
        }
    }

    // --- FIN DE NUEVA LÓGICA DE IA ---


    // Función de inicialización principal
    function init() {
        console.log('Ejecutando init() de IA...');
        
        // Insertar el botón de cerrar en el encabezado
        if (iaHeader && !iaHeader.querySelector('.ia-close-button')) {
            iaHeader.appendChild(setupCloseButton());
        }
        
        // Configurar event listeners de UI
        if (iaFab) {
            iaFab.addEventListener('click', togglePanel);
        } else {
            console.error('No se encontró el botón flotante (FAB)');
        }
        
        document.addEventListener('click', (e) => {
            if (iaPanel.classList.contains('visible') && 
                !iaPanel.contains(e.target) && 
                e.target !== iaFab && 
                !iaFab.contains(e.target)) {
                togglePanel(e);
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && iaPanel.classList.contains('visible')) {
                togglePanel(e);
            }
        });
        
        if (iaHeader) {
            iaHeader.addEventListener('mousedown', startDrag);
            iaHeader.addEventListener('touchstart', startDrag, { passive: false });
        }
        
        iaPanel.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // --- INICIO DE MODIFICACIONES EN INIT ---
        
        // 1. Lógica de envío de IA
        if (iaSendButton) {
            iaSendButton.addEventListener('click', enviarComandoIA);
        } else {
            console.error('No se encontró el botón de envío de IA (ia-send)');
        }
        
        if (iaInput) {
            iaInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    enviarComandoIA();
                }
            });
        } else {
            console.error('No se encontró el input de IA (ia-input)');
        }

        // 2. No mostrar el panel por defecto, dejar que el FAB lo controle.
        // Se elimina la llamada original a togglePanel();
        console.log('Panel de IA listo. Haz clic en el FAB para abrir.');
        
        // --- FIN DE MODIFICACIONES EN INIT ---
        
        console.log('Panel de IA inicializado correctamente');
    }
    
    // Iniciar la inicialización cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}

// Inicializar el panel cuando se cargue el script
initIAPanel();