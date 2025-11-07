# detect_uml.py
import sys
import json
import os
from ultralytics import YOLO
import torch

def detect_uml_elements(weights_path, image_path, conf_threshold=0.5, img_size=640, device='0'):
    try:
        # Disable YOLO's automatic download
        os.environ['YOLO_DISABLE_DOWNLOAD'] = '1'
        
        # Verify model file exists
        abs_weights_path = os.path.abspath(weights_path)
        if not os.path.exists(abs_weights_path):
            return [{"error": f"Custom model not found at {abs_weights_path}", "code": "MODEL_NOT_FOUND"}]
            
        # Set device
        device = 'cuda:0' if torch.cuda.is_available() and device != 'cpu' else 'cpu'
        
        # Load model with custom classes
        model = YOLO(abs_weights_path, task='detect')
        
        # Force use of our model by setting custom class names
        model.model.names = {
            0: 'Aggregation', 1: 'Anchor', 2: 'Association', 
            3: 'Class', 4: 'Containment', 5: 'Dependency', 
            6: 'Generalization', 7: 'Model', 8: 'Realization', 
            9: 'composition'
        }
            
        # Suppress YOLO download messages
        import warnings
        from ultralytics.utils.downloads import is_url
        
        # Disable download progress bar
        os.environ['YOLO_VERBOSE'] = 'False'
        
        # Load the YOLOv8 model with custom classes
        model = YOLO(weights_path, task='detect')
        
        # Force use of our model by setting classes
        if hasattr(model, 'model'):
            model.model.names = {
                0: 'Aggregation', 1: 'Anchor', 2: 'Association', 
                3: 'Class', 4: 'Containment', 5: 'Dependency', 
                6: 'Generalization', 7: 'Model', 8: 'Realization', 
                9: 'composition'
            }
        
        # Read the image
        if not os.path.exists(image_path):
            return [{"error": f"Image not found: {image_path}"}]
        
        # Run inference
        results = model(image_path, conf=conf_threshold, imgsz=img_size, device=device)
        
        # Process results
        detections = []
        
        for result in results:
            for box in result.boxes:
                # Get coordinates
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                width = x2 - x1
                height = y2 - y1
                
                # Get class name and confidence
                class_id = int(box.cls[0])
                class_name = model.names[class_id] if hasattr(model, 'names') else str(class_id)
                confidence = float(box.conf[0])
                
                detections.append({
                    'class': class_name,
                    'x': x1,
                    'y': y1,
                    'w': width,
                    'h': height,
                    'confidence': confidence
                })
        
        # If no detections, return a message
        if not detections:
            return [{"message": "No objects detected", "classes_available": list(model.names.values())}]
        
        return detections
        
    except Exception as e:
        return [{"error": str(e), "type": type(e).__name__}]

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Detect UML elements in an image')
    parser.add_argument('--weights', type=str, 
                      default=os.path.join(os.path.dirname(__file__), 'best.pt'), 
                      help='Path to model weights')
    print(f"Using model at: {os.path.abspath(os.path.join(os.path.dirname(__file__), 'best.pt'))}")
    parser.add_argument('--source', type=str, required=True, help='Path to input image')
    parser.add_argument('--conf', type=float, default=0.5, help='Confidence threshold')
    parser.add_argument('--imgsz', type=int, default=640, help='Image size for inference')
    parser.add_argument('--device', type=str, default='0', help='Device to run on (e.g., 0 for GPU, "cpu" for CPU)')
    
    args = parser.parse_args()
    
    # Run detection
    detections = detect_uml_elements(
        weights_path=args.weights,
        image_path=args.source,
        conf_threshold=args.conf,
        img_size=args.imgsz,
        device=args.device
    )
    
    # Print results as JSON
    print(json.dumps(detections))

if __name__ == '__main__':
    main()