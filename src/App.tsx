import React, { useState, useEffect, useCallback } from 'react';
import { AppMode, CreateFunction, EditFunction, ArchitectureFunction, UploadedImage, DepthMapControlsState, EditHistoryStep, Layer, LayerTransform, LayerFilters, ImageLayer, PhotoBashViewport, DrawingTool, DrawingLayer } from './types';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import ImageCropper from './components/ImageCropper';
import { generateImage, editImage, processArchitecturalImage, generateVideo, suggestBetterPrompt, harmonizeLayer, applyColorGrade, generateFromDrawing } from './services/geminiService';
import { generateImageHash, fileToBase64, invertMaskImage, flattenLayersToImage } from './utils';
import { useTranslations } from './context/LanguageContext';

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
  
  // State for Remodel feature
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


  // Photo Bash State
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
      console.error("Could not save history visibility to session storage:", e);
    }
  }, [isHistoryVisible]);

  const handleDrawingUploadForBlueprint = useCallback(async (image: UploadedImage) => {
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
    setOriginalImageHash(imageHash);
    
    setIsLoading(true);
    setError(null);
    setPromptSuggestion(null);
    setVideoResultUrls([]);
    setVideoError(null);
    setIsDepthMapResult(false);
    setImageInfo(null);


    try {
      const resultImage = await processArchitecturalImage(prompt, ArchitectureFunction.DrawingToBlueprint, image, language);
      
      const newStep: EditHistoryStep = {
        id: `arch-${Date.now()}`,
        prompt: prompt || t('drawingToBlueprint'),
        editFunction: EditFunction.AddRemove,
        resultImage,
        dpi: 72,
      };

      setEditHistory(prev => [...prev, newStep]);
      setCurrentHistoryIndex(1);

    } catch (e: any) {
      console.error(e);
      setError(e.message || t('errorTitle'));
    } finally {
      setIsLoading(false);
    }
  }, [language, prompt, t]);

  const handleBlueprintUploadForOrtho = useCallback(async (image: UploadedImage) => {
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
    setOriginalImageHash(imageHash);
    
    setIsLoading(true);
    setError(null);
    setPromptSuggestion(null);
    setVideoResultUrls([]);
    setVideoError(null);
    setIsDepthMapResult(false);
    setImageInfo(null);

    try {
      const resultImage = await processArchitecturalImage(prompt, ArchitectureFunction.BlueprintToOrtho, image, language);
      
      const newStep: EditHistoryStep = {
        id: `arch-ortho-${Date.now()}`,
        prompt: prompt || t('blueprintToOrtho'),
        editFunction: EditFunction.AddRemove, // Placeholder
        resultImage,
        dpi: 72,
      };

      setEditHistory(prev => [...prev, newStep]);
      setCurrentHistoryIndex(1);

    } catch (e: any) {
      console.error(e);
      setError(e.message || t('errorTitle'));
    } finally {
      setIsLoading(false);
    }
  }, [language, prompt, t]);


  const handleImageSelect = useCallback((image: UploadedImage | null) => {
    setImageInfo(null);
    if (image) {
      if (appMode === AppMode.Architecture && architectureFunction === ArchitectureFunction.DrawingToBlueprint) {
        handleDrawingUploadForBlueprint(image);
        return;
      }
       if (appMode === AppMode.Architecture && architectureFunction === ArchitectureFunction.BlueprintToOrtho) {
        handleBlueprintUploadForOrtho(image);
        return;
      }
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
        localStorage.removeItem(`mask_${imageHash}`);
      }
    } else {
      setEditHistory([]);
      setCurrentHistoryIndex(-1);
      setOriginalImageHash(null);
    }
  }, [t, appMode, architectureFunction, handleDrawingUploadForBlueprint, handleBlueprintUploadForOrtho]);
  
  const handleAppModeChange = useCallback((newMode: AppMode) => {
    if (newMode === appMode) return;

    const dataUrlToCarry = appMode === AppMode.Create ? generatedImage : currentEditImageAsDataUrl;
    
    // Carry over an image to a different mode
    if (dataUrlToCarry) {
        const mimeType = dataUrlToCarry.substring(dataUrlToCarry.indexOf(":") + 1, dataUrlToCarry.indexOf(";"));
        const base64 = dataUrlToCarry.split(',')[1];
        const imageToCarry = { base64, mimeType };

        if (newMode === AppMode.Edit || newMode === AppMode.Architecture) {
            handleImageSelect(imageToCarry);
        } else if (newMode === AppMode.Animate) {
            setAnimateImage1(imageToCarry);
            setAnimateImageMiddle(null);
            setAnimateImage2(null);
            handleImageSelect(null); // Clear edit history
        } else if (newMode === AppMode.PhotoBash) {
            const img = new Image();
            img.src = dataUrlToCarry;
            img.onload = () => {
                const newCanvasSize = { width: img.naturalWidth, height: img.naturalHeight };
                setPhotoBashCanvasSize(newCanvasSize);
                const newLayer: Layer = {
                    id: `layer-${Date.now()}`,
                    name: 'Imported Image',
                    type: 'image',
                    uploadedImage: imageToCarry,
                    visible: true,
                    transform: { ...defaultLayerTransform, x: 0, y: 0 },
                    filters: defaultLayerFilters,
                    zIndex: 1,
                    blendingMode: 'normal',
                };
                setPhotoBashLayers([newLayer]);
                setSelectedLayerId(newLayer.id);
            }
        }
    } else {
        handleImageSelect(null);
        setAnimateImage1(null);
        setAnimateImageMiddle(null);
        setAnimateImage2(null);
    }

    setAppMode(newMode);
    setPrompt('');
    setGeneratedImage(null);
    setComposeImages([]);
    setError(null);
    setPromptSuggestion(null);
    setVideoResultUrls([]);
    setVideoError(null);
    setIsDepthMapResult(false);
    setAspectRatio('1:1');
    setCreateReferenceImages([]);
    setTransparentBackground(false);
    setImageInfo(null);

    if (newMode !== AppMode.PhotoBash) {
      setPhotoBashLayers([]);
      setPhotoBashCanvasSize(null);
      setSelectedLayerId(null);
      setPhotoBashViewport(initialPhotoBashViewport);
    }

    if (newMode === AppMode.Create) setCreateFunction(CreateFunction.Free);
    if (newMode === AppMode.Edit) setEditFunction(EditFunction.AddRemove);
    if (newMode === AppMode.Architecture) setArchitectureFunction(ArchitectureFunction.DrawingToBlueprint);
  }, [appMode, generatedImage, currentEditImageAsDataUrl, handleImageSelect]);


  useEffect(() => {
    if (appMode === AppMode.Edit && editFunction === EditFunction.Upscale) {
      setPrompt(`Upscale this image by ${upscaleFactor}x, enhancing details and clarity.`);
    }
  }, [upscaleFactor, appMode, editFunction]);

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      if (appMode === AppMode.Create || (document.activeElement as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }

      const items = event.clipboardData?.items;
      if (!items) return;

      let imageFile: File | null = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          imageFile = items[i].getAsFile();
          break;
        }
      }

      if (imageFile) {
        event.preventDefault();
        try {
          if (imageFile.size > 50 * 1024 * 1024) {
            setError(t('pastedImageTooLarge'));
            return;
          }
          const uploadedImage = await fileToBase64(imageFile, language);
          
          if (appMode === AppMode.Animate) {
              if (!animateImage1) {
                  setAnimateImage1(uploadedImage);
              } else if (!animateImageMiddle) {
                  setAnimateImageMiddle(uploadedImage);
              } else if (!animateImage2) {
                  setAnimateImage2(uploadedImage);
              }
          } else if (appMode === AppMode.PhotoBash && photoBashCanvasSize) {
              const newLayer: Layer = {
                  id: `layer-${Date.now()}`,
                  name: `Pasted Image ${photoBashLayers.length + 1}`,
                  type: 'image',
                  uploadedImage,
                  visible: true,
                  transform: { ...defaultLayerTransform, x: 20, y: 20 },
                  filters: defaultLayerFilters,
                  zIndex: photoBashLayers.length + 1,
                  blendingMode: 'normal',
              };
              setPhotoBashLayers(prev => [...prev, newLayer]);
              setSelectedLayerId(newLayer.id);
          } else {
              handleImageSelect(uploadedImage);
          }

        } catch (e) {
          console.error("Failed to process pasted image:", e);
          setError(t('failedToProcessPastedImage'));
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [appMode, handleImageSelect, language, t, animateImage1, animateImageMiddle, animateImage2, photoBashLayers, photoBashCanvasSize]);

  const handleHarmonizeLayer = async (layerId: string) => {
    if (!photoBashCanvasSize) return;
    const layerToHarmonize = photoBashLayers.find(l => l.id === layerId && l.type === 'image') as ImageLayer | undefined;
    if (!layerToHarmonize) return;

    setIsLoading(true);
    setError(null);
    try {
        const composition = await flattenLayersToImage(photoBashLayers, photoBashCanvasSize, layerId);
        const resultDataUrl = await harmonizeLayer(composition, layerToHarmonize.uploadedImage, language);
        
        const mimeType = resultDataUrl.substring(resultDataUrl.indexOf(":") + 1, resultDataUrl.indexOf(";"));
        const base64 = resultDataUrl.split(',')[1];

        setPhotoBashLayers(layers => layers.map(l => 
            l.id === layerId ? { ...l, uploadedImage: { base64, mimeType } } : l
        ));

    } catch (e: any) {
        setError(e.message || t('errorTitle'));
    } finally {
        setIsLoading(false);
    }
  };

  const handleApplyColorGrade = async () => {
      if (!photoBashCanvasSize || !colorCalibrateReference) return;

      setIsLoading(true);
      setError(null);
      try {
          const composition = await flattenLayersToImage(photoBashLayers, photoBashCanvasSize);
          const resultDataUrl = await applyColorGrade(composition, colorCalibrateReference, language);

          const mimeType = resultDataUrl.substring(resultDataUrl.indexOf(":") + 1, resultDataUrl.indexOf(";"));
          const base64 = resultDataUrl.split(',')[1];

          const newLayer: ImageLayer = {
              id: `layer-graded-${Date.now()}`,
              name: 'Color Graded Result',
              type: 'image',
              uploadedImage: { base64, mimeType },
              visible: true,
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              filters: defaultLayerFilters,
              zIndex: 1,
              blendingMode: 'normal',
          };
          setPhotoBashLayers([newLayer]);
          setSelectedLayerId(newLayer.id);

      } catch(e: any) {
          setError(e.message || t('errorTitle'));
      } finally {
          setIsLoading(false);
      }
  };

  const handleGenerate = async () => {
    if (appMode === AppMode.PhotoBash) {
      if (!photoBashCanvasSize) return;
      setIsLoading(true);
      setError(null);
      try {
          const finalImage = await flattenLayersToImage(photoBashLayers, photoBashCanvasSize);
          const link = document.createElement('a');
          link.href = `data:${finalImage.mimeType};base64,${finalImage.base64}`;
          link.download = `photobash-export-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (e: any) {
          setError(e.message || t('errorTitle'));
      } finally {
          setIsLoading(false);
      }
      return;
    }

    if (appMode === AppMode.Animate) {
      if (!prompt) {
        setError(t('promptError'));
        return;
      }
      if (!animateImage1) {
        setError(t('uploadErrorAnimate'));
        return;
      }
      setIsVideoLoading(true);
      setVideoResultUrls([]);
      setVideoError(null);
      setError(null);
      setPromptSuggestion(null);
      setIsLoading(false);
      setImageInfo(null);

      try {
        const videoUrls = await generateVideo(prompt, { startImage: animateImage1, middleImage: animateImageMiddle, endImage: animateImage2 }, language);
        setVideoResultUrls(videoUrls);
      } catch (e: any) {
        console.error(e);
        setVideoError(e.message || t('videoFailed'));
      } finally {
        setIsVideoLoading(false);
      }
      return;
    }

    let isPromptRequired = true;
    if (appMode === AppMode.Edit) {
        if (editFunction === EditFunction.Upscale || editFunction === EditFunction.DepthMap || editFunction === EditFunction.RemoveBackground) {
            isPromptRequired = false;
        }
    }
    if (appMode === AppMode.Architecture) {
        if (architectureFunction === ArchitectureFunction.Remodel) {
            isPromptRequired = false;
        }
    }
    
    if (isPromptRequired && !prompt && editFunction !== EditFunction.FazoL) {
      setError(t('promptError'));
      return;
    }
     if (appMode === AppMode.Edit && editFunction !== EditFunction.Compose && !currentEditImageForPanel) {
        setError(t('uploadErrorEdit'));
        return;
    }
     if (appMode === AppMode.Edit && editFunction === EditFunction.Compose && composeImages.length < 2) {
        setError(t('uploadErrorCompose'));
        return;
    }
    if (appMode === AppMode.Architecture && !currentEditImageForPanel) {
        setError(t('uploadErrorEdit'));
        return;
    }
    
    setIsLoading(true);
    setGeneratedImage(null);
    setError(null);
    setPromptSuggestion(null);
    setVideoResultUrls([]);
    setVideoError(null);
    setIsDepthMapResult(false);
    setImageInfo(null);

    const functionsWithDpi = [
        EditFunction.AddRemove,
        EditFunction.FazoL,
        EditFunction.Retouch,
        EditFunction.Style,
        EditFunction.Compose,
    ];

    const dpiToUse = (appMode === AppMode.Create || (appMode === AppMode.Edit && functionsWithDpi.includes(editFunction))) ? dpi : undefined;
    setLastUsedDpi(dpiToUse || null);

    try {
        let intermediateImage: string;
        let finalPromptForHistory = prompt;

        // Step 1: Generate the initial image based on the current mode and function
        if (appMode === AppMode.Create) {
            intermediateImage = await generateImage(prompt, createFunction, aspectRatio, language, transparentBackground, createReferenceImages, dpiToUse);
        } else if (appMode === AppMode.Architecture) {
            if (!currentEditImageForPanel) throw new Error(t('uploadErrorEdit'));
            const archOptions = architectureFunction === ArchitectureFunction.Remodel ? { remodel: { style: remodelStyle, keepLayout: keepLayout } } : undefined;
            const resultImage = await processArchitecturalImage(prompt, architectureFunction, currentEditImageForPanel, language, archOptions);
            const newStep: EditHistoryStep = { id: `arch-${Date.now()}`, prompt, editFunction: EditFunction.AddRemove, resultImage, dpi: 72 };
            const newHistory = editHistory.slice(0, currentHistoryIndex + 1);
            setEditHistory([...newHistory, newStep]);
            setCurrentHistoryIndex(newHistory.length);
            setIsLoading(false);
            return;
        } else { // Edit Mode
            if (editFunction === EditFunction.Compose) {
                intermediateImage = await editImage(prompt, editFunction, composeImages, language, undefined, dpiToUse);
            } else {
                if (!currentEditImageForPanel) throw new Error(t('uploadErrorEdit'));
                let finalMask = maskImage;
                if (maskImage && invertMask) finalMask = await invertMaskImage(maskImage);
                if (editFunction === EditFunction.FazoL) {
                    const predefinedPrompt = t('fazoLPrompt');
                    finalPromptForHistory = prompt ? `${predefinedPrompt}. ${prompt}` : predefinedPrompt;
                }
                intermediateImage = await editImage(finalPromptForHistory, editFunction, [currentEditImageForPanel], language, finalMask, dpiToUse);
            }
        }

        // Step 2: Conditionally upscale the generated image if a high DPI is selected
        let finalImage = intermediateImage;
        const shouldUpscale = dpiToUse && dpiToUse > 72;

        if (shouldUpscale && intermediateImage) {
            const mimeType = intermediateImage.substring(intermediateImage.indexOf(":") + 1, intermediateImage.indexOf(";"));
            const base64 = intermediateImage.split(',')[1];
            const imageToUpscale: UploadedImage = { base64, mimeType };
            
            const upscaleFactor = dpiToUse >= 300 ? 4 : 2;
            const upscalePrompt = `Upscale this image by ${upscaleFactor}x, enhancing details and clarity.`;

            finalImage = await editImage(upscalePrompt, EditFunction.Upscale, [imageToUpscale], language, null, undefined);
        }

        // Step 3: Update the UI and history with the final image
        if (appMode === AppMode.Create) {
            setGeneratedImage(finalImage);
            setCreateHistory(prev => [finalImage, ...prev.slice(0, 49)]);
        } else { // Edit Mode
            if (editFunction === EditFunction.Compose) {
                const mimeType = finalImage.substring(finalImage.indexOf(":") + 1, finalImage.indexOf(";"));
                const base64 = finalImage.split(',')[1];
                handleImageSelect({ base64, mimeType });
            } else {
                const newStep: EditHistoryStep = {
                    id: `edit-${Date.now()}`,
                    prompt: finalPromptForHistory,
                    editFunction,
                    mask: maskImage || undefined,
                    resultImage: finalImage,
                    dpi: dpiToUse,
                };
                const newHistory = editHistory.slice(0, currentHistoryIndex + 1);
                setEditHistory([...newHistory, newStep]);
                setCurrentHistoryIndex(newHistory.length);
            }
             if (editFunction === EditFunction.DepthMap) {
                setIsDepthMapResult(true);
                setDepthMapControls(initialDepthControls);
            }
        }

        // Step 4: Get dimensions and generate info string for display
        if (finalImage) {
            const img = new Image();
            img.onload = () => {
                const { naturalWidth: w, naturalHeight: h } = img;
                let info = `${w} x ${h} px`;
                
                const dpiUsed = dpiToUse || 0;

                if (dpiUsed > 72) {
                    const widthInches = (w / dpiUsed).toFixed(1);
                    const heightInches = (h / dpiUsed).toFixed(1);
                    info += ` — ${t('printSizeInfo', { width: widthInches, height: heightInches, dpi: dpiUsed })}`;
                }
                setImageInfo(info);
            };
            img.src = finalImage;
        }

    } catch (e: any) {
      console.error(e);
      const errorMessage = e.message || t('errorTitle');
      setError(errorMessage);

      if ((errorMessage.includes(t('editFailedNoImage')) || errorMessage.includes(t('editFailedNoResult'))) && prompt.trim()) {
        try {
          const suggestion = await suggestBetterPrompt(prompt, language);
          setPromptSuggestion(suggestion);
        } catch (suggestionError: any) {
          console.error("Failed to get prompt suggestion:", suggestionError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleUndo = () => canUndo && setCurrentHistoryIndex(currentHistoryIndex - 1);
  const handleRedo = () => canRedo && setCurrentHistoryIndex(currentHistoryIndex + 1);

  const handleEditFunctionSelect = (func: EditFunction) => {
    setEditFunction(func);
    // Reset prompt unless the function manages its own
    if (func === EditFunction.DepthMap) {
      setPrompt('Generate a high-quality depth map for this image.');
    } else if (func === EditFunction.Upscale) {
      setPrompt(`Upscale this image by ${upscaleFactor}x, enhancing details and clarity.`);
    } else if (func === EditFunction.RemoveBackground) {
      setPrompt('Remove the background from this image.');
    } else if (func === EditFunction.Style) {
      // Set Photorealistic as the default style when switching to Style mode
      // This prevents an empty prompt error if the user clicks Generate right away.
      setPrompt(t('stylePhotorealistic'));
    }
     else {
      setPrompt('');
    }

    // Compose is special, it needs a clean slate for its own image list
    if (func === EditFunction.Compose) {
      handleImageSelect(null);
      setComposeImages([]);
    }
  };
  
  const handleArchitectureFunctionSelect = (func: ArchitectureFunction) => {
    setArchitectureFunction(func);
    setPrompt('');
    if (func === ArchitectureFunction.Remodel) {
      setRemodelStyle('Modern');
      setKeepLayout(true);
    }
  };

  const resetForNewImage = () => {
    setGeneratedImage(null);
    setPrompt('');
    handleImageSelect(null);
    setComposeImages([]);
    setAnimateImage1(null);
    setAnimateImageMiddle(null);
    setAnimateImage2(null);
    setIsDepthMapResult(false);
    setVideoResultUrls([]);
    setVideoError(null);
    setError(null);
    setPromptSuggestion(null);
    setCreateReferenceImages([]);
    setTransparentBackground(false);
    setPhotoBashLayers([]);
    setSelectedLayerId(null);
    setPhotoBashCanvasSize(null);
    setPhotoBashViewport(initialPhotoBashViewport);
    setImageInfo(null);
  };
  
  const editCurrentImage = () => {
    const imageToEdit = appMode === AppMode.Create ? generatedImage : currentEditImageAsDataUrl;
    if (!imageToEdit) return;
    handleAppModeChange(AppMode.Edit);
  };

  const handleCropCurrentImage = () => {
    const imageToEdit = appMode === AppMode.Create ? generatedImage : currentEditImageAsDataUrl;
    if (!imageToEdit) return;
    
    if (appMode !== AppMode.Edit) {
      editCurrentImage();
    }

    setTimeout(() => {
        setEditFunction(EditFunction.Crop);
        setIsCropping(true);
    }, 50);
  };

  const handleSaveCrop = (croppedImage: UploadedImage) => {
    const dataUrl = `data:${croppedImage.mimeType};base64,${croppedImage.base64}`;
    const newStep: EditHistoryStep = {
      id: `edit-${Date.now()}`,
      prompt: t('cropImagePrompt'),
      editFunction: EditFunction.Crop,
      resultImage: dataUrl,
      dpi: currentEditStep?.dpi || 72,
    };

    const newHistory = editHistory.slice(0, currentHistoryIndex + 1);
    setEditHistory([...newHistory, newStep]);
    setCurrentHistoryIndex(newHistory.length);
    setIsCropping(false);
  };

  return (
    <div className="container mx-auto p-4 flex flex-col lg:flex-row gap-4 min-h-screen">
       {isCropping && currentEditImageForPanel && (
        <ImageCropper
          image={currentEditImageForPanel}
          onSave={handleSaveCrop}
          onCancel={() => setIsCropping(false)}
        />
      )}
      <LeftPanel
        prompt={prompt}
        setPrompt={setPrompt}
        appMode={appMode}
        setAppMode={handleAppModeChange}
        createFunction={createFunction}
        setCreateFunction={setCreateFunction}
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        editFunction={editFunction}
        setEditFunction={handleEditFunctionSelect}
        architectureFunction={architectureFunction}
        setArchitectureFunction={handleArchitectureFunctionSelect}
        remodelStyle={remodelStyle}
        setRemodelStyle={setRemodelStyle}
        keepLayout={keepLayout}
        setKeepLayout={setKeepLayout}
        upscaleFactor={upscaleFactor}
        setUpscaleFactor={setUpscaleFactor}
        dpi={dpi}
        setDpi={setDpi}
        transparentBackground={transparentBackground}
        setTransparentBackground={setTransparentBackground}
        currentEditImage={currentEditImageForPanel}
        onSelectNewImage={handleImageSelect}
        originalImageHash={originalImageHash}
        maskImage={maskImage}
        setMaskImage={setMaskImage}
        invertMask={invertMask}
        setInvertMask={setInvertMask}
        composeImages={composeImages}
        setComposeImages={setComposeImages}
        onGenerate={handleGenerate}
        isLoading={isLoading}
        isVideoLoading={isVideoLoading}
        onOpenCropper={() => setIsCropping(true)}
        animateImage1={animateImage1}
        setAnimateImage1={setAnimateImage1}
        animateImageMiddle={animateImageMiddle}
        setAnimateImageMiddle={setAnimateImageMiddle}
        animateImage2={animateImage2}
        setAnimateImage2={setAnimateImage2}
        createHistory={createHistory}
        createReferenceImages={createReferenceImages}
        setCreateReferenceImages={setCreateReferenceImages}
        // Photo Bash Props
        photoBashLayers={photoBashLayers}
        setPhotoBashLayers={setPhotoBashLayers}
        selectedLayerId={selectedLayerId}
        setSelectedLayerId={setSelectedLayerId}
        photoBashCanvasSize={photoBashCanvasSize}
        setPhotoBashCanvasSize={setPhotoBashCanvasSize}
        colorCalibrateReference={colorCalibrateReference}
        setColorCalibrateReference={setColorCalibrateReference}
        drawingLayerPrompt={drawingLayerPrompt}
        setDrawingLayerPrompt={setDrawingLayerPrompt}
        onHarmonizeLayer={handleHarmonizeLayer}
        onApplyColorGrade={handleApplyColorGrade}
        drawingSettings={drawingSettings}
        setDrawingSettings={setDrawingSettings}
      />
      <RightPanel
        isLoading={isLoading || isVideoLoading}
        displayImage={appMode === AppMode.Create ? generatedImage : currentEditImageAsDataUrl}
        error={error}
        promptSuggestion={promptSuggestion}
        editCurrentImage={editCurrentImage}
        cropCurrentImage={handleCropCurrentImage}
        resetForNewImage={resetForNewImage}
        isDepthMapResult={isDepthMapResult}
        depthMapControls={depthMapControls}
        setDepthMapControls={setDepthMapControls}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        isEditing={appMode !== AppMode.Create && !!currentEditImageAsDataUrl}
        isVideoLoading={isVideoLoading}
        videoResultUrls={videoResultUrls}
        videoError={videoError}
        appMode={appMode}
        createHistory={createHistory}
        setGeneratedImage={setGeneratedImage}
        isHistoryVisible={isHistoryVisible}
        setIsHistoryVisible={setIsHistoryVisible}
        imageInfo={imageInfo}
        dpiForDownload={dpiForDownload}
        // Photo Bash Props
        photoBashLayers={photoBashLayers}
        setPhotoBashLayers={setPhotoBashLayers}
        selectedLayerId={selectedLayerId}
        setSelectedLayerId={setSelectedLayerId}
        photoBashCanvasSize={photoBashCanvasSize}
        photoBashViewport={photoBashViewport}
        setPhotoBashViewport={setPhotoBashViewport}
        drawingSettings={drawingSettings}
      />
    </div>
  );
}

export default App;