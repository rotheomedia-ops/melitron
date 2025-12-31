import React from 'react';
import { useTranslations } from '../context/LanguageContext';

interface UpscaleSelectorProps {
  selectedFactor: number;
  onFactorChange: (factor: number) => void;
}

const factors = [2, 4, 8, 16];

const UpscaleSelector: React.FC<UpscaleSelectorProps> = ({ selectedFactor, onFactorChange }) => {
  const { t } = useTranslations();
  return (
    <div className="functions-section">
      <div className="section-title text-gray-300 font-semibold mb-2">🔥 {t('upscaleFactor')}</div>
      <div className="grid grid-cols-4 gap-2">
        {factors.map(factor => (
          <button
            key={factor}
            onClick={() => onFactorChange(factor)}
            className={`p-3 rounded-lg transition-colors duration-200 border-2 ${
              selectedFactor === factor
                ? 'bg-purple-600 border-purple-400 text-white shadow-lg'
                : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
            }`}
          >
            <span className="font-bold text-lg">{factor}x</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default UpscaleSelector;