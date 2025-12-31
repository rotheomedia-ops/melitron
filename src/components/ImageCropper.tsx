import React, { useRef, useEffect, useState, useCallback } from 'react';
import { UploadedImage } from '../types';
import { useTranslations } from '../context/LanguageContext';

interface ImageCropperProps {
  image: UploadedImage;
  onSave: (croppedImage: UploadedImage) => void;
  onCancel: () => void;
}

type AspectRatio = { label: string; value: number | null };

const aspectRatios: AspectRatio[] = [
  { label: 'freeform', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
];

const MIN_CROP_SIZE = 20; // Minimum size of crop box in pixels

const ImageCropper: React.FC<ImageCropperProps> = ({ image, onSave, onCancel }) => {
  const { t } = useTranslations();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(new Image());
  const containerRef = useRef<HTMLDivElement>(null);

  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [activeAspectRatio, setActiveAspectRatio] = useState<AspectRatio>(aspectRatios[0]);
  const [dragInfo, setDragInfo] = useState<{ type: string; startX: number; startY: number; startCrop: typeof crop } | null>(null);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imageRef.current;
    if (!canvas || !container || !img.src || img.naturalWidth === 0) return;

    const { clientWidth: containerWidth, clientHeight: containerHeight } = container;
    const imgRatio = img.naturalWidth / img.naturalHeight;

    let canvasWidth = containerWidth;
    let canvasHeight = canvasWidth / imgRatio;

    if (canvasHeight > containerHeight) {
      canvasHeight = containerHeight;
      canvasWidth = canvasHeight * imgRatio;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // When canvas is setup, reset crop box based on aspect ratio
    const newRatio = activeAspectRatio.value;
    let newWidth = canvas.width * 0.8;
    let newHeight = newRatio ? newWidth / newRatio : canvas.height * 0.8;

    if (newHeight > canvas.height) {
        newHeight = canvas.height * 0.8;
        newWidth = newRatio ? newHeight * newRatio : canvas.width * 0.8;
    }

    setCrop({
      width: newWidth,
      height: newHeight,
      x: (canvas.width - newWidth) / 2,
      y: (canvas.height - newHeight) / 2,
    });

  }, [activeAspectRatio.value]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;
    if (!ctx || !canvas || !img.src || img.naturalWidth === 0) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw overlay using a path with a hole
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.rect(crop.x, crop.y, crop.width, crop.height);
    ctx.fill('evenodd');
    ctx.restore();
    
    // Draw crop box border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);

    // Draw handles
    const handleVisualSize = 12;
    const handleOffset = handleVisualSize / 2;
    
    const cornerHandles = [
      { x: crop.x, y: crop.y },
      { x: crop.x + crop.width, y: crop.y },
      { x: crop.x, y: crop.y + crop.height },
      { x: crop.x + crop.width, y: crop.y + crop.height },
    ];
    
    const sideHandles = [
      { x: crop.x + crop.width / 2, y: crop.y },
      { x: crop.x + crop.width / 2, y: crop.y + crop.height },
      { x: crop.x, y: crop.y + crop.height / 2 },
      { x: crop.x + crop.width, y: crop.y + crop.height / 2 },
    ];

    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 1.5;

    // Draw corner handles (circles)
    cornerHandles.forEach(h => {
        ctx.beginPath();
        ctx.arc(h.x, h.y, handleOffset, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    });
    
    // Draw side handles (squares)
    sideHandles.forEach(h => {
        ctx.fillRect(h.x - handleOffset, h.y - handleOffset, handleVisualSize, handleVisualSize);
        ctx.strokeRect(h.x - handleOffset, h.y - handleOffset, handleVisualSize, handleVisualSize);
    });

  }, [crop]);

  useEffect(() => {
    const img = imageRef.current;
    img.crossOrigin = 'anonymous';
    img.src = `data:${image.mimeType};base64,${image.base64}`;
    img.onload = setupCanvas;
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [image, setupCanvas]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    // This effect runs when aspect ratio changes, because setupCanvas dependency will change.
    // We only want to run it *after* the image has loaded.
    if (imageRef.current.complete && imageRef.current.naturalWidth > 0) {
      setupCanvas();
    }
  }, [setupCanvas]);


  const getDragType = (x: number, y: number) => {
    const handleHitArea = 24; // Larger for easier grabbing
    const halfHit = handleHitArea / 2;
    const { x: cx, y: cy, width: cw, height: ch } = crop;

    if (Math.abs(x - cx) < halfHit && Math.abs(y - cy) < halfHit) return 'tl';
    if (Math.abs(x - (cx + cw)) < halfHit && Math.abs(y - cy) < halfHit) return 'tr';
    if (Math.abs(x - cx) < halfHit && Math.abs(y - (cy + ch)) < halfHit) return 'bl';
    if (Math.abs(x - (cx + cw)) < halfHit && Math.abs(y - (cy + ch)) < halfHit) return 'br';
    
    if (Math.abs(x - (cx + cw / 2)) < halfHit && Math.abs(y - cy) < halfHit) return 't';
    if (Math.abs(x - (cx + cw / 2)) < halfHit && Math.abs(y - (cy + ch)) < halfHit) return 'b';
    if (Math.abs(x - cx) < halfHit && Math.abs(y - (cy + ch / 2)) < halfHit) return 'l';
    if (Math.abs(x - (cx + cw)) < halfHit && Math.abs(y - (cy + ch / 2)) < halfHit) return 'r';
    
    if (x > cx && x < cx + cw && y > cy && y < cy + ch) return 'move';
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const type = getDragType(x, y);
    if (type) {
      document.body.style.cursor = canvas.style.cursor; // Lock cursor style during drag
      setDragInfo({ type, startX: x, startY: y, startCrop: { ...crop } });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let mouseX = e.clientX - rect.left;
    let mouseY = e.clientY - rect.top;
    
    if (!dragInfo) {
      const type = getDragType(mouseX, mouseY);
      if (type === 'move') canvas.style.cursor = 'move';
      else if (type === 'tl' || type === 'br') canvas.style.cursor = 'nwse-resize';
      else if (type === 'tr' || type === 'bl') canvas.style.cursor = 'nesw-resize';
      else if (type === 't' || type === 'b') canvas.style.cursor = 'ns-resize';
      else if (type === 'l' || type === 'r') canvas.style.cursor = 'ew-resize';
      else canvas.style.cursor = 'default';
      return;
    }
    
    const { type, startCrop } = dragInfo;
    const ratio = activeAspectRatio.value;

    if (type === 'move') {
      const dx = mouseX - dragInfo.startX;
      const dy = mouseY - dragInfo.startY;
      let newX = startCrop.x + dx;
      let newY = startCrop.y + dy;
      
      newX = Math.max(0, Math.min(newX, canvas.width - startCrop.width));
      newY = Math.max(0, Math.min(newY, canvas.height - startCrop.height));

      setCrop({ ...startCrop, x: newX, y: newY });
      return;
    }
    
    // --- RESIZE LOGIC ---
    // Define the fixed anchor point for the resize operation
    const anchor = {
      x: type.includes('l') ? startCrop.x + startCrop.width : startCrop.x,
      y: type.includes('t') ? startCrop.y + startCrop.height : startCrop.y,
    };
    
    // Calculate new dimensions based on mouse position relative to anchor
    let newWidth = type.includes('l') ? anchor.x - mouseX : mouseX - anchor.x;
    let newHeight = type.includes('t') ? anchor.y - mouseY : mouseY - anchor.y;

    // Enforce aspect ratio
    if (ratio) {
      if (type === 't' || type === 'b') newWidth = newHeight * ratio;
      else if (type === 'l' || type === 'r') newHeight = newWidth / ratio;
      else if (newWidth / ratio > newHeight) newHeight = newWidth / ratio;
      else newWidth = newHeight * ratio;
    }

    // Prevent flipping by enforcing minimum size
    newWidth = Math.max(MIN_CROP_SIZE, newWidth);
    newHeight = Math.max(MIN_CROP_SIZE, newHeight);

    // Recalculate position based on new dimensions and anchor
    let newX = type.includes('l') ? anchor.x - newWidth : anchor.x;
    let newY = type.includes('t') ? anchor.y - newHeight : anchor.y;

    // Check and correct for canvas boundaries, adjusting dimensions from the anchor
    if (newX < 0) {
      newWidth += newX;
      if (ratio) newHeight = newWidth / ratio;
      newX = 0;
    }
    if (newY < 0) {
      newHeight += newY;
      if (ratio) newWidth = newHeight * ratio;
      newY = 0;
    }
    if (newX + newWidth > canvas.width) {
      newWidth = canvas.width - newX;
      if (ratio) newHeight = newWidth / ratio;
    }
    if (newY + newHeight > canvas.height) {
      newHeight = canvas.height - newY;
      if (ratio) newWidth = newHeight * ratio;
    }
    
    // After boundary corrections, position might need a final adjustment
    newX = type.includes('l') ? anchor.x - newWidth : anchor.x;
    newY = type.includes('t') ? anchor.y - newHeight : anchor.y;

    setCrop({ x: newX, y: newY, width: newWidth, height: newHeight });
  };
  
  
  const handleMouseUp = () => {
    document.body.style.cursor = 'default';
    setDragInfo(null);
  };
  
  const handleSave = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img.src || img.naturalWidth === 0) return;

    const scaleX = img.naturalWidth / canvas.width;
    const scaleY = img.naturalHeight / canvas.height;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = Math.round(crop.width * scaleX);
    finalCanvas.height = Math.round(crop.height * scaleY);
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(
        img,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0, 0,
        finalCanvas.width,
        finalCanvas.height
    );

    const mimeType = image.mimeType.includes('png') ? 'image/png' : 'image/jpeg';
    const base64 = finalCanvas.toDataURL(mimeType).split(',')[1];
    onSave({ base64, mimeType });
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col items-center justify-center p-4" role="dialog" onMouseUp={handleMouseUp}>
      <div className="w-full h-full flex flex-col gap-4">
        <div ref={containerRef} className="flex-grow w-full h-full min-h-0 flex items-center justify-center" onMouseMove={handleMouseMove} onMouseLeave={handleMouseUp}>
          <canvas ref={canvasRef} className="max-w-full max-h-full" onMouseDown={handleMouseDown} />
        </div>
        <div className="flex-shrink-0 bg-gray-800 p-3 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-white font-semibold text-sm mr-2">{t('aspectRatioTitle')}:</span>
            {aspectRatios.map(ar => (
              <button
                key={ar.label}
                onClick={() => setActiveAspectRatio(ar)}
                className={`px-3 py-1 text-sm rounded transition-colors ${activeAspectRatio.label === ar.label ? 'bg-purple-600' : 'bg-gray-600 hover:bg-gray-500'}`}
              >
                {t(ar.label as any) || ar.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
              {t('applyCrop')}
            </button>
            <button onClick={onCancel} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;