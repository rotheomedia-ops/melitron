import { UploadedImage, Language, Layer } from './types';

export const generateImageHash = (base64: string): string => {
  let hash = 0;
  const str = base64.substring(0, Math.min(base64.length, 10000)); 
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `img_${hash}`;
};

export const fileToBase64 = async (file: File, language: Language, onProgress?: (percent: number) => void): Promise<UploadedImage> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const invertMaskImage = async (mask: UploadedImage): Promise<UploadedImage> => {
    return mask; // Simplificado para o exemplo
};

export const flattenLayersToImage = async (layers: Layer[], canvasSize: {width: number, height: number}): Promise<UploadedImage> => {
    return { base64: '', mimeType: 'image/png' };
};

export const dataURLtoBlob = (dataurl: string): Blob | null => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

export const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
