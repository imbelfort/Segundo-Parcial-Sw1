document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('canvas-scroll-container');
    const canvas = document.getElementById('pizarra-0');
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    
    // Zoom and scale variables
    let scale = 1;
    const scaleStep = 0.1;
    const minScale = 0.5;
    const maxScale = 3;
    
    // Initialize canvas wrapper size
    function updateCanvasWrapperSize() {
        // Make the canvas wrapper large enough to allow for scrolling
        const width = Math.max(2000, canvas.offsetWidth * 1.5);
        const height = Math.max(1500, canvas.offsetHeight * 1.5);
        
        // Position the canvas in the center of the wrapper
        canvasWrapper.style.width = `${width}px`;
        canvasWrapper.style.height = `${height}px`;
        
        // Center the canvas within the wrapper
        canvas.style.position = 'absolute';
        canvas.style.left = '50%';
        canvas.style.top = '50%';
        canvas.style.transform = 'translate(-50%, -50%)';
        
        // Center the view on the canvas
        setTimeout(centerCanvas, 100);
    }
    
    // Set up scroll controls
    document.getElementById('scroll-up').addEventListener('click', () => {
        container.scrollBy({
            top: -100,
            behavior: 'smooth'
        });
    });
    
    document.getElementById('scroll-down').addEventListener('click', () => {
        container.scrollBy({
            top: 100,
            behavior: 'smooth'
        });
    });
    
    document.getElementById('scroll-left').addEventListener('click', () => {
        container.scrollBy({
            left: -200,
            behavior: 'smooth'
        });
    });
    
    document.getElementById('scroll-right').addEventListener('click', () => {
        container.scrollBy({
            left: 200,
            behavior: 'smooth'
        });
    });
    
    // Set up zoom controls
    document.getElementById('zoom-in').addEventListener('click', () => {
        if (scale < maxScale) {
            scale += scaleStep;
            applyZoom();
        }
    });
    
    document.getElementById('zoom-out').addEventListener('click', () => {
        if (scale > minScale) {
            scale -= scaleStep;
            applyZoom();
        }
    });
    
    document.getElementById('reset-zoom').addEventListener('click', () => {
        scale = 1;
        applyZoom();
        centerCanvas();
    });
    
    // Apply zoom transformation
    function applyZoom() {
        canvasWrapper.style.transform = `scale(${scale})`;
        canvasWrapper.style.transformOrigin = '0 0';
        
        // Update the transform property for better rendering
        const transform = `scale(${scale})`;
        canvasWrapper.style.transform = transform;
        canvasWrapper.style.webkitTransform = transform;
        canvasWrapper.style.msTransform = transform;
        canvasWrapper.style.mozTransform = transform;
        
        // Update cursor based on zoom level
        if (scale > 1) {
            container.style.cursor = 'grab';
        } else {
            container.style.cursor = 'default';
        }
        
        // Save zoom level to localStorage
        localStorage.setItem('canvasZoom', scale);
    }
    
    // Center the canvas in the view
    function centerCanvas() {
        if (!container || !canvas) return;
        
        const containerRect = container.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        
        // Calculate center position
        const centerX = (canvasRect.width - containerRect.width) / 2;
        const centerY = (canvasRect.height - containerRect.height) / 2;
        
        // Scroll to center
        container.scrollTo({
            left: Math.max(0, centerX),
            top: Math.max(0, centerY),
            behavior: 'auto'
        });
    }
    
    // Load saved zoom level
    const savedZoom = parseFloat(localStorage.getItem('canvasZoom'));
    if (savedZoom && !isNaN(savedZoom)) {
        scale = Math.min(Math.max(savedZoom, minScale), maxScale);
    }
    
    // Initialize
    updateCanvasWrapperSize();
    applyZoom();
    centerCanvas();
    
    // Handle window resize
    window.addEventListener('resize', () => {
        updateCanvasWrapperSize();
        centerCanvas();
    });
    
    // Enable panning when zoomed in
    let isDragging = false;
    let startX, startY;
    let scrollLeft, scrollTop;
    
    container.addEventListener('mousedown', (e) => {
        if (scale <= 1) return;
        
        isDragging = true;
        startX = e.pageX - container.offsetLeft;
        startY = e.pageY - container.offsetTop;
        scrollLeft = container.scrollLeft;
        scrollTop = container.scrollTop;
        container.style.cursor = 'grabbing';
    });
    
    container.addEventListener('mouseleave', () => {
        isDragging = false;
        if (scale > 1) {
            container.style.cursor = 'grab';
        }
    });
    
    container.addEventListener('mouseup', () => {
        isDragging = false;
        if (scale > 1) {
            container.style.cursor = 'grab';
        }
    });
    
    container.addEventListener('mousemove', (e) => {
        if (!isDragging || scale <= 1) return;
        e.preventDefault();
        
        const x = e.pageX - container.offsetLeft;
        const y = e.pageY - container.offsetTop;
        const walkX = (x - startX) * 1.5; // Adjust the multiplier for pan speed
        const walkY = (y - startY) * 1.5;
        
        container.scrollLeft = scrollLeft - walkX;
        container.scrollTop = scrollTop - walkY;
    });
    
    // Enable mouse wheel zooming
    container.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            
            // Get mouse position relative to container
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Calculate the scroll position before zoom
            const scrollX = container.scrollLeft + mouseX;
            const scrollY = container.scrollTop + mouseY;
            
            // Calculate the mouse position in canvas coordinates
            const canvasX = (scrollX) / scale;
            const canvasY = (scrollY) / scale;
            
            // Update scale
            const delta = e.deltaY > 0 ? -scaleStep : scaleStep;
            const newScale = Math.min(Math.max(scale + delta, minScale), maxScale);
            
            if (newScale !== scale) {
                scale = newScale;
                applyZoom();
                
                // Calculate new scroll position to zoom toward mouse
                const newScrollX = canvasX * scale - mouseX;
                const newScrollY = canvasY * scale - mouseY;
                
                container.scrollTo({
                    left: newScrollX,
                    top: newScrollY,
                    behavior: 'auto'
                });
            }
        }
    }, { passive: false });
});
