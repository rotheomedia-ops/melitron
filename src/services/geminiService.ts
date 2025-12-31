
import { GoogleGenAI, Modality } from "@google/genai";
import { CreateFunction, EditFunction, ArchitectureFunction, UploadedImage, Language } from '../types';
import en from '../locales/en';
import pt from '../locales/pt';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface RemodelOptions {
  style: string;
  keepLayout: boolean;
}

const prompts = {
  en: {
    create: {
      [CreateFunction.Sticker]: en.stickerPrompt,
      [CreateFunction.Text]: en.logoPrompt,
      [CreateFunction.Comic]: en.comicPrompt,
    },
    edit: {
      [EditFunction.AddRemove]: en.addRemovePrompt,
      [EditFunction.Retouch]: en.retouchPrompt,
      [EditFunction.Style]: en.stylePrompt,
      [EditFunction.Compose]: en.composePrompt,
      [EditFunction.Upscale]: en.upscalePrompt,
      [EditFunction.DepthMap]: en.depthMapPrompt,
      [EditFunction.RemoveBackground]: en.removeBackgroundPrompt,
    },
    architecture: {
      [ArchitectureFunction.DrawingToBlueprint]: en.drawingToBlueprintPrompt,
      [ArchitectureFunction.BlueprintToOrtho]: en.blueprintToOrthoPrompt,
      [ArchitectureFunction.Remodel]: en.remodelPrompt,
      [ArchitectureFunction.InteriorDesign]: en.interiorDesignPrompt,
      [ArchitectureFunction.ExteriorDesign]: en.exteriorDesignPrompt,
    }
  },
  pt: {
    create: {
      [CreateFunction.Sticker]: pt.stickerPrompt,
      [CreateFunction.Text]: pt.logoPrompt,
      [CreateFunction.Comic]: pt.comicPrompt,
    },
    edit: {
      [EditFunction.AddRemove]: pt.addRemovePrompt,
      [EditFunction.Retouch]: pt.retouchPrompt,
      [EditFunction.Style]: pt.stylePrompt,
      [EditFunction.Compose]: pt.composePrompt,
      [EditFunction.Upscale]: pt.upscalePrompt,
      [EditFunction.DepthMap]: pt.depthMapPrompt,
      [EditFunction.RemoveBackground]: pt.removeBackgroundPrompt,
    },
    architecture: {
      [ArchitectureFunction.DrawingToBlueprint]: pt.drawingToBlueprintPrompt,
      [ArchitectureFunction.BlueprintToOrtho]: pt.blueprintToOrthoPrompt,
      [ArchitectureFunction.Remodel]: pt.remodelPrompt,
      [ArchitectureFunction.InteriorDesign]: pt.interiorDesignPrompt,
      [ArchitectureFunction.ExteriorDesign]: pt.exteriorDesignPrompt,
    }
  }
};

const getCreatePrompt = (basePrompt: string, func: CreateFunction, lang: Language, transparentBackground?: boolean): string => {
  if (func === CreateFunction.Free) {
    return basePrompt;
  }
  const template = prompts[lang].create[func];
  let finalPrompt = template.replace('{prompt}', basePrompt);

  if (func === CreateFunction.Text) {
      const t = lang === 'pt' ? pt : en;
      const backgroundInstruction = transparentBackground ? t.logoTransparentInstruction : t.logoCleanBackgroundInstruction;
      finalPrompt = finalPrompt.replace('{background_instruction}', backgroundInstruction);
  }

  return finalPrompt;
};

const getEditPrompt = (basePrompt: string, func: EditFunction, lang: Language): string => {
    const template = prompts[lang].edit[func];
    return template ? template.replace('{prompt}', basePrompt) : basePrompt;
};

const getArchitecturePrompt = (basePrompt: string, func: ArchitectureFunction, lang: Language, options?: { remodel?: RemodelOptions }): string => {
    const t = lang === 'pt' ? pt : en;
    const template = prompts[lang].architecture[func];
    if (!template) return basePrompt;

    if (func === ArchitectureFunction.Remodel && options?.remodel) {
        const layoutInstruction = options.remodel.keepLayout 
            ? t.remodelKeepLayoutInstruction 
            : t.remodelChangeLayoutInstruction;
        
        return template
            .replace('{style}', options.remodel.style)
            .replace('{layout_instruction}', layoutInstruction)
            .replace('{prompt}', basePrompt);
    }
    
    return template.replace('{prompt}', basePrompt);
};

