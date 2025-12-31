import React, { useState } from 'react';
import { UploadedImage } from '../types';
import UploadArea from './UploadArea';
import { useTranslations } from '../context/LanguageContext';

interface AnimateImageInputProps {
  image: UploadedImage | null;
  setImage: (image: UploadedImage | null) => void;
  history: string[];
  title: string;
  id: string;
}

const AnimateImageInput: React.FC<AnimateImageInputProps> = ({ image, setImage, history, title, id }) => {
  const { t } = useTranslations();
  const [showHistory, setShowHistory] = useState(false);

  const handleSelectFromHistory = (histImage: string) => {
    const mimeType = histImage.substring(histImage.indexOf(":") + 1, histImage.indexOf(";"));
    const base64 = histImage.split(',')[1];
    setImage({ base64, mimeType });
    setShowHistory(false);
  };

  return (
    <div className="flex flex-col gap-2 bg-gray-700 p-3 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-gray-300 font-semibold">{title}</h3>
        {history.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-3 rounded-lg transition-colors"
          >
            {t('selectFromHistory')}
          </button>
        )}
      </div>

      {showHistory && (
        <div className="bg-gray-800 p-2 rounded-lg">
          <div className="flex overflow-x-auto gap-2 p-1">
            {history.map((histImage, index) => (
              <div key={index} className="flex-shrink-0">
                <img
                  src={histImage}
                  alt={`History item ${index + 1}`}
                  className="w-20 h-20 object-cover rounded-md cursor-pointer border-2 border-transparent hover:border-purple-500 transition-all"
                  onClick={() => handleSelectFromHistory(histImage)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <UploadArea id={id} image={image} setImage={setImage} />
    </div>
  );
};

export default AnimateImageInput;