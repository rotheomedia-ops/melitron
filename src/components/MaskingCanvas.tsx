import React, { useRef, useEffect, useState, useCallback } from 'react';
import { UploadedImage } from '../types';
import { useTranslations } from '../context/LanguageContext';

interface MaskingCanvasProps {
  image: UploadedImage;
  mask?: UploadedImage | null;
  onSaveMask: (mask: UploadedImage) => void;
  onCancel: () => void;
}

type Tool = 'brush' | 'eraser' | 'lasso' | 'polygon' | 'rectangle' | 'circle';

type BrushOptions = {
  size: number;
  feather: number;
  flow: number; // 0-100
  jitter: number; // 0-100
};

const ToolButton: React.FC<{ iconClassName: string; label: string; isActive: boolean; onClick: () => void }> = ({ iconClassName, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-2 rounded-md transition-transform duration-200 w-20 h-16 ${isActive ? 'bg-purple-600 text-white scale-110 shadow-lg' : 'bg-gray-600 hover:bg-gray-500'}`}
        aria-label={label}
        aria-pressed={isActive}
    >
        <i className={`${iconClassName} text-2xl`} aria-hidden="true"></i>
        <span className="text-xs font-semibold mt-1">{label}</span>
    </button>
);


const MaskingCanvas: React.FC<MaskingCanvasProps> = ({ image, mask, onSaveMask, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasState = useRef<ImageData | null>(null);
  const lastPoint = useRef<{ x: number, y: number } | null>(null);
  const currentLassoPath = useRef<{ x: number; y: number }[]>([]);
  const cursorRef = useRef<HTMLDivElement>(null);
  
  const { t } = useTranslations();
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushOptions, setBrushOptions] = useState<BrushOptions>({ size: 30, feather: 0, flow: 100, jitter: 0 });
  const [currentTool, setCurrentTool] = useState<Tool>('brush');
  const [polygonPoints, setPolygonPoints] = useState<{ x: number; y: number }[]>([]);
  const [shapeStartPoint, setShapeStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [isMouseOnCanvas, setIsMouseOnCanvas] = useState(false);

  const setupCanvas = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setContext(ctx);

    const img = new Image();
    img.src = `data:${image.mimeType};base64,${image.base64}`;
    img.onload = () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const imgAspectRatio = img.width / img.height;
      
      let canvasWidth = containerWidth;
      let canvasHeight = containerWidth / imgAspectRatio;
      
      if (canvasHeight > containerHeight) {
          canvasHeight = containerHeight;
          canvasWidth = containerHeight * imgAspectRatio;
      }
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (mask) {
        const maskImg = new Image();
        maskImg.src = `data:${mask.mimeType};base64,${mask.base64}`;
        maskImg.onload = () => {
            ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const isWhite = data[i] > 200;
                if (isWhite) {
                    data[i] = 255;
                    data[i + 1] = 255;
                    data[i + 2] = 255;
                    data[i + 3] = 255 * 0.7;
                } else {
                    data[i + 3] = 0;
                }
            }
            ctx.putImageData(imageData, 0, 0);
        }
      }
    };
  }, [image, mask]);

  useEffect(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => {
      window.removeEventListener('resize', setupCanvas);
    };
  }, [setupCanvas]);
  
  const resetDrawingState = useCallback(() => {
    if (context && canvasState.current) {
        context.putImageData(canvasState.current, 0, 0);
    }
    setPolygonPoints([]);
    setShapeStartPoint(null);
    canvasState.current = null;
    setIsDrawing(false);
    currentLassoPath.current = [];
    lastPoint.current = null;
  }, [context]);

  const switchTool = (tool: Tool) => {
    resetDrawingState();
    setCurrentTool(tool);
  };

  const drawFinalShape = useCallback((points: {x: number, y: number}[]) => {
      if (!context || points.length < 2) return;
      context.globalCompositeOperation = 'source-over';
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for(let i = 1; i < points.length; i++) {
          context.lineTo(points[i].x, points[i].y);
      }
      context.closePath();
      context.fillStyle = 'rgba(255, 255, 255, 0.7)';
      context.fill();
  }, [context]);
  
  const closePathAndFill = useCallback(() => {
      if (polygonPoints.length < 3) {
          resetDrawingState();
          return;
      }
      if (context && canvasState.current) {
          context.putImageData(canvasState.current, 0, 0);
      }
      drawFinalShape(polygonPoints);
      setPolygonPoints([]);
      canvasState.current = null;
  }, [context, polygonPoints, resetDrawingState, drawFinalShape]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentTool === 'polygon' && polygonPoints.length > 0) {
        if (e.key === 'Escape') {
          resetDrawingState();
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          closePathAndFill();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentTool, polygonPoints, resetDrawingState, closePathAndFill]);


  const getCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const drawBrushStroke = useCallback((from: {x:number, y:number}, to: {x:number, y:number}) => {
    if (!context) return;
    
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const stepSize = Math.min(5, brushOptions.size / 4);

    context.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
    context.globalAlpha = brushOptions.flow / 100;
    
    for (let i = 0; i < distance; i += stepSize) {
        const x = from.x + Math.cos(angle) * i;
        const y = from.y + Math.sin(angle) * i;
        
        const currentJitter = (brushOptions.jitter / 100) * (Math.random() - 0.5); // centered jitter
        const currentSize = Math.max(1, brushOptions.size * (1 + currentJitter));
        const radius = currentSize / 2;

        context.shadowBlur = brushOptions.feather;
        context.shadowColor = 'white';
        context.fillStyle = 'white';

        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }
    context.shadowBlur = 0;
    context.globalAlpha = 1.0;
  }, [context, brushOptions, currentTool]);
  
  const handleCanvasMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (!context) return;
      e.preventDefault();
      const coords = getCoords(e);
      setIsDrawing(true);
      
      switch(currentTool) {
        case 'brush':
        case 'eraser':
          lastPoint.current = coords;
          drawBrushStroke(coords, coords); // Draw a single dab
          break;
        case 'lasso':
          canvasState.current = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
          currentLassoPath.current = [coords];
          break;
        case 'rectangle':
        case 'circle':
          canvasState.current = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
          setShapeStartPoint(coords);
          break;
      }
  };
  
  const handleCanvasMouseUp = (e: MouseEvent | React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !context) return;
      
      switch(currentTool) {
        case 'lasso':
          if (canvasState.current) {
              context.putImageData(canvasState.current, 0, 0);
          }
          drawFinalShape(currentLassoPath.current);
          break;
        case 'rectangle':
        case 'circle':
          if (shapeStartPoint && canvasState.current) {
            context.putImageData(canvasState.current, 0, 0);
            const endPoint = getCoords(e);
            
            context.globalCompositeOperation = 'source-over';
            context.fillStyle = 'rgba(255, 255, 255, 0.7)';

            if (currentTool === 'rectangle') {
              context.fillRect(shapeStartPoint.x, shapeStartPoint.y, endPoint.x - shapeStartPoint.x, endPoint.y - shapeStartPoint.y);
            } else { // Circle
              const dx = endPoint.x - shapeStartPoint.x;
              const dy = endPoint.y - shapeStartPoint.y;
              const radius = Math.hypot(dx, dy);
              context.beginPath();
              context.arc(shapeStartPoint.x, shapeStartPoint.y, radius, 0, Math.PI * 2);
              context.fill();
            }
          }
          break;
      }
      resetDrawingState();
  }

  const handleCanvasMouseMove = (e: React.MouseEvent | React.TouchEvent | MouseEvent) => {
    if (!context || !canvasRef.current) return;
    const coords = getCoords(e);

    if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${coords.x}px, ${coords.y}px)`;
    }
    
    if (!isDrawing) return;
    e.preventDefault();

    switch(currentTool) {
        case 'brush':
        case 'eraser':
          if (lastPoint.current) {
            drawBrushStroke(lastPoint.current, coords);
            lastPoint.current = coords;
          }
          break;
        case 'lasso':
            currentLassoPath.current.push(coords);
            if (canvasState.current) {
                context.putImageData(canvasState.current, 0, 0);
                context.globalCompositeOperation = 'source-over';
                context.beginPath();
                context.moveTo(currentLassoPath.current[0].x, currentLassoPath.current[0].y);
                for (let i = 1; i < currentLassoPath.current.length; i++) {
                    context.lineTo(currentLassoPath.current[i].x, currentLassoPath.current[i].y);
                }
                context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                context.lineWidth = 2;
                context.setLineDash([5, 5]);
                context.stroke();
                context.setLineDash([]);
            }
            break;
        case 'rectangle':
        case 'circle':
            if (shapeStartPoint && canvasState.current) {
              context.putImageData(canvasState.current, 0, 0);
              context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
              context.lineWidth = 2;
              context.setLineDash([5, 5]);
              if (currentTool === 'rectangle') {
                context.strokeRect(shapeStartPoint.x, shapeStartPoint.y, coords.x - shapeStartPoint.x, coords.y - shapeStartPoint.y);
              } else {
                const radius = Math.hypot(coords.x - shapeStartPoint.x, coords.y - shapeStartPoint.y);
                context.beginPath();
                context.arc(shapeStartPoint.x, shapeStartPoint.y, radius, 0, 2 * Math.PI);
                context.stroke();
              }
              context.setLineDash([]);
            }
            break;
        case 'polygon':
            if (polygonPoints.length > 0 && canvasState.current) {
                context.putImageData(canvasState.current, 0, 0);
                context.globalCompositeOperation = 'source-over';
                context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                context.lineWidth = 2;
                context.setLineDash([5, 5]);
                
                context.beginPath();
                context.moveTo(polygonPoints[0].x, polygonPoints[0].y);
                for(let i=1; i < polygonPoints.length; i++) {
                    context.lineTo(polygonPoints[i].x, polygonPoints[i].y);
                }
                context.stroke();

                context.beginPath();
                context.moveTo(polygonPoints[polygonPoints.length - 1].x, polygonPoints[polygonPoints.length - 1].y);
                context.lineTo(coords.x, coords.y);
                context.stroke();
                context.setLineDash([]);
            }
            break;
    }
  };
  
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (currentTool !== 'polygon' || !context) return;
    
    if (polygonPoints.length === 0) {
        canvasState.current = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    }
    
    const { x, y } = getCoords(e);
    
    if (polygonPoints.length > 2) {
        const startPoint = polygonPoints[0];
        if (Math.hypot(startPoint.x - x, startPoint.y - y) < 10) {
            closePathAndFill();
            return;
        }
    }
    
    setPolygonPoints([...polygonPoints, { x, y }]);
  };


  const handleSave = () => {
    if (!canvasRef.current) return;

    const originalCanvas = canvasRef.current;
    const maskCanvas = document.createElement('canvas');
    const img = new Image();
    img.src = `data:${image.mimeType};base64,${image.base64}`;
    img.onload = () => {
        maskCanvas.width = img.width;
        maskCanvas.height = img.height;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) return;

        maskCtx.fillStyle = 'black';
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskCtx.drawImage(originalCanvas, 0, 0, maskCanvas.width, maskCanvas.height);

        const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0) {
                data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
            } else {
                data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
            }
            data[i + 3] = 255;
        }
        maskCtx.putImageData(imageData, 0, 0);

        const base64 = maskCanvas.toDataURL('image/png').split(',')[1];
        onSaveMask({ base64, mimeType: 'image/png' });
    }
  };

  const getCanvasCursor = () => {
    switch (currentTool) {
        case 'brush':
        case 'eraser':
            return 'cursor-none';
        case 'polygon':
        case 'rectangle':
        case 'circle':
            return 'cursor-crosshair';
        default:
            return 'cursor-auto';
    }
  };

  const handleBrushOptionChange = (option: keyof BrushOptions, value: number) => {
    setBrushOptions(prev => ({ ...prev, [option]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="mask-dialog-title">
      <div className="relative w-full h-full flex flex-col gap-4">
        <div id="mask-dialog-title" className="text-center text-white text-lg font-bold">
          {t('maskCanvasTitle')}
           {currentTool === 'polygon' && polygonPoints.length > 0 && <span className="text-sm font-normal text-gray-300 block">{t('polygonHelp')}</span>}
        </div>
        <div ref={containerRef} className="flex-grow w-full h-full min-h-0 flex items-center justify-center"
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={() => { handleCanvasMouseUp; setIsMouseOnCanvas(false); }}
            onMouseEnter={() => setIsMouseOnCanvas(true)}
        >
            <div className="relative" style={{ aspectRatio: canvasRef.current ? `${canvasRef.current.width}/${canvasRef.current.height}` : '1 / 1', width: canvasRef.current?.width, height: canvasRef.current?.height, touchAction: 'none' }}>
                <img src={`data:${image.mimeType};base64,${image.base64}`} alt="Background" className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
                <canvas
                    ref={canvasRef}
                    className={`absolute top-0 left-0 w-full h-full ${getCanvasCursor()}`}
                    onMouseDown={handleCanvasMouseDown}
                    onClick={handleCanvasClick}
                    onTouchStart={handleCanvasMouseDown}
                    onTouchEnd={handleCanvasMouseUp}
                    onTouchMove={handleCanvasMouseMove}
                />
                 {(currentTool === 'brush' || currentTool === 'eraser') && isMouseOnCanvas && (
                    <div 
                        ref={cursorRef}
                        className="absolute top-0 left-0 rounded-full border border-white pointer-events-none -translate-x-1/2 -translate-y-1/2"
                        style={{
                           width: brushOptions.size,
                           height: brushOptions.size,
                           background: brushOptions.feather > 0
                               ? `radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 70%)`
                               : 'rgba(255,255,255,0.3)'
                        }}
                    />
                )}
            </div>
        </div>
        <div className="flex-shrink-0 bg-gray-800 p-3 rounded-lg flex flex-col xl:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap justify-center">
                <ToolButton iconClassName="fa-solid fa-paintbrush" label={t('brushTool')} isActive={currentTool === 'brush'} onClick={() => switchTool('brush')} />
                <ToolButton iconClassName="fa-solid fa-eraser" label={t('eraserTool')} isActive={currentTool === 'eraser'} onClick={() => switchTool('eraser')} />
                <ToolButton iconClassName="fa-solid fa-lasso" label={t('lassoTool')} isActive={currentTool === 'lasso'} onClick={() => switchTool('lasso')} />
                <ToolButton iconClassName="fa-solid fa-draw-polygon" label={t('polygonTool')} isActive={currentTool === 'polygon'} onClick={() => switchTool('polygon')} />
                <ToolButton iconClassName="fa-solid fa-vector-square" label={t('rectangleTool')} isActive={currentTool === 'rectangle'} onClick={() => switchTool('rectangle')} />
                <ToolButton iconClassName="fa-regular fa-circle" label={t('circleTool')} isActive={currentTool === 'circle'} onClick={() => switchTool('circle')} />
            </div>

            {(currentTool === 'brush' || currentTool === 'eraser') && (
                 <div className="flex items-center flex-wrap justify-center gap-x-4 gap-y-2 bg-gray-700 p-2 rounded-lg">
                    <h4 className="text-white text-sm font-semibold text-center w-full mb-1">{t('brushSettings')}</h4>
                    <div className="flex items-center gap-2">
                      <label htmlFor="brushSize" className="text-white text-xs font-medium w-12">{t('brushSize')}</label>
                      <input id="brushSize" type="range" min="1" max="150" value={brushOptions.size} onChange={(e) => handleBrushOptionChange('size', Number(e.target.value))} className="w-24 accent-purple-500" />
                      <span className="text-white font-mono text-xs w-8 text-center bg-gray-600 rounded p-1">{brushOptions.size}</span>
                    </div>
                     <div className="flex items-center gap-2">
                      <label htmlFor="brushFeather" className="text-white text-xs font-medium w-12">{t('feather')}</label>
                      <input id="brushFeather" type="range" min="0" max="100" value={brushOptions.feather} onChange={(e) => handleBrushOptionChange('feather', Number(e.target.value))} className="w-24 accent-purple-500" />
                      <span className="text-white font-mono text-xs w-8 text-center bg-gray-600 rounded p-1">{brushOptions.feather}</span>
                    </div>
                     <div className="flex items-center gap-2">
                      <label htmlFor="brushFlow" className="text-white text-xs font-medium w-12">{t('flow')}</label>
                      <input id="brushFlow" type="range" min="1" max="100" value={brushOptions.flow} onChange={(e) => handleBrushOptionChange('flow', Number(e.target.value))} className="w-24 accent-purple-500" />
                      <span className="text-white font-mono text-xs w-8 text-center bg-gray-600 rounded p-1">{brushOptions.flow}</span>
                    </div>
                     <div className="flex items-center gap-2">
                      <label htmlFor="brushJitter" className="text-white text-xs font-medium w-12">{t('jitter')}</label>
                      <input id="brushJitter" type="range" min="0" max="100" value={brushOptions.jitter} onChange={(e) => handleBrushOptionChange('jitter', Number(e.target.value))} className="w-24 accent-purple-500" />
                      <span className="text-white font-mono text-xs w-8 text-center bg-gray-600 rounded p-1">{brushOptions.jitter}</span>
                    </div>
                </div>
            )}
            
            <div className="flex items-center gap-2">
                <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    {t('saveMask')}
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

export default MaskingCanvas;