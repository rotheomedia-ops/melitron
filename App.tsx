
import React, { useState, useEffect, useCallback } from 'react';
import { AppMode, CreateFunction, EditFunction, ArchitectureFunction, UploadedImage, DepthMapControlsState, EditHistoryStep, Layer, LayerTransform, LayerFilters, ImageLayer, PhotoBashViewport, DrawingTool, DrawingLayer } from './src/types';
import LeftPanel from './src/components/LeftPanel';
import RightPanel from './src/components/RightPanel';
import ImageCropper from './src/components/ImageCropper';
import { generateImage, editImage, processArchitecturalImage, generateVideo, suggestBetterPrompt, harmonizeLayer, applyColorGrade, generateFromDrawing } from './src/services/geminiService';
import { generateImageHash, fileToBase64, invertMaskImage, flattenLayersToImage } from './src/utils';
import { useTranslations } from './src/context/LanguageContext';

const initialDepthControls: DepthMapControlsState = {
  invert: false,
  contrast: 100,
  brightness: 100,
  nearClip: 0,
  farClip: 100,
};

const defaultLayerTransform: LayerTransform = { x: 0, y: 0, scale: 1, rotation: 0 };
const defaultLayerFilters: LayerFilters = { brightness: 100, contrast: 100, hue: 0, saturate: 100 };

const initialPhotoBashViewport: PhotoBashViewport = {
  pan: { x: 0, y: 0 },
  zoom: 1,
  rotation: 0,
};

const defaultDrawingSettings = {
  tool: 'brush' as DrawingTool,
  color: '#ffffff',
  size: 30,
  opacity: 100,
};

