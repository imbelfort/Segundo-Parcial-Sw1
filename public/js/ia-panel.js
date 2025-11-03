// public/js/ia-panel.js
// Función para inicializar el panel de IA
function initIAPanel() {
    console.log('Inicializando panel de IA...');
    
    const iaPanel = document.getElementById('ia-panel');
    const toggleButton = document.getElementById('ia-toggle');
    const iaFab = document.getElementById('ia-fab');
    const iaInput = document.getElementById('ia-input');
    const iaSendButton = document.getElementById('ia-send');
    const iaChat = document.getElementById('ia-chat');
    const iaHeader = document.querySelector('.ia-header');
    
    let isDragging = false;
    let offsetX, offsetY;
    let currentX, currentY;
    let isMobile = window.innerWidth <= 768;
    
    // Función para manejar el inicio del arrastre
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

    // Función para manejar el arrastre
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
        
        // Limitar los bordes de la pantalla
        const maxX = window.innerWidth - iaPanel.offsetWidth;
        const maxY = window.innerHeight - iaPanel.offsetHeight;
        
        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));
        
        iaPanel.style.left = `${currentX}px`;
        iaPanel.style.top = `${currentY}px`;
    }

    // Función para detener el arrastre
    function stopDrag() {
        isDragging = false;
        iaPanel.style.transition = 'all 0.3s ease';
        
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('touchend', stopDrag);
    }

    // Toggle panel with FAB button
    function togglePanel(e) {
        if (e) e.stopPropagation();
        console.log('Alternando visibilidad del panel');
        
        if (iaPanel.classList.contains('visible')) {
            // Ocultar el panel
            iaPanel.classList.remove('visible');
            iaPanel.classList.add('collapsed');
            console.log('Panel ocultado');
        } else {
            // Mostrar el panel
            iaPanel.classList.remove('collapsed');
            iaPanel.classList.add('visible');
            console.log('Panel mostrado');
            
            // Enfocar el input después de la animación
            setTimeout(() => {
                if (iaInput) iaInput.focus();
            }, 300);
        }
    }

    // Configurar el botón de cerrar
    function setupCloseButton() {
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.className = 'ia-close-button';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.color = 'white';
        closeButton.style.fontSize = '24px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.padding = '0 10px';
        closeButton.style.lineHeight = '1';
        closeButton.style.marginLeft = 'auto';
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePanel(e);
        });
        
        return closeButton;
    }

    // Inicializar el panel
    function init() {
        console.log('Inicializando panel de IA...');
        
        // Insertar el botón de cerrar en el encabezado
        const header = document.querySelector('.ia-header');
        if (header && !header.querySelector('.ia-close-button')) {
            header.appendChild(setupCloseButton());
        }
        
        // Configurar event listeners
        if (iaFab) {
            console.log('Agregando evento click al FAB');
            iaFab.addEventListener('click', togglePanel);
        } else {
            console.error('No se encontró el botón flotante (FAB)');
        }
        
        // Cerrar el panel al hacer clic fuera de él
        document.addEventListener('click', (e) => {
            if (iaPanel.classList.contains('visible') && 
                !iaPanel.contains(e.target) && 
                e.target !== iaFab && 
                !iaFab.contains(e.target)) {
                togglePanel(e);
            }
        });
        
        // Cerrar con tecla Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && iaPanel.classList.contains('visible')) {
                togglePanel(e);
            }
        });
        
        // Configurar arrastre del panel
        if (iaHeader) {
            iaHeader.addEventListener('mousedown', startDrag);
            iaHeader.addEventListener('touchstart', startDrag, { passive: false });
        }
        
        // Mostrar el panel por defecto
        console.log('Mostrando panel por defecto');
        togglePanel();
        
        // Evitar que los clics dentro del panel lo cierren
        iaPanel.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
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
