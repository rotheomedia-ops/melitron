import React from 'react';
import { useTranslations } from '../context/LanguageContext';

interface DpiSelectorProps {
  selectedDpi: number;
  onDpiChange: (dpi: number) => void;
}

const dpiOptions = [72, 150, 300];

const DpiSelector: React.FC<DpiSelectorProps> = ({ selectedDpi, onDpiChange }) => {
  const { t } = useTranslations();
  return (
    <div className="functions-section">
      <div className="section-title text-gray-300 font-semibold mb-2 flex items-center gap-2">
        <i className="fa-solid fa-ruler-vertical"></i>
        {t('dpiTitle')}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {dpiOptions.map(dpi => (
          <button
            key={dpi}
            onClick={() => onDpiChange(dpi)}
            className={`p-3 rounded-lg transition-colors duration-200 border-2 ${
              selectedDpi === dpi
                ? 'bg-purple-600 border-purple-400 text-white shadow-lg'
                : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
            }`}
          >
            <span className="font-bold text-lg">{dpi}</span>
            <span className="text-xs">{t('dpiLabel')}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2">{t('dpiDescription')}</p>
    </div>
  );
};

export default DpiSelector;
