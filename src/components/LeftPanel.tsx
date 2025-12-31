import React, { useState, useMemo } from 'react';
import { AppMode, CreateFunction, EditFunction, ArchitectureFunction, UploadedImage, Layer, LayerTransform, LayerFilters, ImageLayer, BaseLayer, BlendingMode, DrawingLayer, DrawingTool } from '../types';
import FunctionCard from './FunctionCard';
import UploadArea from './UploadArea';
import MaskingCanvas from './MaskingCanvas';
import AspectRatioSelector from './AspectRatioSelector';
import UpscaleSelector from './UpscaleSelector';
import StyleSelector from './StyleSelector';
import RemodelControls from './RemodelControls';
import AnimateImageInput from './AnimateImageInput';
import PromptAnalyzer from './PromptAnalyzer';
import DpiSelector from './DpiSelector';
import { useTranslations } from '../context/LanguageContext';
import { fileToBase64 } from '../utils';

interface LeftPanelProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  createFunction: CreateFunction;
  setCreateFunction: (func: CreateFunction) => void;
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  editFunction: EditFunction;
  setEditFunction: (func: EditFunction) => void;
  architectureFunction: ArchitectureFunction;
  setArchitectureFunction: (func: ArchitectureFunction) => void;
  remodelStyle: string;
  setRemodelStyle: (style: string) => void;
  keepLayout: boolean;
  setKeepLayout: (value: boolean) => void;
  upscaleFactor: number;
  setUpscaleFactor: (factor: number) => void;
  dpi: number;
  setDpi: (dpi: number) => void;
  transparentBackground: boolean;
  setTransparentBackground: (value: boolean) => void;
  currentEditImage: UploadedImage | null;
  onSelectNewImage: (image: UploadedImage | null) => void;
  originalImageHash: string | null;
  maskImage: UploadedImage | null;
  setMaskImage: (image: UploadedImage | null) => void;
  invertMask: boolean;
  setInvertMask: (value: boolean) => void;
  composeImages: UploadedImage[];
  setComposeImages: (images: UploadedImage[] | ((current: UploadedImage[]) => UploadedImage[])) => void;
  onGenerate: () => void;
  isLoading: boolean;
  isVideoLoading: boolean;
  onOpenCropper: () => void;
  animateImage1: UploadedImage | null;
  setAnimateImage1: (image: UploadedImage | null) => void;
  animateImageMiddle: UploadedImage | null;
  setAnimateImageMiddle: (image: UploadedImage | null) => void;
  animateImage2: UploadedImage | null;
  setAnimateImage2: (image: UploadedImage | null) => void;
  createReferenceImages: UploadedImage[];
  setCreateReferenceImages: React.Dispatch<React.SetStateAction<UploadedImage[]>>;
  createHistory: string[];
  // Photo Bash Props
  photoBashLayers: Layer[];
  setPhotoBashLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  photoBashCanvasSize: {width: number, height: number} | null;
  setPhotoBashCanvasSize: (size: {width: number, height: number} | null) => void;
  colorCalibrateReference: UploadedImage | null;
  setColorCalibrateReference: (image: UploadedImage | null) => void;
  drawingLayerPrompt: string;
  setDrawingLayerPrompt: (prompt: string) => void;
  onHarmonizeLayer: (layerId: string) => void;
  onApplyColorGrade: () => void;
  drawingSettings: { tool: DrawingTool; color: string; size: number; opacity: number; };
  setDrawingSettings: React.Dispatch<React.SetStateAction<{ tool: DrawingTool; color: string; size: number; opacity: number; }>>;
}

const defaultLayerTransform: LayerTransform = { x: 0, y: 0, scale: 1, rotation: 0 };
const defaultLayerFilters: LayerFilters = { brightness: 100, contrast: 100, hue: 0, saturate: 100 };

const logoDataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAEOAQ4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1VZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A/v4ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigA"

