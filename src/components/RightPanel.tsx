import React, { useRef, useEffect, useState } from 'react';
import { DepthMapControlsState, AppMode, Layer, LayerTransform, PhotoBashViewport, DrawingTool, DrawingLayer } from '../types';
import { useTranslations } from '../context/LanguageContext';
import { dataURLtoBlob } from '../utils';

interface RightPanelProps {
  isLoading: boolean;
  displayImage: string | null;
  error: string | null;
  promptSuggestion: string | null;
  editCurrentImage: () => void;
  cropCurrentImage: () => void;
  resetForNewImage: () => void;
  isDepthMapResult: boolean;
  depthMapControls: DepthMapControlsState;
  setDepthMapControls: (controls: DepthMapControlsState) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isEditing: boolean;
  isVideoLoading: boolean;
  videoResultUrls: string[];
  videoError: string | null;
  appMode: AppMode;
  createHistory: string[];
  setGeneratedImage: (image: string | null) => void;
  isHistoryVisible: boolean;
  setIsHistoryVisible: (visible: boolean) => void;
  imageInfo: string | null;
  dpiForDownload?: number | null;
  // Photo Bash Props
  photoBashLayers: Layer[];
  setPhotoBashLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  photoBashCanvasSize: {width: number, height: number} | null;
  photoBashViewport: PhotoBashViewport;
  setPhotoBashViewport: React.Dispatch<React.SetStateAction<PhotoBashViewport>>;
  drawingSettings: { tool: DrawingTool; color: string; size: number; opacity: number; };
}

const videoLoadingMessageKeys = [
  'videoLoadingMessage1',
  'videoLoadingMessage2',
  'videoLoadingMessage3',
  'videoLoadingMessage4',
  'videoLoadingMessage5',
] as const;