const getDpiText = (dpi: number, lang: Language): string => {
    if (dpi <= 72) return '';
    const t = lang === 'pt' ? pt : en;
    return `. ${t.dpiInstruction.replace('{dpi}', dpi.toString())}`;
};

export const suggestBetterPrompt = async (prompt: string, lang: Language): Promise<string> => {
  const t = lang === 'pt' ? pt : en;
  const systemInstruction = t.promptSuggestionSystemInstruction;

  try {
    // ALWAYS use gemini-3-flash-preview for prompt suggestion as it is a basic text task.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    return response.text.trim();
  } catch (error) {
    console.error("Failed to get prompt suggestion:", error);
    throw new Error(t.promptSuggestionError);
  }
};

export const generateImage = async (
    prompt: string, 
    func: CreateFunction, 
    aspectRatio: string, 
    lang: Language, 
    transparentBackground: boolean,
    referenceImages?: UploadedImage[] | null,
    dpi?: number
): Promise<string> => {
  const t = lang === 'pt' ? pt : en;
  const dpiText = dpi ? getDpiText(dpi, lang) : '';
  const promptWithDpi = prompt + dpiText;
  const fullPrompt = getCreatePrompt(promptWithDpi, func, lang, transparentBackground);

  if (referenceImages && referenceImages.length > 0) {
    const referencePrompt = referenceImages.length > 1
        ? t.createWithMultipleReferencesPrompt.replace('{prompt}', fullPrompt)
        : t.createWithReferencePrompt.replace('{prompt}', fullPrompt);
    
    const textPart = { text: referencePrompt };
    const imageParts = referenceImages.map(refImg => ({
        inlineData: {
            data: refImg.base64,
            mimeType: refImg.mimeType
        }
    }));

    const parts = [textPart, ...imageParts];
    
    const request = {
        model: 'gemini-2.5-flash-image',
        contents: { parts },
    };

    const response = await ai.models.generateContent(request);

    if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content || !response.candidates[0].content.parts) {
        const feedback = (response as any).promptFeedback;
        let details = '';
        if (feedback?.blockReason) {
            details = ` ${t.blockReason}: ${feedback.blockReason}.`;
        } else if (feedback?.safetyRatings) {
            const problematicRatings = feedback.safetyRatings.filter((r: any) => r.severity.includes('HIGH'));
            if (problematicRatings.length > 0) {
                details = ` ${t.safetyViolation}: ${problematicRatings.map((r:any) => r.category).join(', ')}.`;
            }
        }
        throw new Error(`${t.editFailedNoResult}${details}`);
    }

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        }
    }

    throw new Error(t.editFailedNoImage);

  } else {
    const outputMimeType = (func === CreateFunction.Text && transparentBackground) ? 'image/png' : 'image/jpeg';
    
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: fullPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: outputMimeType,
        aspectRatio: aspectRatio,
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const generatedImage = response.generatedImages[0].image;
      const base64ImageBytes: string = generatedImage.imageBytes;
      const actualMimeType: string = generatedImage.mimeType;
      return `data:${actualMimeType};base64,${base64ImageBytes}`;
    }
    const errorText = lang === 'pt' ? pt : en;
    throw new Error(errorText.imageGenFailed);
  }
};

export const processArchitecturalImage = async (
    prompt: string, 
    func: ArchitectureFunction, 
    image: UploadedImage,
    lang: Language,
    options?: { remodel?: RemodelOptions }
): Promise<string> => {
    const errorText = lang === 'pt' ? pt : en;

    const fullPrompt = getArchitecturePrompt(prompt, func, lang, options);
    const textPart = { text: fullPrompt };
    const imagePart = {
        inlineData: {
            data: image.base64,
            mimeType: image.mimeType
        }
    };

    const parts = [textPart, imagePart];
    
    const request = {
        model: 'gemini-2.5-flash-image',
        contents: { parts },
    };

    const response = await ai.models.generateContent(request);

    if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content || !response.candidates[0].content.parts) {
        const feedback = (response as any).promptFeedback;
        let details = '';
        if (feedback?.blockReason) {
            details = ` ${errorText.blockReason}: ${feedback.blockReason}.`;
        } else if (feedback?.safetyRatings) {
            const problematicRatings = feedback.safetyRatings.filter((r: any) => r.severity.includes('HIGH'));
            if (problematicRatings.length > 0) {
                details = ` ${errorText.safetyViolation}: ${problematicRatings.map((r:any) => r.category).join(', ')}.`;
            }
        }
        throw new Error(`${errorText.editFailedNoResult}${details}`);
    }

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        }
    }

    throw new Error(errorText.editFailedNoImage);
};