function App() {
  const { language, t } = useTranslations();
  const [prompt, setPrompt] = useState('');
  const [appMode, setAppMode] = useState<AppMode>(AppMode.Create);
  const [createFunction, setCreateFunction] = useState<CreateFunction>(CreateFunction.Free);
  const [editFunction, setEditFunction] = useState<EditFunction>(EditFunction.AddRemove);
  const [architectureFunction, setArchitectureFunction] = useState<ArchitectureFunction>(ArchitectureFunction.DrawingToBlueprint);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [upscaleFactor, setUpscaleFactor] = useState<number>(2);
  const [dpi, setDpi] = useState<number>(72);
  const [transparentBackground, setTransparentBackground] = useState(false);
  
  const [remodelStyle, setRemodelStyle] = useState('Modern');
  const [keepLayout, setKeepLayout] = useState(true);

  const [editHistory, setEditHistory] = useState<EditHistoryStep[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [originalImageHash, setOriginalImageHash] = useState<string | null>(null);
  
  const [createHistory, setCreateHistory] = useState<string[]>(() => {
    try {
      const savedHistory = sessionStorage.getItem('melitron_create_history');
      return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (e) {
      console.error("Could not load create history from session storage:", e);
      return [];
    }
  });

  const [isHistoryVisible, setIsHistoryVisible] = useState<boolean>(() => {
    try {
      const savedVisibility = sessionStorage.getItem('melitron_history_visible');
      return savedVisibility !== null ? JSON.parse(savedVisibility) : true;
    } catch (e) {
      console.error("Could not load history visibility from session storage:", e);
      return true;
    }
  });


  const [maskImage, setMaskImage] = useState<UploadedImage | null>(null);
  const [invertMask, setInvertMask] = useState(false);
  const [composeImages, setComposeImages] = useState<UploadedImage[]>([]);
  const [createReferenceImages, setCreateReferenceImages] = useState<UploadedImage[]>([]);
  const [animateImage1, setAnimateImage1] = useState<UploadedImage | null>(null);
  const [animateImageMiddle, setAnimateImageMiddle] = useState<UploadedImage | null>(null);
  const [animateImage2, setAnimateImage2] = useState<UploadedImage | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promptSuggestion, setPromptSuggestion] = useState<string | null>(null);
  
  const [isDepthMapResult, setIsDepthMapResult] = useState(false);
  const [depthMapControls, setDepthMapControls] = useState<DepthMapControlsState>(initialDepthControls);

  const [isCropping, setIsCropping] = useState(false);
  
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoResultUrls, setVideoResultUrls] = useState<string[]>([]);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [imageInfo, setImageInfo] = useState<string | null>(null);
  const [lastUsedDpi, setLastUsedDpi] = useState<number | null>(null);

  const [photoBashLayers, setPhotoBashLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [photoBashCanvasSize, setPhotoBashCanvasSize] = useState<{width: number, height: number} | null>(null);
  const [colorCalibrateReference, setColorCalibrateReference] = useState<UploadedImage | null>(null);
  const [drawingLayerPrompt, setDrawingLayerPrompt] = useState('');
  const [photoBashViewport, setPhotoBashViewport] = useState<PhotoBashViewport>(initialPhotoBashViewport);
  const [drawingSettings, setDrawingSettings] = useState(defaultDrawingSettings);


  const currentEditStep = editHistory[currentHistoryIndex] || null;
  const currentEditImageAsDataUrl = currentEditStep?.resultImage || null;
  const currentEditImageForPanel = currentEditImageAsDataUrl ? {
      base64: currentEditImageAsDataUrl.split(',')[1],
      mimeType: currentEditImageAsDataUrl.substring(currentEditImageAsDataUrl.indexOf(':') + 1, currentEditImageAsDataUrl.indexOf(';')),
  } : null;
  const canUndo = currentHistoryIndex > 0;
  const canRedo = currentHistoryIndex < editHistory.length - 1;

  const dpiForDownload = appMode === AppMode.Create 
    ? lastUsedDpi
    : currentEditStep?.dpi;

  useEffect(() => {
    try {
      sessionStorage.setItem('melitron_create_history', JSON.stringify(createHistory));
    } catch (e) {
      console.error("Could not save create history to session storage:", e);
    }
  }, [createHistory]);

  useEffect(() => {
    try {
      sessionStorage.setItem('melitron_history_visible', JSON.stringify(isHistoryVisible));
    } catch (e) {
      console.error("Could not load history visibility from session storage:", e);
    }
  }, [isHistoryVisible]);

  const handleImageSelect = useCallback((image: UploadedImage | null) => {
    setImageInfo(null);
    if (image) {
      const dataUrl = `data:${image.mimeType};base64,${image.base64}`;
      const imageHash = generateImageHash(image.base64);
      const initialStep: EditHistoryStep = {
        id: `initial-${Date.now()}`,
        prompt: t('originalImage'),
        editFunction: EditFunction.AddRemove,
        resultImage: dataUrl,
        dpi: 72,
      };

      setEditHistory([initialStep]);
      setCurrentHistoryIndex(0);
      setGeneratedImage(null);
      setMaskImage(null);
      setInvertMask(false);
      setOriginalImageHash(imageHash);

      try {
        const savedMaskJSON = localStorage.getItem(`mask_${imageHash}`);
        if (savedMaskJSON) {
          setMaskImage(JSON.parse(savedMaskJSON));
        }
      } catch (e) {
        console.error("Failed to load mask:", e);
      }
    } else {
      setEditHistory([]);
      setCurrentHistoryIndex(-1);
      setOriginalImageHash(null);
    }
  }, [t]);
  
  const handleAppModeChange = useCallback((newMode: AppMode) => {
    if (newMode === appMode) return;
    setAppMode(newMode);
    setPrompt('');
    setGeneratedImage(null);
    setError(null);
  }, [appMode]);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
        let result;
        if (appMode === AppMode.Create) {
          result = await generateImage(prompt, createFunction, aspectRatio, language, transparentBackground, createReferenceImages, dpi);
          setGeneratedImage(result);
          setCreateHistory(prev => [result, ...prev.slice(0, 49)]);
        } else if (appMode === AppMode.Edit) {
          if (!currentEditImageForPanel) return;
          result = await editImage(prompt, editFunction, [currentEditImageForPanel], language, maskImage, dpi);
          const newStep: EditHistoryStep = {
            id: `edit-${Date.now()}`,
            prompt,
            editFunction,
            resultImage: result,
            dpi,
          };
          setEditHistory(prev => [...prev.slice(0, currentHistoryIndex + 1), newStep]);
          setCurrentHistoryIndex(prev => prev + 1);
        }
    } catch (e: any) {
      setError(e.message || t('errorTitle'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 flex flex-col lg:flex-row gap-4 min-h-screen">
      <LeftPanel
        prompt={prompt} setPrompt={setPrompt}
        appMode={appMode} setAppMode={handleAppModeChange}
        createFunction={createFunction} setCreateFunction={setCreateFunction}
        aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
        editFunction={editFunction} setEditFunction={setEditFunction}
        architectureFunction={architectureFunction} setArchitectureFunction={setArchitectureFunction}
        remodelStyle={remodelStyle} setRemodelStyle={setRemodelStyle}
        keepLayout={keepLayout} setKeepLayout={setKeepLayout}
        upscaleFactor={upscaleFactor} setUpscaleFactor={setUpscaleFactor}
        dpi={dpi} setDpi={setDpi}
        transparentBackground={transparentBackground} setTransparentBackground={setTransparentBackground}
        currentEditImage={currentEditImageForPanel}
        onSelectNewImage={handleImageSelect}
        originalImageHash={originalImageHash}
        maskImage={maskImage} setMaskImage={setMaskImage}
        invertMask={invertMask} setInvertMask={setInvertMask}
        composeImages={composeImages} setComposeImages={setComposeImages}
        onGenerate={handleGenerate}
        isLoading={isLoading}
        isVideoLoading={isVideoLoading}
        onOpenCropper={() => setIsCropping(true)}
        animateImage1={animateImage1} setAnimateImage1={setAnimateImage1}
        animateImageMiddle={animateImageMiddle} setAnimateImageMiddle={setAnimateImageMiddle}
        animateImage2={animateImage2} setAnimateImage2={setAnimateImage2}
        createHistory={createHistory}
        createReferenceImages={createReferenceImages} setCreateReferenceImages={setCreateReferenceImages}
        photoBashLayers={photoBashLayers} setPhotoBashLayers={setPhotoBashLayers}
        selectedLayerId={selectedLayerId} setSelectedLayerId={setSelectedLayerId}
        photoBashCanvasSize={photoBashCanvasSize} setPhotoBashCanvasSize={setPhotoBashCanvasSize}
        colorCalibrateReference={colorCalibrateReference} setColorCalibrateReference={setColorCalibrateReference}
        drawingLayerPrompt={drawingLayerPrompt} setDrawingLayerPrompt={setDrawingLayerPrompt}
        onHarmonizeLayer={() => {}}
        onApplyColorGrade={() => {}}
        drawingSettings={drawingSettings} setDrawingSettings={setDrawingSettings}
      />
      <RightPanel
        isLoading={isLoading || isVideoLoading}
        displayImage={appMode === AppMode.Create ? generatedImage : currentEditImageAsDataUrl}
        error={error}
        promptSuggestion={promptSuggestion}
        editCurrentImage={() => handleAppModeChange(AppMode.Edit)}
        cropCurrentImage={() => setIsCropping(true)}
        resetForNewImage={() => setGeneratedImage(null)}
        isDepthMapResult={isDepthMapResult}
        depthMapControls={depthMapControls} setDepthMapControls={setDepthMapControls}
        onUndo={() => setCurrentHistoryIndex(prev => prev - 1)}
        onRedo={() => setCurrentHistoryIndex(prev => prev + 1)}
        canUndo={canUndo} canRedo={canRedo}
        isEditing={appMode !== AppMode.Create}
        isVideoLoading={isVideoLoading}
        videoResultUrls={videoResultUrls}
        videoError={videoError}
        appMode={appMode}
        createHistory={createHistory}
        setGeneratedImage={setGeneratedImage}
        isHistoryVisible={isHistoryVisible} setIsHistoryVisible={setIsHistoryVisible}
        imageInfo={imageInfo}
        dpiForDownload={dpiForDownload}
        photoBashLayers={photoBashLayers} setPhotoBashLayers={setPhotoBashLayers}
        selectedLayerId={selectedLayerId} setSelectedLayerId={setSelectedLayerId}
        photoBashCanvasSize={photoBashCanvasSize}
        photoBashViewport={photoBashViewport} setPhotoBashViewport={setPhotoBashViewport}
        drawingSettings={drawingSettings}
      />
    </div>
  );
}

export default App;
