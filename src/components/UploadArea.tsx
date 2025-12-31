import React, { useRef, useCallback, useState } from 'react';
import { UploadedImage } from '../types';
import { fileToBase64 } from '../utils';
import { useTranslations } from '../context/LanguageContext';

interface UploadAreaProps {
  image: UploadedImage | null;
  setImage: (image: UploadedImage | null) => void;
  title?: string;
  id?: string;
}

const UploadArea: React.FC<UploadAreaProps> = ({ image, setImage, title, id }) => {
  const { language, t } = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const defaultTitle = title || t('uploadTitle');

  const handleImageUpload = async (file: File) => {
    setImage(null);
    setUploadError(null);
    setUploadProgress(0);

    if (!file) return;

    try {
      const uploadedImage = await fileToBase64(file, language, setUploadProgress);
      setImage(uploadedImage);
    } catch (e: any) {
      console.error("File processing error:", e);
      setUploadError(e.message || "An unknown error occurred during file processing.");
    } finally {
      setUploadProgress(null);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageUpload(e.target.files[0]);
    }
  };
  
  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadProgress !== null) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleImageUpload(e.dataTransfer.files[0]);
    }
  }, [uploadProgress]);

  const clearImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      setImage(null);
      setUploadError(null);
      if (inputRef.current) {
          inputRef.current.value = "";
      }
  }
  
  const handleClick = () => {
    if (uploadProgress !== null) return;
    setUploadError(null);
    inputRef.current?.click();
  };

  const renderContent = () => {
    if (uploadProgress !== null) {
      return (
        <div className="w-full px-4">
          <div className="text-gray-300 mb-2 text-sm">{t('uploading')}</div>
          <div className="w-full bg-gray-600 rounded-full h-2.5">
            <div className="bg-purple-600 h-2.5 rounded-full transition-width duration-150" style={{ width: `${uploadProgress}%` }}></div>
          </div>
        </div>
      );
    }

    if (uploadError) {
      return (
        <>
          <i className="fa-solid fa-triangle-exclamation text-4xl text-red-500"></i>
          <div className="font-semibold text-red-400 mt-2">{t('uploadErrorTitle')}</div>
          <div className="upload-text text-xs text-red-300 mt-1 px-2">{uploadError}</div>
        </>
      );
    }

    if (image) {
      return (
        <>
            <img src={`data:${image.mimeType};base64,${image.base64}`} alt="Preview" className="image-preview max-w-full max-h-48 object-contain rounded-md"/>
            <button onClick={clearImage} className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold z-10">&times;</button>
        </>
      );
    }

    return (
       <>
          <i className="fa-solid fa-upload text-4xl text-gray-500"></i>
          <div className="font-semibold text-gray-300 mt-2">{defaultTitle}</div>
          <div className="upload-text text-xs text-gray-400 mt-1">{t('uploadSupportedFiles')}</div>
       </>
    );
  }

  return (
    <div
      id={id}
      className={`upload-area relative w-full h-48 bg-gray-700 border-2 border-dashed border-gray-500 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-200 hover:border-purple-500 hover:bg-gray-600 ${image ? 'p-2' : ''}`}
      onClick={handleClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        type="file"
        ref={inputRef}
        onChange={onFileChange}
        className="hidden"
        accept="image/png, image/jpeg, image/webp, image/heic, image/heif"
      />
      {renderContent()}
    </div>
  );
};

export default UploadArea;