export const editImage = async (
    prompt: string, 
    func: EditFunction, 
    images: UploadedImage[],
    lang: Language,
    mask?: UploadedImage | null,
    dpi?: number
): Promise<string> => {
    const errorText = lang === 'pt' ? pt : en;
    let request: any; 
    const dpiText = dpi ? getDpiText(dpi, lang) : '';
    const promptWithDpi = prompt + dpiText;

    if (mask && (func === EditFunction.AddRemove || func === EditFunction.Retouch)) {
        if (images.length !== 1) {
            throw new Error(errorText.maskingSingleImageError);
        }

        const textPart = { text: promptWithDpi };
        const imagePart = {
            inlineData: {
                data: images[0].base64,
                mimeType: images[0].mimeType
            }
        };
        const maskPart = {
            inlineData: {
                data: mask.base64,
                mimeType: mask.mimeType,
            },
        };
        const parts = [imagePart, maskPart, textPart];
        
        request = {
            model: 'gemini-2.5-flash-image',
            contents: { parts },
        };

    } else {
        const textPart = { text: getEditPrompt(promptWithDpi, func, lang) };
        const imageParts = images.map(image => ({
            inlineData: {
                data: image.base64,
                mimeType: image.mimeType
            }
        }));

        const parts = [textPart, ...imageParts];
        
        request = {
            model: 'gemini-2.5-flash-image',
            contents: { parts },
        };
    }

    const response = await ai.models.generateContent(request);

    if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content || !response.candidates[0].content.parts) {
        const feedback = (response as any).promptFeedback;
        let details = '';
        if (feedback?.blockReason) {
            details = ` ${errorText.blockReason}: ${feedback.blockReason}.`;
        } else if (feedback?.safetyRatings) {
            const problematicRatings = feedback.safetyRatings.filter((r: any) => r.severity.includes('HIGH'));
            if (problematicRatings.length > 0) {
                details = ` ${errorText.safetyViolation}: ${problematicRatings.map((r:any) => r.category).join(', ')}.`;
            }
        }
        throw new Error(`${errorText.editFailedNoResult}${details}`);
    }

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        }
    }

    throw new Error(errorText.editFailedNoImage);
};


const describeImageForVideoPrompt = async (image: UploadedImage, lang: Language): Promise<string> => {
    const t = lang === 'pt' ? pt : en;
    const descPrompt = t.describeImagePrompt;
    
    // Use gemini-3-flash-preview for text description task as it is a basic text task.
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [
            { text: descPrompt },
            { inlineData: { data: image.base64, mimeType: image.mimeType } }
        ]},
    });
    return response.text;
}