const RightPanel: React.FC<RightPanelProps> = ({ 
  isLoading, displayImage, error, promptSuggestion, editCurrentImage, cropCurrentImage, resetForNewImage,
  isDepthMapResult, depthMapControls, setDepthMapControls,
  onUndo, onRedo, canUndo, canRedo, isEditing,
  isVideoLoading, videoResultUrls, videoError,
  appMode, createHistory, setGeneratedImage,
  isHistoryVisible, setIsHistoryVisible,
  imageInfo,
  dpiForDownload,
  // Photo Bash Props
  photoBashLayers, setPhotoBashLayers, selectedLayerId, setSelectedLayerId, photoBashCanvasSize,
  photoBashViewport, setPhotoBashViewport,
  drawingSettings
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useTranslations();
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  // Photo Bash states
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [dragInfo, setDragInfo] = useState<{
      type: 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'rot';
      layerId: string;
      startX: number;
      startY: number;
      startTransform: LayerTransform;
      layerRect: DOMRect;
      center: { x: number; y: number };
  } | null>(null);
  const gestureStateRef = useRef<{
    initialViewport: PhotoBashViewport;
    initialDistance: number;
    initialAngle: number;
    initialMidpoint: { x: number; y: number };
  } | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPointRef = useRef<{ x: number, y: number } | null>(null);
  const brushCursorRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    setCurrentVideoIndex(0);
  }, [videoResultUrls]);

  const handleVideoEnded = () => {
      if (videoResultUrls && currentVideoIndex < videoResultUrls.length - 1) {
          setCurrentVideoIndex(currentVideoIndex + 1);
      }
  };


  useEffect(() => {
    let interval: number | undefined;
    if (isVideoLoading) {
      setLoadingMessageIndex(0); 
      interval = window.setInterval(() => {
        setLoadingMessageIndex(prevIndex => (prevIndex + 1) % videoLoadingMessageKeys.length);
      }, 5000); 
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isVideoLoading]);

  useEffect(() => {
    if (isDepthMapResult && displayImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const { invert, contrast: contrastVal, brightness: brightnessVal, nearClip, farClip } = depthMapControls;
        
        const actualNearClip = Math.min(nearClip, farClip);
        const actualFarClip = Math.max(nearClip, farClip);

        const contrast = contrastVal / 100;
        const brightness = brightnessVal / 100;
        const nearClipValue = (actualNearClip / 100) * 255;
        const farClipValue = (actualFarClip / 100) * 255;
        const clipRange = farClipValue - nearClipValue;


        for (let i = 0; i < data.length; i += 4) {
          let v = (data[i] + data[i+1] + data[i+2]) / 3;
          v *= brightness;
          v = (v - 127.5) * contrast + 127.5;
          v = Math.max(nearClipValue, Math.min(farClipValue, v));
          if (clipRange > 0) {
            v = ((v - nearClipValue) / clipRange) * 255;
          } else {
            v = v >= farClipValue ? 255 : 0;
          }
          if (invert) {
            v = 255 - v;
          }
          v = Math.max(0, Math.min(255, v));

          data[i] = v;
          data[i + 1] = v;
          data[i + 2] = v;
        }
        ctx.putImageData(imageData, 0, 0);
      };
      image.src = displayImage;
    }
  }, [displayImage, isDepthMapResult, depthMapControls]);


  const downloadImage = () => {
    if (!displayImage && !(isDepthMapResult && canvasRef.current)) return;

    let href: string;
    let downloadName: string;
    let dataUrl = displayImage;

    if (isDepthMapResult && canvasRef.current) {
        dataUrl = canvasRef.current.toDataURL('image/jpeg');
        downloadName = `depth-map-${Date.now()}.jpg`;
    } else if (displayImage) {
        const mimeType = displayImage.substring(displayImage.indexOf(':') + 1, displayImage.indexOf(';'));
        const extension = mimeType.split('/')[1] || 'jpg';
        const dpiString = dpiForDownload && dpiForDownload > 72 ? `-${dpiForDownload}dpi` : '';
        downloadName = `ai-image-${Date.now()}${dpiString}.${extension}`;
    } else {
        return;
    }

    if (!dataUrl) return;

    const blob = dataURLtoBlob(dataUrl);
    if (!blob) return;

    href = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = href;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(href);
  };
  
  const handleControlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setDepthMapControls({
        ...depthMapControls,
        [name]: type === 'checkbox' ? checked : Number(value)
    });
  }

  // Photo Bash Handlers
  const fitToScreen = () => {
    if (!viewportRef.current || !photoBashCanvasSize) return;
    const viewportRect = viewportRef.current.getBoundingClientRect();
    const { width: canvasWidth, height: canvasHeight } = photoBashCanvasSize;
    
    if (canvasWidth === 0 || canvasHeight === 0) return;

    const scaleX = viewportRect.width / canvasWidth;
    const scaleY = viewportRect.height / canvasHeight;

    const newZoom = Math.min(scaleX, scaleY) * 0.95; // 95% to leave some padding

    setPhotoBashViewport({
        pan: { x: 0, y: 0 },
        zoom: newZoom,
        rotation: 0
    });
  }

  useEffect(() => {
    if(appMode === AppMode.PhotoBash && photoBashCanvasSize) {
      fitToScreen();
    }
  }, [photoBashCanvasSize, appMode]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSpeed = 0.005;
    const { zoom, pan } = photoBashViewport;
    
    const newZoom = Math.max(0.1, Math.min(10, zoom - e.deltaY * zoomSpeed * zoom)); // Clamp zoom

    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - (rect.width/2);
    const mouseY = e.clientY - rect.top - (rect.height/2);

    const newPan = {
      x: pan.x - (mouseX - pan.x) * (newZoom/zoom - 1),
      y: pan.y - (mouseY - pan.y) * (newZoom/zoom - 1),
    };

    setPhotoBashViewport(v => ({...v, zoom: newZoom, pan: newPan}));
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      gestureStateRef.current = {
        initialViewport: { ...photoBashViewport },
        initialDistance: Math.hypot(dx, dy),
        initialAngle: Math.atan2(dy, dx) * 180 / Math.PI,
        initialMidpoint: { x: (t1.clientX + t2.clientX)/2, y: (t1.clientY + t2.clientY)/2 },
      };
    }
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && gestureStateRef.current) {
        e.preventDefault();
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const { initialViewport, initialDistance, initialAngle, initialMidpoint } = gestureStateRef.current;
        
        const dx = t2.clientX - t1.clientX;
        const dy = t2.clientY - t1.clientY;
        const currentDistance = Math.hypot(dx, dy);
        const currentAngle = Math.atan2(dy, dx) * 180 / Math.PI;
        const currentMidpoint = { x: (t1.clientX + t2.clientX)/2, y: (t1.clientY + t2.clientY)/2 };

        const zoomFactor = currentDistance / initialDistance;
        const newZoom = Math.max(0.1, Math.min(10, initialViewport.zoom * zoomFactor));

        const angleDelta = currentAngle - initialAngle;
        const newRotation = initialViewport.rotation + angleDelta;
        
        const panDelta = { x: currentMidpoint.x - initialMidpoint.x, y: currentMidpoint.y - initialMidpoint.y };
        const newPan = { x: initialViewport.pan.x + panDelta.x, y: initialViewport.pan.y + panDelta.y };

        setPhotoBashViewport({ zoom: newZoom, rotation: newRotation, pan: newPan });
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (gestureStateRef.current) {
          gestureStateRef.current = null;
      }
  }

  const startLayerDrag = (e: React.MouseEvent | React.TouchEvent, layerId: string, type: 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'rot') => {
      e.stopPropagation();
      if (gestureStateRef.current) return; // Don't drag layer if viewport gesture is active
      
      setSelectedLayerId(layerId);

      const layer = photoBashLayers.find(l => l.id === layerId);
      const layerElement = document.getElementById(layerId);
      if (!layer || !layerElement || !canvasContainerRef.current) return;
      
      const layerRect = layerElement.getBoundingClientRect();
      const containerRect = canvasContainerRef.current.getBoundingClientRect();

      const center = {
          x: layerRect.left - containerRect.left + layerRect.width / 2,
          y: layerRect.top - containerRect.top + layerRect.height / 2,
      };
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      setDragInfo({
          type,
          layerId,
          startX: clientX,
          startY: clientY,
          startTransform: layer.transform,
          layerRect,
          center,
      });
  };

  const handleLayerMouseDown = (e: React.MouseEvent, layerId: string, type: 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'rot') => {
    if (e.button !== 0) return;
    e.preventDefault();
    startLayerDrag(e, layerId, type);
  }
  const handleLayerTouchStart = (e: React.TouchEvent, layerId: string, type: 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'rot') => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    startLayerDrag(e, layerId, type);
  }

  const handleMouseMove = (e: MouseEvent) => {
      if (!dragInfo) return;

      const clientX = e.clientX;
      const clientY = e.clientY;

      const dx = clientX - dragInfo.startX;
      const dy = clientY - dragInfo.startY;

      let newTransform = { ...dragInfo.startTransform };

      if (dragInfo.type === 'move') {
          const { zoom, rotation } = photoBashViewport;
          const unscaled_dx = dx / zoom;
          const unscaled_dy = dy / zoom;
          const angle_rad = (-rotation * Math.PI) / 180;

          const rotated_dx = unscaled_dx * Math.cos(angle_rad) - unscaled_dy * Math.sin(angle_rad);
          const rotated_dy = unscaled_dx * Math.sin(angle_rad) + unscaled_dy * Math.cos(angle_rad);

          newTransform.x = dragInfo.startTransform.x + rotated_dx;
          newTransform.y = dragInfo.startTransform.y + rotated_dy;

      } else if (dragInfo.type === 'rot') {
          const centerScreenX = dragInfo.layerRect.left + dragInfo.layerRect.width / 2;
          const centerScreenY = dragInfo.layerRect.top + dragInfo.layerRect.height / 2;
          const startAngle = Math.atan2(dragInfo.startY - centerScreenY, dragInfo.startX - centerScreenX);
          const currentAngle = Math.atan2(clientY - centerScreenY, clientX - centerScreenX);
          const angleDelta = (currentAngle - startAngle) * 180 / Math.PI;
          newTransform.rotation = dragInfo.startTransform.rotation + angleDelta;
      } else { // Resizing corners
          const centerScreenX = dragInfo.layerRect.left + dragInfo.layerRect.width / 2;
          const centerScreenY = dragInfo.layerRect.top + dragInfo.layerRect.height / 2;
          const startDist = Math.hypot(dragInfo.startX - centerScreenX, dragInfo.startY - centerScreenY);
          const currentDist = Math.hypot(clientX - centerScreenX, clientY - centerScreenY);
          if (startDist > 0) {
            const scaleFactor = currentDist / startDist;
            newTransform.scale = dragInfo.startTransform.scale * scaleFactor;
          }
      }

      setPhotoBashLayers(layers => layers.map(l => l.id === dragInfo.layerId ? { ...l, transform: newTransform } : l));
  };

  const handleMouseUp = () => {
      setDragInfo(null);
  };
  
  const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!dragInfo || e.touches.length !== 1) return;
      handleMouseMove({
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY,
      } as MouseEvent);
  }

  const handleGlobalTouchEnd = () => {
      setDragInfo(null);
  }

  useEffect(() => {
    const moveHandler = (e: MouseEvent) => handleMouseMove(e);
    const upHandler = () => handleMouseUp();
    const touchMoveHandler = (e: TouchEvent) => handleGlobalTouchMove(e);
    const touchEndHandler = () => handleGlobalTouchEnd();
    if (dragInfo) {
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
        window.addEventListener('touchmove', touchMoveHandler);
        window.addEventListener('touchend', touchEndHandler);
    }
    return () => {
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('mouseup', upHandler);
        window.removeEventListener('touchmove', touchMoveHandler);
        window.removeEventListener('touchend', touchEndHandler);
    };
  }, [dragInfo]);

  const getCanvasCoords = (clientX: number, clientY: number): { x: number, y: number } | null => {
      if (!viewportRef.current || !photoBashCanvasSize) return null;
      const viewportRect = viewportRef.current.getBoundingClientRect();
      const canvasWrapper = canvasContainerRef.current;
      if (!canvasWrapper) return null;

      const wrapperRect = canvasWrapper.getBoundingClientRect();
      
      const x = clientX - wrapperRect.left;
      const y = clientY - wrapperRect.top;

      return { x, y };
  };

  const handleMouseDownOnViewport = (e: React.MouseEvent) => {
    const selectedLayer = photoBashLayers.find(l => l.id === selectedLayerId);
    if (e.button !== 0 || !selectedLayer || selectedLayer.type !== 'drawing' || dragInfo) {
      return;
    }
    e.stopPropagation();

    const layerDiv = document.getElementById(selectedLayer.id);
    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords || !layerDiv) return;

    // Convert coords to be relative to the layer's un-transformed state
    const layerRect = layerDiv.getBoundingClientRect();
    const canvasWrapperRect = canvasContainerRef.current!.getBoundingClientRect();
    const localX = (e.clientX - layerRect.left) / (layerRect.width / photoBashCanvasSize!.width);
    const localY = (e.clientY - layerRect.top) / (layerRect.height / photoBashCanvasSize!.height);

    setIsDrawing(true);
    lastPointRef.current = { x: localX, y: localY };

    const canvas = document.getElementById(`drawing-canvas-${selectedLayer.id}`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    // Draw a single dot
    ctx.globalCompositeOperation = drawingSettings.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.globalAlpha = drawingSettings.opacity / 100;
    ctx.fillStyle = drawingSettings.tool === 'brush' ? drawingSettings.color : '#000000';
    ctx.beginPath();
    ctx.arc(localX, localY, drawingSettings.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  };
  
  const handleMouseMoveOnViewport = (e: React.MouseEvent) => {
    const selectedLayer = photoBashLayers.find(l => l.id === selectedLayerId);
    if (brushCursorRef.current && photoBashCanvasSize && viewportRef.current) {
        const viewportRect = viewportRef.current.getBoundingClientRect();
        brushCursorRef.current.style.left = `${e.clientX - viewportRect.left}px`;
        brushCursorRef.current.style.top = `${e.clientY - viewportRect.top}px`;
        const scaledSize = drawingSettings.size * photoBashViewport.zoom;
        brushCursorRef.current.style.width = `${scaledSize}px`;
        brushCursorRef.current.style.height = `${scaledSize}px`;
    }

    if (!isDrawing || !lastPointRef.current) return;
    
    if (!selectedLayer) return;

    const layerDiv = document.getElementById(selectedLayer.id);
    const coords = getCanvasCoords(e.clientX, e.clientY);
     if (!coords || !layerDiv) return;
    
    const layerRect = layerDiv.getBoundingClientRect();
    const localX = (e.clientX - layerRect.left) / (layerRect.width / photoBashCanvasSize!.width);
    const localY = (e.clientY - layerRect.top) / (layerRect.height / photoBashCanvasSize!.height);


    const canvas = document.getElementById(`drawing-canvas-${selectedLayer.id}`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    // Draw line
    ctx.globalCompositeOperation = drawingSettings.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.globalAlpha = drawingSettings.opacity / 100;
    ctx.strokeStyle = drawingSettings.tool === 'brush' ? drawingSettings.color : '#000000';
    ctx.lineWidth = drawingSettings.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(localX, localY);
    ctx.stroke();

    lastPointRef.current = {x: localX, y: localY};
  };
  
  const handleMouseUpOnViewport = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;
    
    const selectedLayer = photoBashLayers.find(l => l.id === selectedLayerId);
    if (!selectedLayer || selectedLayer.type !== 'drawing') return;

    const canvas = document.getElementById(`drawing-canvas-${selectedLayer.id}`) as HTMLCanvasElement;
    if (canvas) {
      // Only update if there's actual content on the canvas to avoid creating empty data URLs
      if (canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data.some(channel => channel !== 0)) {
        const dataUrl = canvas.toDataURL();
        setPhotoBashLayers(layers => layers.map(l =>
            l.id === selectedLayerId && l.type === 'drawing' ? { ...l, drawingDataUrl: dataUrl } : l
        ));
      }
    }
  };

  const selectedLayer = photoBashLayers.find(l => l.id === selectedLayerId);
  const showBrushCursor = appMode === AppMode.PhotoBash && selectedLayer?.type === 'drawing' && !dragInfo;


  const renderContent = () => {
    if (appMode === AppMode.PhotoBash) {
      if (!photoBashCanvasSize) {
          return <div className="flex items-center justify-center h-full text-gray-500">{t('createCanvas')}</div>;
      }
      return (
        <>
            <div className="absolute top-2 left-2 z-20 bg-gray-900 bg-opacity-70 text-white rounded-lg p-1 flex items-center text-xs">
                <button onClick={fitToScreen} className="p-2 hover:bg-gray-700 rounded transition-colors" title="Fit to screen">
                    <i className="fa-solid fa-expand"></i>
                </button>
                <span className="font-mono p-2 select-none">{Math.round(photoBashViewport.zoom * 100)}%</span>
            </div>
             {showBrushCursor && (
                <div 
                    ref={brushCursorRef} 
                    className="brush-cursor" 
                    style={{ 
                        borderColor: drawingSettings.tool === 'eraser' ? 'red' : 'white',
                    }} 
                />
            )}
            <div 
                ref={viewportRef}
                className="photobash-viewport"
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDownOnViewport}
                onMouseMove={handleMouseMoveOnViewport}
                onMouseUp={handleMouseUpOnViewport}
                onMouseLeave={handleMouseUpOnViewport}
            >
                <div 
                    ref={canvasContainerRef}
                    className="photobash-canvas-wrapper"
                    style={{
                        transform: `translate(${photoBashViewport.pan.x}px, ${photoBashViewport.pan.y}px) rotate(${photoBashViewport.rotation}deg) scale(${photoBashViewport.zoom})`,
                        width: `${photoBashCanvasSize.width}px`, 
                        height: `${photoBashCanvasSize.height}px`,
                    }}
                >
                    <div 
                        className="photobash-canvas"
                        style={{ width: '100%', height: '100%' }}
                        onClick={() => setSelectedLayerId(null)}
                    >
                        {[...photoBashLayers].sort((a,b) => a.zIndex - b.zIndex).map(layer => {
                            if (!layer.visible) return null;
                            const filterString = `brightness(${layer.filters.brightness}%) contrast(${layer.filters.contrast}%) saturate(${layer.filters.saturate}%) hue-rotate(${layer.filters.hue}deg)`;
                            
                            return (
                                <div
                                    id={layer.id}
                                    key={layer.id}
                                    className={`photobash-layer ${selectedLayerId === layer.id ? 'selected-layer' : ''} ${isDrawing && selectedLayerId === layer.id ? 'is-drawing' : ''}`}
                                    style={{
                                        top: `${layer.transform.y}px`,
                                        left: `${layer.transform.x}px`,
                                        transform: `scale(${layer.transform.scale}) rotate(${layer.transform.rotation}deg)`,
                                        zIndex: layer.zIndex,
                                        filter: filterString,
                                        mixBlendMode: layer.blendingMode as any,
                                    }}
                                    onMouseDown={(e) => handleLayerMouseDown(e, layer.id, 'move')}
                                    onTouchStart={(e) => handleLayerTouchStart(e, layer.id, 'move')}
                                    onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id) }}
                                >
                                    {layer.type === 'image' && <img src={`data:${layer.uploadedImage.mimeType};base64,${layer.uploadedImage.base64}`} draggable="false" className="pointer-events-none w-full h-full" alt={layer.name}/>}
                                    {layer.type === 'drawing' && (
                                        <canvas
                                            id={`drawing-canvas-${layer.id}`}
                                            ref={canvasEl => {
                                                if(canvasEl) {
                                                    const ctx = canvasEl.getContext('2d');
                                                    if(ctx) {
                                                        const drawingLayer = layer as DrawingLayer;
                                                        if (drawingLayer.drawingDataUrl) {
                                                            const img = new Image();
                                                            img.onload = () => {
                                                              ctx.clearRect(0,0, canvasEl.width, canvasEl.height);
                                                              ctx.drawImage(img, 0, 0);
                                                            }
                                                            img.src = drawingLayer.drawingDataUrl;
                                                        } else {
                                                            ctx.clearRect(0,0, canvasEl.width, canvasEl.height);
                                                        }
                                                    }
                                                }
                                            }}
                                            width={photoBashCanvasSize.width}
                                            height={photoBashCanvasSize.height}
                                            className="w-full h-full"
                                        />
                                    )}
                                    <div className="transform-box">
                                        <div className="transform-handle handle-tl" onMouseDown={(e) => handleLayerMouseDown(e, layer.id, 'tl')} onTouchStart={(e) => handleLayerTouchStart(e, layer.id, 'tl')}></div>
                                        <div className="transform-handle handle-tr" onMouseDown={(e) => handleLayerMouseDown(e, layer.id, 'tr')} onTouchStart={(e) => handleLayerTouchStart(e, layer.id, 'tr')}></div>
                                        <div className="transform-handle handle-bl" onMouseDown={(e) => handleLayerMouseDown(e, layer.id, 'bl')} onTouchStart={(e) => handleLayerTouchStart(e, layer.id, 'bl')}></div>
                                        <div className="transform-handle handle-br" onMouseDown={(e) => handleLayerMouseDown(e, layer.id, 'br')} onTouchStart={(e) => handleLayerTouchStart(e, layer.id, 'br')}></div>
                                        <div className="transform-handle handle-rot" onMouseDown={(e) => handleLayerMouseDown(e, layer.id, 'rot')} onTouchStart={(e) => handleLayerTouchStart(e, layer.id, 'rot')}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
      );
    }
    
    if (isLoading && !isVideoLoading) {
      return (
        <div id="loadingContainer" className="loading-container flex flex-col items-center justify-center h-full text-center">
          <div className="loading-spinner w-16 h-16 border-4 border-t-transparent border-purple-500 rounded-full animate-spin"></div>
          <div className="loading-text mt-4 text-xl text-gray-300">{t('loadingText')}</div>
        </div>
      );
    }
    
    if (isVideoLoading) {
        return (
            <div id="videoLoadingContainer" className="loading-container flex flex-col items-center justify-center h-full text-center">
              <div className="loading-spinner w-16 h-16 border-4 border-t-transparent border-purple-500 rounded-full animate-spin"></div>
              <div className="loading-text mt-4 text-xl text-gray-300">{t(videoLoadingMessageKeys[loadingMessageIndex])}</div>
            </div>
        );
    }

    if (error) {
       return (
        <div className="result-placeholder flex flex-col items-center justify-center h-full text-center text-red-400">
          <i className="fa-solid fa-face-sad-tear text-5xl mb-4"></i>
          <div className="font-semibold">{t('errorTitle')}</div>
          <p className="text-sm mt-2">{error}</p>
          {promptSuggestion && (
            <div className="mt-4 w-full max-w-md bg-gray-700 p-3 rounded-lg text-left">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">{t('suggestedPromptTitle')}</h4>
              <div className="relative">
                <textarea
                  readOnly
                  value={promptSuggestion}
                  className="w-full bg-gray-800 text-green-300 p-2 rounded-md text-sm resize-none"
                  rows={4}
                  aria-label={t('suggestedPromptTitle')}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(promptSuggestion)}
                  className="absolute top-2 right-2 p-2 bg-purple-600 hover:bg-purple-700 rounded-md text-white transition-colors"
                  title={t('copy')}
                  aria-label={t('copy')}
                >
                  <i className="fas fa-copy"></i>
                </button>
              </div>
            </div>
          )}
        </div>
       );
    }

    if (videoError) {
        return (
         <div className="result-placeholder flex flex-col items-center justify-center h-full text-center text-red-400">
           <i className="fa-solid fa-video-slash text-5xl mb-4"></i>
           <div className="font-semibold">{t('videoFailed')}</div>
           <p className="text-sm mt-2">{videoError}</p>
         </div>
        );
     }

    if (videoResultUrls && videoResultUrls.length > 0) {
        return (
            <>
                <div className="image-container relative w-full h-full group flex items-center justify-center">
                   <video 
                     src={videoResultUrls[currentVideoIndex]}
                     key={videoResultUrls[currentVideoIndex]}
                     controls 
                     autoPlay 
                     loop={videoResultUrls.length === 1}
                     muted
                     onEnded={handleVideoEnded}
                     className="max-w-full max-h-full object-contain rounded-lg"
                   />
                </div>
                <div className="lg:hidden mt-4 flex justify-center flex-wrap gap-2 w-full">
                    {videoResultUrls.map((url, index) => (
                      <a key={index} href={url} download={`ai-video-part-${index + 1}.mp4`} className="modal-btn download bg-green-500 text-white py-2 px-4 rounded-lg">
                        <i className="fa-solid fa-download mr-2"></i> {t('downloadVideoPart').replace('{part}', (index + 1).toString())}
                      </a>
                    ))}
                    <button className="modal-btn new bg-purple-500 text-white py-2 px-4 rounded-lg" onClick={resetForNewImage}><i className="fa-solid fa-sparkles mr-2"></i>{t('newMobile')}</button>
                </div>
            </>
        )
    }
    
    if (displayImage) {
      return (
        <>
            <div id="imageContainer" className="image-container relative w-full h-full group flex items-center justify-center">
                {isDepthMapResult ? (
                   <canvas ref={canvasRef} className="max-w-full max-h-full object-contain rounded-lg" />
                ) : (
                   <img 
                    id="generatedImage" 
                    src={displayImage} 
                    alt="Generated Art" 
                    className="generated-image max-w-full max-h-full object-contain rounded-lg"
                 />
                )}
                <div className="image-actions absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {isEditing && (
                      <>
                        <button onClick={onUndo} disabled={!canUndo} title={t('undo')} className="neo-button"><i className="fa-solid fa-rotate-left"></i></button>
                        <button onClick={onRedo} disabled={!canRedo} title={t('redo')} className="neo-button"><i className="fa-solid fa-rotate-right"></i></button>
                      </>
                    )}
                    <button onClick={editCurrentImage} title={t('edit')} className="neo-button"><i className="fa-solid fa-pencil"></i></button>
                    <button onClick={cropCurrentImage} title={t('crop')} className="neo-button"><i className="fa-solid fa-crop-simple"></i></button>
                    <button onClick={downloadImage} title={t('download')} className="neo-button"><i className="fa-solid fa-download"></i></button>
                </div>
            </div>

             {displayImage && imageInfo && (
                <div className="w-full max-w-lg text-center bg-gray-700 p-2 rounded-lg mt-4">
                    <p className="text-sm text-gray-300 font-mono">
                        {imageInfo}
                    </p>
                </div>
            )}

            {isDepthMapResult && (
                <div className="w-full max-w-lg bg-gray-700 rounded-lg p-4 mt-4 text-white">
                    <h3 className="text-md font-bold mb-3 text-center">{t('depthMapSettings')}</h3>
                    <div className="space-y-3">
                        <div className="grid grid-cols-3 items-center gap-2">
                            <label htmlFor="brightness" className="font-medium text-sm">{t('brightness')}</label>
                            <input name="brightness" type="range" min="0" max="200" value={depthMapControls.brightness} onChange={handleControlChange} className="col-span-2 accent-purple-500" />
                        </div>
                        <div className="grid grid-cols-3 items-center gap-2">
                            <label htmlFor="contrast" className="font-medium text-sm">{t('contrast')}</label>
                            <input name="contrast" type="range" min="0" max="200" value={depthMapControls.contrast} onChange={handleControlChange} className="col-span-2 accent-purple-500" />
                        </div>
                         <div className="grid grid-cols-3 items-center gap-2">
                            <label htmlFor="nearClip" className="font-medium text-sm">{t('nearClip')}</label>
                            <input name="nearClip" type="range" min="0" max="100" value={depthMapControls.nearClip} onChange={handleControlChange} className="col-span-2 accent-purple-500" />
                        </div>
                        <div className="grid grid-cols-3 items-center gap-2">
                            <label htmlFor="farClip" className="font-medium text-sm">{t('farClip')}</label>
                            <input name="farClip" type="range" min="0" max="100" value={depthMapControls.farClip} onChange={handleControlChange} className="col-span-2 accent-purple-500" />
                        </div>
                        <div className="flex items-center justify-between pt-2">
                           <label htmlFor="invert" className="font-medium text-sm">{t('invert')}</label>
                           <input type="checkbox" name="invert" checked={depthMapControls.invert} onChange={handleControlChange} className="w-5 h-5 accent-purple-500" />
                        </div>
                    </div>
                </div>
            )}
            
            {/* Mobile Actions */}
             <div className="lg:hidden mt-4 flex justify-center flex-wrap gap-2 w-full">
                {isEditing && (
                  <>
                    <button className="modal-btn undo bg-gray-600 text-white py-2 px-4 rounded-lg disabled:opacity-50" onClick={onUndo} disabled={!canUndo}><i className="fa-solid fa-rotate-left mr-2"></i>{t('undoMobile')}</button>
                    <button className="modal-btn redo bg-gray-600 text-white py-2 px-4 rounded-lg disabled:opacity-50" onClick={onRedo} disabled={!canRedo}><i className="fa-solid fa-rotate-right mr-2"></i>{t('redoMobile')}</button>
                  </>
                )}
                <button className="modal-btn edit bg-blue-500 text-white py-2 px-4 rounded-lg" onClick={editCurrentImage}><i className="fa-solid fa-pencil mr-2"></i>{t('editMobile')}</button>
                <button className="modal-btn crop bg-yellow-500 text-white py-2 px-4 rounded-lg" onClick={cropCurrentImage}><i className="fa-solid fa-crop-simple mr-2"></i>{t('cropMobile')}</button>
                <button className="modal-btn download bg-green-500 text-white py-2 px-4 rounded-lg" onClick={downloadImage}><i className="fa-solid fa-download mr-2"></i>{t('saveMobile')}</button>
                <button className="modal-btn new bg-purple-500 text-white py-2 px-4 rounded-lg" onClick={resetForNewImage}><i className="fa-solid fa-sparkles mr-2"></i>{t('newMobile')}</button>
            </div>
            
            {appMode === AppMode.Create && createHistory && createHistory.length > 0 && (
                <div className="w-full mt-4">
                    <div className="flex justify-between items-center mb-2 px-2">
                      <h3 className="text-md font-bold text-gray-300">{t('generationHistory')}</h3>
                      <button 
                        onClick={() => setIsHistoryVisible(!isHistoryVisible)}
                        className="text-gray-400 hover:text-white transition-colors text-lg"
                        title={isHistoryVisible ? t('hideHistory') : t('showHistory')}
                        aria-expanded={isHistoryVisible}
                      >
                        <i className={`fas ${isHistoryVisible ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                      </button>
                    </div>
                    {isHistoryVisible && (
                        <div className="flex overflow-x-auto gap-2 p-2 bg-gray-900 rounded-lg">
                            {createHistory.map((histImage, index) => (
                                <div key={index} className="flex-shrink-0">
                                    <img 
                                        src={histImage}
                                        alt={`History item ${index + 1}`}
                                        className={`w-24 h-24 object-cover rounded-md cursor-pointer border-2 transition-all ${histImage === displayImage ? 'border-purple-500 scale-105' : 'border-transparent hover:border-gray-500'}`}
                                        onClick={() => setGeneratedImage && setGeneratedImage(histImage)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </>
      );
    }

    return (
      <div id="resultPlaceholder" className="result-placeholder flex flex-col items-center justify-center h-full text-center text-gray-500">
        <i className="fa-solid fa-image text-7xl mb-4"></i>
        <div className="text-2xl font-semibold">{t('placeholderTitle')}</div>
      </div>
    );
  };

  return (
    <div id="resultPanel" className="right-panel bg-gray-800 rounded-lg p-6 w-full lg:w-2/3 flex flex-col items-center justify-center shadow-lg min-h-[50vh] lg:min-h-0">
      {renderContent()}
    </div>
  );
};

export default RightPanel;