const LeftPanel: React.FC<LeftPanelProps> = ({
  prompt, setPrompt, appMode, setAppMode, createFunction, setCreateFunction,
  aspectRatio, setAspectRatio, editFunction, setEditFunction, architectureFunction, setArchitectureFunction, 
  remodelStyle, setRemodelStyle, keepLayout, setKeepLayout,
  upscaleFactor, setUpscaleFactor, dpi, setDpi, transparentBackground, setTransparentBackground,
  currentEditImage, onSelectNewImage, originalImageHash, maskImage, setMaskImage, invertMask, setInvertMask, composeImages, setComposeImages,
  onGenerate, isLoading, isVideoLoading, onOpenCropper,
  animateImage1, setAnimateImage1, animateImageMiddle, setAnimateImageMiddle, animateImage2, setAnimateImage2,
  createReferenceImages, setCreateReferenceImages, createHistory,
  // Photo Bash Props
  photoBashLayers, setPhotoBashLayers, selectedLayerId, setSelectedLayerId, photoBashCanvasSize, setPhotoBashCanvasSize,
  colorCalibrateReference, setColorCalibrateReference, drawingLayerPrompt, setDrawingLayerPrompt,
  onHarmonizeLayer, onApplyColorGrade, drawingSettings, setDrawingSettings
}) => {
  const [isMasking, setIsMasking] = useState(false);
  const { language, setLanguage, t } = useTranslations();
  const [widthInput, setWidthInput] = useState('1024');
  const [heightInput, setHeightInput] = useState('1024');
  
  const selectedLayer = photoBashLayers.find(l => l.id === selectedLayerId);

  const createFunctions = [
    { key: CreateFunction.Free, iconClassName: 'fa-solid fa-wand-magic-sparkles', name: t('freePrompt'), description: t('freePromptDesc') },
    { key: CreateFunction.Sticker, iconClassName: 'fa-solid fa-tags', name: t('stickers'), description: t('stickersDesc') },
    { key: CreateFunction.Text, iconClassName: 'fa-solid fa-pen-nib', name: t('logo'), description: t('logoDesc') },
    { key: CreateFunction.Comic, iconClassName: 'fa-solid fa-comment-dots', name: t('comic'), description: t('comicDesc') },
  ];

  const editFunctions = [
    { key: EditFunction.AddRemove, iconClassName: 'fa-solid fa-plus-minus', name: t('addRemove'), description: t('addRemoveDesc') },
    { key: EditFunction.FazoL, iconClassName: 'fa-solid fa-hand', name: t('fazoL'), description: t('fazoLDesc') },
    { key: EditFunction.Retouch, iconClassName: 'fa-solid fa-wand-magic', name: t('retouch'), description: t('retouchDesc') },
    { key: EditFunction.Style, iconClassName: 'fa-solid fa-palette', name: t('style'), description: t('styleDesc') },
    { key: EditFunction.Upscale, iconClassName: 'fa-solid fa-magnifying-glass-plus', name: t('upscale'), description: t('upscaleDesc') },
    { key: EditFunction.RemoveBackground, iconClassName: 'fa-solid fa-eraser', name: t('removeBackground'), description: t('removeBackgroundDesc') },
    { key: EditFunction.Crop, iconClassName: 'fa-solid fa-crop-simple', name: t('crop'), description: t('cropDesc') },
    { key: EditFunction.DepthMap, iconClassName: 'fa-solid fa-layer-group', name: t('depthMap'), description: t('depthMapDesc') },
    { key: EditFunction.Compose, iconClassName: 'fa-solid fa-images', name: t('compose'), description: t('composeDesc') },
  ];
  
  const architectureFunctions = [
    { key: ArchitectureFunction.DrawingToBlueprint, iconClassName: 'fa-solid fa-ruler-combined', name: t('drawingToBlueprint'), description: t('drawingToBlueprintDesc') },
    { key: ArchitectureFunction.BlueprintToOrtho, iconClassName: 'fa-solid fa-cube', name: t('blueprintToOrtho'), description: t('blueprintToOrthoDesc') },
    { key: ArchitectureFunction.Remodel, iconClassName: 'fa-solid fa-couch', name: t('remodel'), description: t('remodelDesc') },
    { key: ArchitectureFunction.InteriorDesign, iconClassName: 'fa-solid fa-house-chimney-window', name: t('interiorDesign'), description: t('interiorDesignDesc') },
    { key: ArchitectureFunction.ExteriorDesign, iconClassName: 'fa-solid fa-building', name: t('exteriorDesign'), description: t('exteriorDesignDesc') },
  ];

  const isDpiRelevant = useMemo(() => {
    if (appMode === AppMode.Create) return true;
    if (appMode === AppMode.Edit) {
      const relevantFunctions = [
        EditFunction.AddRemove,
        EditFunction.FazoL,
        EditFunction.Retouch,
        EditFunction.Style,
        EditFunction.Compose,
      ];
      return relevantFunctions.includes(editFunction);
    }
    return false;
  }, [appMode, editFunction]);

  const addComposeImage = (image: UploadedImage | null) => {
    if (image) {
      setComposeImages(current => [...current, image]);
    }
  };

  const removeComposeImage = (index: number) => {
    setComposeImages(current => current.filter((_, i) => i !== index));
  };

  const addCreateReferenceImage = (image: UploadedImage | null) => {
    if (image && createReferenceImages.length < 5) {
      setCreateReferenceImages(current => [...current, image]);
    }
  };

  const removeCreateReferenceImage = (index: number) => {
    setCreateReferenceImages(current => current.filter((_, i) => i !== index));
  };
  
  const handleSaveMask = (mask: UploadedImage) => {
    setMaskImage(mask);
    setIsMasking(false);
    if (originalImageHash) {
      try {
        localStorage.setItem(`mask_${originalImageHash}`, JSON.stringify(mask));
      } catch (error) {
        console.error("Failed to save mask to local storage:", error);
      }
    }
  };

  const removeMask = () => {
    setMaskImage(null);
    if (originalImageHash) {
        try {
            localStorage.removeItem(`mask_${originalImageHash}`);
        } catch (error) {
            console.error("Failed to remove mask from local storage:", error);
        }
    }
  };

  // Photo Bash Handlers
  const handleCreateCanvas = () => {
    const width = parseInt(widthInput, 10);
    const height = parseInt(heightInput, 10);
    if (width > 0 && height > 0) {
        setPhotoBashCanvasSize({ width, height });
    }
  };

  const addImageLayer = (image: UploadedImage | null) => {
    if (!image || !photoBashCanvasSize) return;
    const newLayer: ImageLayer = {
        id: `layer-${Date.now()}`,
        name: `Image ${photoBashLayers.length + 1}`,
        type: 'image',
        uploadedImage: image,
        visible: true,
        transform: { ...defaultLayerTransform, x: 20, y: 20 },
        filters: defaultLayerFilters,
        zIndex: photoBashLayers.length + 1,
        blendingMode: 'normal',
    };
    setPhotoBashLayers(prev => [...prev, newLayer]);
    setSelectedLayerId(newLayer.id);
  };
  
  const addDrawingLayer = () => {
    if (!photoBashCanvasSize) return;
    const newLayer: DrawingLayer = {
        id: `layer-${Date.now()}`,
        name: `Drawing ${photoBashLayers.filter(l => l.type === 'drawing').length + 1}`,
        type: 'drawing',
        drawingDataUrl: null,
        visible: true,
        transform: { ...defaultLayerTransform, x: 0, y: 0 },
        filters: defaultLayerFilters,
        zIndex: photoBashLayers.length + 1,
        blendingMode: 'normal',
    };
    setPhotoBashLayers(prev => [...prev, newLayer]);
    setSelectedLayerId(newLayer.id);
  };
    
  const updateLayer = (id: string, updates: Partial<Omit<BaseLayer, 'id' | 'type'>>) => {
    setPhotoBashLayers(layers => layers.map(l => l.id === id ? { ...l, ...updates } : l));
  };
  const updateLayerTransform = (id: string, updates: Partial<Layer['transform']>) => {
    const layer = photoBashLayers.find(l => l.id === id);
    if (layer) updateLayer(id, { transform: { ...layer.transform, ...updates } });
  };
  const updateLayerFilters = (id: string, updates: Partial<Layer['filters']>) => {
    const layer = photoBashLayers.find(l => l.id === id);
    if (layer) updateLayer(id, { filters: { ...layer.filters, ...updates } });
  };
  const toggleLayerVisibility = (id: string) => {
    const layer = photoBashLayers.find(l => l.id === id);
    if (layer) updateLayer(id, { visible: !layer.visible });
  };
  const deleteLayer = (id: string) => {
    setPhotoBashLayers(layers => layers.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const showMaskingFeature = appMode === AppMode.Edit && (editFunction === EditFunction.AddRemove || editFunction === EditFunction.Retouch);
  const showMainPrompt = !(appMode === AppMode.Edit && editFunction === EditFunction.Style) && !(appMode === AppMode.Architecture && architectureFunction === ArchitectureFunction.Remodel) && appMode !== AppMode.PhotoBash;
  
  const isGenerateButtonDisabled = isLoading || isVideoLoading || (appMode === AppMode.Edit && editFunction === EditFunction.Crop);
  const showSpinner = isLoading || isVideoLoading;
  let generateButtonText = t('generateButton');
  if (appMode === AppMode.Animate) generateButtonText = t('createVideo');
  if (appMode === AppMode.PhotoBash) generateButtonText = t('photoBashExport');

  const spinnerText = isVideoLoading ? t('generatingVideo') : (appMode === AppMode.PhotoBash ? t('photoBashExporting') : t('generatingButton'));

  return (
    <>
      {isMasking && currentEditImage && (
        <MaskingCanvas
          image={currentEditImage}
          mask={maskImage}
          onSaveMask={handleSaveMask}
          onCancel={() => setIsMasking(false)}
        />
      )}
      <div className="left-panel bg-gray-800 rounded-lg p-6 w-full lg:w-1/3 flex flex-col gap-4 shadow-lg">
        <div className="text-center">
            <div className="flex items-center justify-between">
              <img src={logoDataUrl} alt="Dolphin 999 Logo" className="h-12" />
              <div className="flex items-center bg-gray-700 rounded-lg p-1">
                  <button onClick={() => setLanguage('pt')} className={`px-2 py-1 text-sm rounded transition-colors ${language === 'pt' ? 'bg-purple-600' : 'hover:bg-gray-600'}`}>PT</button>
                  <button onClick={() => setLanguage('en')} className={`px-2 py-1 text-sm rounded transition-colors ${language === 'en' ? 'bg-purple-600' : 'hover:bg-gray-600'}`}>EN</button>
              </div>
            </div>
          <p className="panel-subtitle text-gray-400 mt-1">{t('studioSubtitle')}</p>
        </div>

        {showMainPrompt && (
          <div className="prompt-section">
            <div className="section-title text-gray-300 font-semibold mb-2 flex items-center gap-2"><i className="fa-solid fa-lightbulb"></i>{t('promptTitle')}</div>
            <PromptAnalyzer
              id="prompt"
              placeholder={t('promptPlaceholder')}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={appMode === AppMode.Animate ? 3 : 4}
              disabled={editFunction === EditFunction.DepthMap || editFunction === EditFunction.Upscale || editFunction === EditFunction.Crop || editFunction === EditFunction.RemoveBackground}
            />
          </div>
        )}


        <div id="mode-toggle" className="mode-toggle grid grid-cols-5 gap-2 bg-gray-700 p-1 rounded-lg">
          <button
            className={`mode-btn p-2 rounded-md transition-colors duration-200 ${appMode === AppMode.Create ? 'bg-purple-600 text-white' : 'hover:bg-gray-600'}`}
            onClick={() => setAppMode(AppMode.Create)}
          >
            {t('createMode')}
          </button>
          <button
            className={`mode-btn p-2 rounded-md transition-colors duration-200 ${appMode === AppMode.Edit ? 'bg-purple-600 text-white' : 'hover:bg-gray-600'}`}
            onClick={() => setAppMode(AppMode.Edit)}
          >
            {t('editMode')}
          </button>
           <button
            className={`mode-btn p-2 rounded-md transition-colors duration-200 ${appMode === AppMode.Animate ? 'bg-purple-600 text-white' : 'hover:bg-gray-600'}`}
            onClick={() => setAppMode(AppMode.Animate)}
          >
            {t('animateMode')}
          </button>
          <button
            className={`mode-btn p-2 rounded-md transition-colors duration-200 ${appMode === AppMode.Architecture ? 'bg-purple-600 text-white' : 'hover:bg-gray-600'}`}
            onClick={() => setAppMode(AppMode.Architecture)}
          >
            {t('architectureMode')}
          </button>
           <button
            className={`mode-btn p-2 rounded-md transition-colors duration-200 ${appMode === AppMode.PhotoBash ? 'bg-purple-600 text-white' : 'hover:bg-gray-600'}`}
            onClick={() => setAppMode(AppMode.PhotoBash)}
          >
            {t('photoBashMode')}
          </button>
        </div>
        
        {appMode === AppMode.Animate && (
            <div className="flex flex-col gap-4">
                <div className="bg-yellow-900/50 border border-yellow-500/50 text-yellow-300 p-3 rounded-lg text-sm">
                    <h4 className="font-bold flex items-center gap-2">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        {t('videoBillingNoticeTitle')}
                    </h4>
                    <p className="mt-1">{t('videoBillingNoticeBody')}</p>
                </div>
                <AnimateImageInput 
                    image={animateImage1}
                    setImage={setAnimateImage1}
                    history={createHistory}
                    title={t('startImage')}
                    id="animate-start"
                />
                <AnimateImageInput 
                    image={animateImageMiddle}
                    setImage={setAnimateImageMiddle}
                    history={createHistory}
                    title={t('middleImage')}
                    id="animate-middle"
                />
                <AnimateImageInput 
                    image={animateImage2}
                    setImage={setAnimateImage2}
                    history={createHistory}
                    title={t('endImage')}
                    id="animate-end"
                />
            </div>
        )}

        {appMode === AppMode.Create && (
          <div className="flex flex-col gap-4">
            <div id="createFunctions" className="functions-section">
              <div className="functions-grid grid grid-cols-2 md:grid-cols-4 gap-3">
                {createFunctions.map(f => (
                  <FunctionCard
                    key={f.key}
                    iconClassName={f.iconClassName}
                    name={f.name}
                    description={f.description}
                    isActive={createFunction === f.key}
                    onClick={() => setCreateFunction(f.key as CreateFunction)}
                  />
                ))}
              </div>
            </div>
             {createFunction === CreateFunction.Text && (
              <div className="functions-section bg-gray-700 p-3 rounded-lg">
                <label htmlFor="transparent-toggle" className="flex items-center justify-between cursor-pointer">
                  <span className="font-semibold text-gray-300">{t('transparentBackground')}</span>
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      id="transparent-toggle" 
                      className="sr-only peer"
                      checked={transparentBackground} 
                      onChange={(e) => setTransparentBackground(e.target.checked)}
                    />
                    <div className="block bg-gray-600 w-14 h-8 rounded-full peer-checked:bg-purple-500 transition"></div>
                    <div className="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-full"></div>
                  </div>
                </label>
                <p className="text-xs text-gray-400 mt-2">{t('transparentBackgroundDesc')}</p>
              </div>
            )}
            <div id="createReferenceSection" className="functions-section flex flex-col gap-3">
              <div className="section-title text-gray-300 font-semibold">
                {t('referenceImagesTitle')} ({createReferenceImages.length} / 5)
              </div>
              <p className="text-xs text-gray-400 -mt-2 mb-1">{t('referenceImageDesc')}</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {createReferenceImages.map((image, index) => (
                  <div key={index} className="relative group aspect-square">
                    <img src={`data:${image.mimeType};base64,${image.base64}`} className="rounded-md w-full h-full object-cover" alt={`Reference ${index + 1}`} />
                    <button 
                      onClick={() => removeCreateReferenceImage(index)} 
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`${t('removeImage')} ${index + 1}`}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              {createReferenceImages.length < 5 && (
                <UploadArea 
                  id="uploadAreaCreateRef"
                  image={null}
                  setImage={addCreateReferenceImage} 
                  title={t('addReferenceImage')}
                />
              )}
            </div>
            <AspectRatioSelector 
                selectedRatio={aspectRatio}
                onRatioChange={setAspectRatio}
            />
            {isDpiRelevant && <DpiSelector selectedDpi={dpi} onDpiChange={setDpi} />}
          </div>
        )}

        {appMode === AppMode.Architecture && (
          <div id="architectureModeContainer" className="flex flex-col gap-4">
            <div id="architectureFunctions" className="functions-section">
              <div className="functions-grid grid grid-cols-2 sm:grid-cols-3 gap-3">
                {architectureFunctions.map(f => (
                  <FunctionCard
                    key={f.key}
                    iconClassName={f.iconClassName}
                    name={f.name}
                    description={f.description}
                    isActive={architectureFunction === f.key}
                    onClick={() => setArchitectureFunction(f.key as ArchitectureFunction)}
                  />
                ))}
              </div>
            </div>
            { architectureFunction === ArchitectureFunction.Remodel && (
              <RemodelControls 
                style={remodelStyle}
                setStyle={setRemodelStyle}
                keepLayout={keepLayout}
                setKeepLayout={setKeepLayout}
                additionalPrompt={prompt}
                setAdditionalPrompt={setPrompt}
              />
            )}
            <UploadArea id="uploadAreaArch" image={currentEditImage} setImage={onSelectNewImage} />
          </div>
        )}

        {appMode === AppMode.Edit && (
          <div id="editModeContainer" className="flex flex-col gap-4">
            <div id="editFunctions" className="functions-section">
              <div className="functions-grid grid grid-cols-2 sm:grid-cols-4 gap-3">
                {editFunctions.map(f => (
                  <FunctionCard
                    key={f.key}
                    iconClassName={f.iconClassName}
                    name={f.name}
                    description={f.description}
                    isActive={editFunction === f.key}
                    onClick={() => setEditFunction(f.key as EditFunction)}
                  />
                ))}
              </div>
            </div>
            
            {editFunction === EditFunction.Compose ? (
              <div id="composeSection" className="functions-section flex flex-col gap-3">
                 {isDpiRelevant && <DpiSelector selectedDpi={dpi} onDpiChange={setDpi} />}
                <div className="section-title text-gray-300 font-semibold">
                  {t('composeTitle')} ({composeImages.length} / 10)
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {composeImages.map((image, index) => (
                    <div key={index} className="relative group aspect-square">
                      <img src={`data:${image.mimeType};base64,${image.base64}`} className="rounded-md w-full h-full object-cover" alt={`Upload ${index + 1}`} />
                      <button 
                        onClick={() => removeComposeImage(index)} 
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`${t('removeImage')} ${index + 1}`}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
                {composeImages.length < 10 && (
                  <UploadArea 
                    id="uploadAreaCompose"
                    image={null}
                    setImage={addComposeImage} 
                    title={t('addComposeImage')}
                  />
                )}
              </div>
            ) : (
              <div className="dynamic-content flex flex-col gap-4">
                <UploadArea id="uploadArea" image={currentEditImage} setImage={onSelectNewImage} />
                {isDpiRelevant && <DpiSelector selectedDpi={dpi} onDpiChange={setDpi} />}
                 {editFunction === EditFunction.Style && (
                  <StyleSelector style={prompt} setStyle={setPrompt} />
                )}
                 {editFunction === EditFunction.Crop && currentEditImage && (
                    <div className="functions-section">
                        <div className="section-title text-gray-300 font-semibold mb-2">{t('cropTitle')}</div>
                        <button
                            onClick={onOpenCropper}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-colors duration-200"
                            aria-label={t('openCropper')}
                        >
                           <i className="fa-solid fa-crop-simple mr-2"></i> {t('openCropper')}
                        </button>
                    </div>
                )}
                {editFunction === EditFunction.Upscale && (
                  <UpscaleSelector 
                    selectedFactor={upscaleFactor}
                    onFactorChange={setUpscaleFactor}
                  />
                )}
                 {showMaskingFeature && currentEditImage && (
                  <div id="maskingSection" className="functions-section">
                    <div className="section-title text-gray-300 font-semibold mb-2 flex items-center gap-2">
                      <i className="fa-solid fa-mask"></i>{t('maskingTitle')}
                    </div>
                    {!maskImage ? (
                      <button 
                        onClick={() => setIsMasking(true)}
                        className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-colors duration-200"
                        aria-label={t('createMask')}
                      >
                        <i className="fa-solid fa-paintbrush mr-2"></i> {t('createMask')}
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 p-2 bg-gray-700 rounded-lg">
                          <img src={`data:${maskImage.mimeType};base64,${maskImage.base64}`} className={`w-16 h-16 object-contain rounded-md bg-black transition-all ${invertMask ? 'invert' : ''}`} alt="Mask Preview" />
                          <div className="flex-grow flex flex-col gap-1">
                            <button onClick={() => setIsMasking(true)} className="text-sm bg-purple-600 hover:bg-purple-700 p-1 rounded">{t('editMask')}</button>
                            <button onClick={removeMask} className="text-sm bg-red-600 hover:bg-red-700 p-1 rounded">{t('removeMask')}</button>
                          </div>
                        </div>
                        <div className="bg-gray-700 p-3 rounded-lg">
                          <label htmlFor="invert-mask-toggle" className="flex items-center justify-between cursor-pointer" title={t('invertMaskDesc')}>
                            <span className="font-semibold text-gray-300">{t('invertMask')}</span>
                            <div className="relative">
                              <input 
                                type="checkbox" 
                                id="invert-mask-toggle" 
                                className="sr-only peer"
                                checked={invertMask} 
                                onChange={(e) => setInvertMask(e.target.checked)}
                              />
                              <div className="block bg-gray-600 w-14 h-8 rounded-full peer-checked:bg-purple-500 transition"></div>
                              <div className="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-full"></div>
                            </div>
                          </label>
                          <p className="text-xs text-gray-400 mt-2">{t('invertMaskDesc')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {appMode === AppMode.PhotoBash && (
           <div className="flex flex-col gap-4 h-full">
            {!photoBashCanvasSize ? (
                 <div className="functions-section">
                    <h3 className="section-title text-gray-300 font-semibold mb-2">{t('canvasSetup')}</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <input type="number" placeholder={t('width')} value={widthInput} onChange={e => setWidthInput(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md p-2 text-white" />
                        <input type="number" placeholder={t('height')} value={heightInput} onChange={e => setHeightInput(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md p-2 text-white" />
                    </div>
                    <button onClick={handleCreateCanvas} className="w-full mt-2 bg-purple-600 hover:bg-purple-700 p-2 rounded-md font-semibold">{t('createCanvas')}</button>
                </div>
            ) : (
                <>
                    <div className="functions-section flex-grow flex flex-col min-h-0">
                        <h3 className="section-title text-gray-300 font-semibold mb-2">{t('layers')}</h3>
                        <div className="mb-2 grid grid-cols-2 gap-2">
                            <button onClick={addDrawingLayer} className="w-full bg-gray-700 hover:bg-gray-600 p-2 rounded-md text-sm flex items-center justify-center gap-2"><i className="fa-solid fa-paintbrush"></i>{t('addDrawingLayer')}</button>
                            <UploadArea id="photobash-add-image" image={null} setImage={addImageLayer} title={t('addImageLayer')} />
                        </div>
                        <div className="flex-grow overflow-y-auto pr-2">
                            {[...photoBashLayers].sort((a,b) => b.zIndex - a.zIndex).map(layer => (
                                <div key={layer.id} onClick={() => setSelectedLayerId(layer.id)} className={`layer-item ${selectedLayerId === layer.id ? 'selected' : ''}`}>
                                    {layer.type === 'image' && <img className="layer-thumbnail" src={`data:${layer.uploadedImage.mimeType};base64,${layer.uploadedImage.base64}`} alt={layer.name}/>}
                                    {layer.type === 'drawing' && <div className="layer-thumbnail flex items-center justify-center"><i className="fa-solid fa-paintbrush text-xl text-gray-400"></i></div>}
                                    <input type="text" value={layer.name} onChange={e => updateLayer(layer.id, { name: e.target.value })} onClick={e => e.stopPropagation()} className="layer-name bg-transparent border-none focus:ring-0 focus:outline-none" />
                                    <div className="layer-actions">
                                        <button onClick={(e) => {e.stopPropagation(); toggleLayerVisibility(layer.id)}}><i className={`fa-solid ${layer.visible ? 'fa-eye' : 'fa-eye-slash'}`}></i></button>
                                        <button onClick={(e) => {e.stopPropagation(); deleteLayer(layer.id)}}><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="functions-section overflow-y-auto max-h-[40%]">
                        <h3 className="section-title text-gray-300 font-semibold mb-2">{t('layerProperties')}</h3>
                        {!selectedLayer ? (
                            <p className="text-gray-400 text-sm">{t('noLayerSelected')}</p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {selectedLayer.type === 'drawing' && (
                                    <details open>
                                        <summary className="font-semibold cursor-pointer">{t('drawingTools')}</summary>
                                        <div className="flex items-center gap-4 mt-2 bg-gray-900 p-2 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setDrawingSettings(s => ({...s, tool: 'brush'}))} className={`drawing-tool-btn p-2 rounded-md ${drawingSettings.tool === 'brush' ? 'active' : ''}`}><i className="fa-solid fa-paintbrush"></i></button>
                                                <button onClick={() => setDrawingSettings(s => ({...s, tool: 'eraser'}))} className={`drawing-tool-btn p-2 rounded-md ${drawingSettings.tool === 'eraser' ? 'active' : ''}`}><i className="fa-solid fa-eraser"></i></button>
                                            </div>
                                            <label htmlFor="color-picker" className="relative">
                                                <div className="color-picker-swatch" style={{ backgroundColor: drawingSettings.color }}></div>
                                                <input id="color-picker" type="color" value={drawingSettings.color} onChange={e => setDrawingSettings(s => ({...s, color: e.target.value}))} className="color-picker-input"/>
                                            </label>
                                        </div>
                                        <div className="mt-2 flex flex-col gap-2 bg-gray-900 p-2 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <label htmlFor="brushSize" className="text-white text-xs font-medium w-12">{t('brushSize')}</label>
                                                <input id="brushSize" type="range" min="1" max="200" value={drawingSettings.size} onChange={(e) => setDrawingSettings(s => ({ ...s, size: Number(e.target.value) }))} className="flex-grow accent-purple-500" />
                                                <span className="text-white font-mono text-xs w-8 text-center bg-gray-800 rounded p-1">{drawingSettings.size}</span>
                                            </div>
                                             <div><label className="text-xs flex justify-between"><span>{t('opacity')}</span><span>{drawingSettings.opacity}%</span></label><input type="range" min="1" max="100" value={drawingSettings.opacity} onChange={e => setDrawingSettings(s => ({...s, opacity: Number(e.target.value)}))} className="w-full accent-purple-500" /></div>
                                        </div>
                                    </details>
                                )}
                                <details open>
                                    <summary className="font-semibold cursor-pointer">{t('transform')}</summary>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <div><label className="text-xs">{t('positionX')}</label><input type="number" value={Math.round(selectedLayer.transform.x)} onChange={e => updateLayerTransform(selectedLayer.id, { x: parseInt(e.target.value, 10) || 0 })} className="w-full bg-gray-700 border border-gray-600 rounded p-1 text-white" /></div>
                                        <div><label className="text-xs">{t('positionY')}</label><input type="number" value={Math.round(selectedLayer.transform.y)} onChange={e => updateLayerTransform(selectedLayer.id, { y: parseInt(e.target.value, 10) || 0 })} className="w-full bg-gray-700 border border-gray-600 rounded p-1 text-white" /></div>
                                        <div><label className="text-xs">{t('scale')} (%)</label><input type="number" value={Math.round(selectedLayer.transform.scale * 100)} onChange={e => updateLayerTransform(selectedLayer.id, { scale: (parseInt(e.target.value, 10) || 100) / 100 })} className="w-full bg-gray-700 border border-gray-600 rounded p-1 text-white" /></div>
                                        <div><label className="text-xs">{t('rotation')} (°)</label><input type="number" value={Math.round(selectedLayer.transform.rotation)} onChange={e => updateLayerTransform(selectedLayer.id, { rotation: parseInt(e.target.value, 10) || 0 })} className="w-full bg-gray-700 border border-gray-600 rounded p-1 text-white" /></div>
                                    </div>
                                </details>
                                <details>
                                    <summary className="font-semibold cursor-pointer">{t('colorAdjustments')}</summary>
                                    <div className="mt-2 flex flex-col gap-1">
                                        <div><label className="text-xs flex justify-between"><span>{t('brightness')}</span><span>{selectedLayer.filters.brightness}%</span></label><input type="range" min="0" max="200" value={selectedLayer.filters.brightness} onChange={e => updateLayerFilters(selectedLayer.id, { brightness: parseInt(e.target.value, 10) })} className="w-full accent-purple-500" /></div>
                                        <div><label className="text-xs flex justify-between"><span>{t('contrast')}</span><span>{selectedLayer.filters.contrast}%</span></label><input type="range" min="0" max="200" value={selectedLayer.filters.contrast} onChange={e => updateLayerFilters(selectedLayer.id, { contrast: parseInt(e.target.value, 10) })} className="w-full accent-purple-500" /></div>
                                        <div><label className="text-xs flex justify-between"><span>{t('saturate')}</span><span>{selectedLayer.filters.saturate}%</span></label><input type="range" min="0" max="200" value={selectedLayer.filters.saturate} onChange={e => updateLayerFilters(selectedLayer.id, { saturate: parseInt(e.target.value, 10) })} className="w-full accent-purple-500" /></div>
                                        <div><label className="text-xs flex justify-between"><span>{t('hue')}</span><span>{selectedLayer.filters.hue}°</span></label><input type="range" min="-180" max="180" value={selectedLayer.filters.hue} onChange={e => updateLayerFilters(selectedLayer.id, { hue: parseInt(e.target.value, 10) })} className="w-full accent-purple-500" /></div>
                                    </div>
                                </details>
                                <details open>
                                    <summary className="font-semibold cursor-pointer">{t('blending')}</summary>
                                    <div className="mt-2 flex flex-col gap-1">
                                        <div>
                                            <label className="text-xs flex justify-between"><span>{t('blendingMode')}</span></label>
                                            <select
                                                value={selectedLayer.blendingMode}
                                                onChange={e => updateLayer(selectedLayer.id, { blendingMode: e.target.value as BlendingMode })}
                                                className="w-full bg-gray-700 border border-gray-600 rounded p-1 text-white"
                                            >
                                                <option value="normal">{t('normal')}</option>
                                                <option value="multiply">{t('multiply')}</option>
                                                <option value="screen">{t('screen')}</option>
                                                <option value="overlay">{t('overlay')}</option>
                                            </select>
                                        </div>
                                    </div>
                                </details>
                                <details open>
                                    <summary className="font-semibold cursor-pointer">{t('aiTools')}</summary>
                                    <div className="mt-2 flex flex-col gap-2">
                                        {selectedLayer.type === 'image' && <button onClick={() => onHarmonizeLayer(selectedLayer.id)} disabled={isLoading || photoBashLayers.length < 2} className="w-full bg-gray-700 hover:bg-gray-600 p-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed">{t('harmonizeLayer')}</button> }
                                        <div className="bg-gray-900 p-2 rounded">
                                            <p className="text-sm font-semibold mb-1">{t('colorCalibration')}</p>
                                            <p className="text-xs text-gray-400 mb-2">{t('colorCalibrationDesc')}</p>
                                            <UploadArea id="photobash-color-ref" image={colorCalibrateReference} setImage={setColorCalibrateReference} />
                                            <button onClick={onApplyColorGrade} disabled={isLoading || !colorCalibrateReference} className="w-full mt-2 bg-gray-700 hover:bg-gray-600 p-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed">{t('applyStyle')}</button>
                                        </div>
                                    </div>
                                </details>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
        )}

        <button
          id="generateBtn"
          className="neo-generate-btn mt-auto w-full flex items-center justify-center"
          onClick={onGenerate}
          disabled={isGenerateButtonDisabled}
        >
          {showSpinner ? (
            <>
              <div className="spinner w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin mr-2"></div>
              <span className="btn-text">{spinnerText}</span>
            </>
          ) : (
             <span className="btn-text flex items-center gap-2"><i className="fa-solid fa-rocket"></i> {generateButtonText}</span>
          )}
        </button>
      </div>
    </>
  );
};

export default LeftPanel;