export const generateVideo = async (
    prompt: string,
    images: {
        startImage: UploadedImage;
        middleImage?: UploadedImage | null;
        endImage?: UploadedImage | null;
    },
    lang: Language
): Promise<string[]> => {
    const t = lang === 'pt' ? pt : en;

    const generateSingleVideoSegment = async (videoPrompt: string, image: UploadedImage): Promise<string> => {
        const videoRequest: any = {
            model: 'veo-3.1-fast-generate-preview',
            prompt: videoPrompt,
            image: {
                imageBytes: image.base64,
                mimeType: image.mimeType,
            },
            config: {
                numberOfVideos: 1,
            }
        };

        let operation = await ai.models.generateVideos(videoRequest);

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        if ((operation as any).error) {
            console.error("Video generation failed with an API error:", (operation as any).error);
            const apiErrorMessage = (operation as any).error.message || 'The video generation process failed.';
            const lowerCaseError = apiErrorMessage.toLowerCase();
            
            if (lowerCaseError.includes("prompt") && lowerCaseError.includes("violate")) {
                throw new Error(t.videoPromptSafetyError);
            }
            
            if (apiErrorMessage.includes("violates Gemini API's usage guidelines")) {
                throw new Error(t.videoSafetyError);
            }
            
            throw new Error(apiErrorMessage);
        }

        if (operation.response?.generatedVideos?.[0]?.video?.uri) {
            const downloadLink = operation.response.generatedVideos[0].video.uri;
            
            // Append API key when fetching from the download link as per guidelines.
            const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
            
            if (!response.ok) {
                const errorBody = await response.text();
                console.error("Failed to fetch video data:", response.status, errorBody);
                throw new Error(`Failed to fetch video data (status: ${response.status}).`);
            }
            
            const videoBlob = await response.blob();
            return URL.createObjectURL(videoBlob);

        } else {
            console.error("Video generation operation response:", operation);
            throw new Error('Video generation completed but no video URI was found.');
        }
    };
    
    try {
        const videoUrls: string[] = [];

        if (images.middleImage) {
            // Start -> Middle
            const middleDesc = await describeImageForVideoPrompt(images.middleImage, lang);
            const prompt1 = `${prompt}. ${t.videoTransitionPrompt.replace('{description}', middleDesc)}`;
            const video1Url = await generateSingleVideoSegment(prompt1, images.startImage);
            videoUrls.push(video1Url);

            if (images.endImage) {
                // Middle -> End
                const endDesc = await describeImageForVideoPrompt(images.endImage, lang);
                const prompt2 = `${prompt}. ${t.videoTransitionPrompt.replace('{description}', endDesc)}`;
                const video2Url = await generateSingleVideoSegment(prompt2, images.middleImage);
                videoUrls.push(video2Url);
            }
        } else if (images.endImage) { // start -> end
            const endDesc = await describeImageForVideoPrompt(images.endImage, lang);
            const prompt1 = `${prompt}. ${t.videoTransitionPrompt.replace('{description}', endDesc)}`;
            const videoUrl = await generateSingleVideoSegment(prompt1, images.startImage);
            videoUrls.push(videoUrl);
        }
        else {
            // Just one video from start image with the original prompt
            const videoUrl = await generateSingleVideoSegment(prompt, images.startImage);
            videoUrls.push(videoUrl);
        }

        return videoUrls;
    } catch (error) {
        console.error('Video generation failed:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`${t.videoFailed}: ${errorMessage}`);
    }
};

const sendMultiModalRequest = async (prompt: string, parts: any[], lang: Language): Promise<string> => {
    const t = lang === 'pt' ? pt : en;
    const request = {
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }, ...parts] },
    };

    const response = await ai.models.generateContent(request);

    if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content || !response.candidates[0].content.parts) {
        throw new Error(t.editFailedNoResult);
    }
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error(t.editFailedNoImage);
}

export const harmonizeLayer = async (
    composition: UploadedImage,
    layer: UploadedImage,
    lang: Language
): Promise<string> => {
    const t = lang === 'pt' ? pt : en;
    const prompt = t.harmonizePrompt;
    const compositionPart = { inlineData: { data: composition.base64, mimeType: composition.mimeType } };
    const layerPart = { inlineData: { data: layer.base64, mimeType: layer.mimeType } };
    return await sendMultiModalRequest(prompt, [compositionPart, layerPart], lang);
};

export const applyColorGrade = async (
    image: UploadedImage,
    reference: UploadedImage,
    lang: Language
): Promise<string> => {
    const t = lang === 'pt' ? pt : en;
    const prompt = t.applyColorGradePrompt;
    const imagePart = { inlineData: { data: image.base64, mimeType: image.mimeType } };
    const referencePart = { inlineData: { data: reference.base64, mimeType: reference.mimeType } };
    return await sendMultiModalRequest(prompt, [imagePart, referencePart], lang);
};

export const generateFromDrawing = async (
    drawing: UploadedImage,
    prompt: string,
    lang: Language
): Promise<string> => {
    const t = lang === 'pt' ? pt : en;
    const fullPrompt = t.generateFromDrawingPrompt.replace('{prompt}', prompt);
    const drawingPart = { inlineData: { data: drawing.base64, mimeType: drawing.mimeType } };
    return await sendMultiModalRequest(fullPrompt, [drawingPart], lang);
};
