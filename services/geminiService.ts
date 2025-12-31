import { GoogleGenAI, Modality } from "@google/genai";
import { CreateFunction, EditFunction, ArchitectureFunction, UploadedImage, Language } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateImage = async (
    prompt: string, 
    func: CreateFunction, 
    aspectRatio: string, 
    lang: Language, 
    transparentBackground: boolean,
    referenceImages?: UploadedImage[] | null,
    dpi?: number
): Promise<string> => {
  const response = await ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt: prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: aspectRatio,
    },
  });
  return `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
};

export const editImage = async (
    prompt: string, 
    func: EditFunction, 
    images: UploadedImage[],
    lang: Language,
    mask?: UploadedImage | null,
    dpi?: number
): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { text: prompt },
                { inlineData: { data: images[0].base64, mimeType: images[0].mimeType } }
            ]
        },
        config: {
            responseModalities: [Modality.IMAGE]
        }
    });
    const part = response.candidates[0].content.parts.find(p => p.inlineData);
    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
};

export const processArchitecturalImage = async () => "";
export const generateVideo = async () => [];
export const suggestBetterPrompt = async () => "";
export const harmonizeLayer = async () => "";
export const applyColorGrade = async () => "";
export const generateFromDrawing = async () => "";
