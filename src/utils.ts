import { UploadedImage, Language, Layer } from './types';
import en from './locales/en';
import pt from './locales/pt';

declare const heic2any: any;

export const FORBIDDEN_WORDS = [
  // Violence & Gore
  'kill', 'murder', 'slaughter', 'massacre', 'torture', 'behead', 'decapitate', 'lynch',
  'blood', 'bloody', 'gory', 'gore', 'flesh', 'wound', 'injury', 'mutilation', 'dismember',
  'violence', 'brutality', 'assault', 'fight', 'battle', 'war', 'gun', 'knife', 'weapon', 'bomb',
  // Hate Speech & Harmful Content
  'hate', 'racist', 'nazi', 'supremacy', 'bigotry', 'discriminatory',
  // Self-harm
  'suicide', 'self-harm', 'cutting', 'self-injury',
  // Sexually Explicit Material
  'nude', 'naked', 'erotic', 'porn', 'pornographic', 'sex', 'sexual', 'sexy',
  'explicit', 'lust', 'aroused', 'orgasm', 'genital', 'breast', 'penis', 'vagina',
  // Other sensitive topics
  'abuse',
];

export const generateImageHash = (base64: string): string => {
  let hash = 0;
  if (base64.length === 0) return hash.toString();
  const str = base64.substring(0, Math.min(base64.length, 10000)); 
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `img_${hash}`;
};

export const gcd = (a: number, b: number): number => {
  if (b === 0) {
    return a;
  }
  return gcd(b, a % b);
};

export const fileToBase64 = async (file: File, language: Language, onProgress?: (percent: number) => void): Promise<UploadedImage> => {
  const t = language === 'pt' ? pt : en;
  const fileName = file.name.toLowerCase();
  const isHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif');
  
  let fileToProcess: File | Blob = file;

  const fileExt = '.' + (fileName.split('.').pop() || '');
  const rawExtensions = ['.dng', '.raw', '.cr2', '.nef', '.arw', '.orf', '.rw2', '.pef', '.srw'];
  if (rawExtensions.includes(fileExt)) {
      throw new Error(t.dngRawError);
  }

  const supportedStandardMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
  const supportedStandardExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
  const isSupportedStandardType = supportedStandardMimeTypes.includes(file.type) || supportedStandardExtensions.includes(fileExt);

  if (!isSupportedStandardType && !isHeic) {
      throw new Error(t.invalidFileTypeError);
  }

  if (file.size > 50 * 1024 * 1024) { // 50MB limit
      throw new Error(t.fileTooLargeError);
  }

  if (isHeic) {
    try {
      if (typeof heic2any === 'undefined') {
        throw new Error(t.heicLibNotLoaded);
      }
      if (onProgress) onProgress(25);
      
      const conversionResult = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.92,
      });
      
      const convertedBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
      
      fileToProcess = convertedBlob;
      if (onProgress) onProgress(75);
    } catch (e) {
      console.error("HEIC conversion failed:", e);
      throw new Error(t.heicConversionFailed);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const baseProgress = isHeic ? 75 : 0;
        const loadPercentage = isHeic ? 25 : 100;
        const loadProgress = (event.loaded / event.total) * loadPercentage;
        onProgress(Math.round(baseProgress + loadProgress));
      }
    };

    reader.onload = () => {
      if (onProgress) onProgress(100);
      const result = reader.result;

      if (typeof result !== 'string') {
        return reject(new Error(t.fileReadStringError));
      }

      const parts = result.split(',');
      if (parts.length < 2 || parts[1].trim() === '') {
        return reject(new Error(t.fileEmptyError));
      }
      
      const base64 = parts[1];
      const mimeType = fileToProcess.type || 'image/jpeg';

      resolve({ base64, mimeType });
    };

    reader.onerror = error => reject(error);

    reader.readAsDataURL(fileToProcess);
  });
};

export const invertMaskImage = async (mask: UploadedImage): Promise<UploadedImage> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context for mask inversion.'));
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Invert colors (black <-> white)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];     // Red
        data[i + 1] = 255 - data[i + 1]; // Green
        data[i + 2] = 255 - data[i + 2]; // Blue
        // Alpha (data[i + 3]) is preserved
      }

      ctx.putImageData(imageData, 0, 0);
      
      const invertedBase64 = canvas.toDataURL(mask.mimeType).split(',')[1];
      
      resolve({ base64: invertedBase64, mimeType: mask.mimeType });
    };
    img.onerror = (err) => reject(new Error(`Failed to load mask image for inversion: ${err}`));
    img.src = `data:${mask.mimeType};base64,${mask.base64}`;
  });
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const imageEl = new Image();
        imageEl.crossOrigin = 'anonymous';
        imageEl.src = src;
        imageEl.onload = () => resolve(imageEl);
        imageEl.onerror = reject;
    });
};


export const flattenLayersToImage = async (layers: Layer[], canvasSize: {width: number, height: number}, excludeLayerId?: string): Promise<UploadedImage> => {
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not create canvas context for flattening.");

    const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

    for (const layer of sortedLayers) {
        if (layer.id === excludeLayerId || !layer.visible) continue;
        
        let imgToDraw: HTMLImageElement | null = null;
        let imgWidth: number, imgHeight: number;
        
        try {
            if (layer.type === 'image') {
                imgToDraw = await loadImage(`data:${layer.uploadedImage.mimeType};base64,${layer.uploadedImage.base64}`);
                imgWidth = imgToDraw.naturalWidth;
                imgHeight = imgToDraw.naturalHeight;
            } else if (layer.type === 'drawing' && layer.drawingDataUrl) {
                imgToDraw = await loadImage(layer.drawingDataUrl);
                imgWidth = canvasSize.width;
                imgHeight = canvasSize.height;
            }

            if (imgToDraw) {
                ctx.save();
                
                ctx.globalCompositeOperation = layer.blendingMode === 'normal' ? 'source-over' : layer.blendingMode;
                ctx.filter = `brightness(${layer.filters.brightness}%) contrast(${layer.filters.contrast}%) saturate(${layer.filters.saturate}%) hue-rotate(${layer.filters.hue}deg)`;
                
                const scaledWidth = imgWidth * layer.transform.scale;
                const scaledHeight = imgHeight * layer.transform.scale;
                
                const centerX = layer.type === 'image' ? layer.transform.x + scaledWidth / 2 : layer.transform.x;
                const centerY = layer.type === 'image' ? layer.transform.y + scaledHeight / 2 : layer.transform.y;

                ctx.translate(centerX, centerY);
                ctx.rotate(layer.transform.rotation * Math.PI / 180);
                
                if (layer.type === 'image') {
                     ctx.drawImage(imgToDraw, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
                } else {
                    // For drawing layers, transform is relative to top-left of canvas
                    ctx.drawImage(imgToDraw, -scaledWidth/2, -scaledHeight/2, scaledWidth, scaledHeight);
                }

                ctx.restore();
            }
        } catch (error) {
            console.error(`Could not load or draw layer image ${layer.id}`, error);
        }
    }

    const mimeType = 'image/png';
    const base64 = canvas.toDataURL(mimeType).split(',')[1];
    return { base64, mimeType };
};

export const dataURLtoBlob = (dataurl: string): Blob | null => {
    const arr = dataurl.split(',');
    if (arr.length < 2) return null;
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};