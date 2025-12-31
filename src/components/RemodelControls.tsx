import React from 'react';
import { useTranslations } from '../context/LanguageContext';
import PromptAnalyzer from './PromptAnalyzer';

interface RemodelControlsProps {
  style: string;
  setStyle: (style: string) => void;
  keepLayout: boolean;
  setKeepLayout: (value: boolean) => void;
  additionalPrompt: string;
  setAdditionalPrompt: (prompt: string) => void;
}

type StylePreset = {
    key: 'remodelStyleModern' | 'remodelStyleMinimalist' | 'remodelStyleIndustrial' | 'remodelStyleBohemian' | 'remodelStyleCoastal' | 'remodelStyleFarmhouse';
    iconClassName: string;
};


const stylePresets: StylePreset[] = [
  { key: 'remodelStyleModern', iconClassName: 'fa-solid fa-couch' },
  { key: 'remodelStyleMinimalist', iconClassName: 'fa-solid fa-window-minimize' },
  { key: 'remodelStyleIndustrial', iconClassName: 'fa-solid fa-industry' },
  { key: 'remodelStyleBohemian', iconClassName: 'fa-solid fa-feather-pointed' },
  { key: 'remodelStyleCoastal', iconClassName: 'fa-solid fa-water' },
  { key: 'remodelStyleFarmhouse', iconClassName: 'fa-solid fa-tractor' },
];

const RemodelControls: React.FC<RemodelControlsProps> = ({
  style, setStyle, keepLayout, setKeepLayout, additionalPrompt, setAdditionalPrompt
}) => {
  const { t } = useTranslations();

  return (
    <div className="flex flex-col gap-4 bg-gray-700 p-3 rounded-lg">
      <div>
        <label htmlFor="keep-layout-toggle" className="flex items-center justify-between cursor-pointer" title={t('remodelKeepLayout')}>
          <span className="font-semibold text-gray-300 text-sm">{t('remodelKeepLayout')}</span>
          <div className="relative">
            <input 
              type="checkbox" 
              id="keep-layout-toggle" 
              className="sr-only peer"
              checked={keepLayout} 
              onChange={(e) => setKeepLayout(e.target.checked)}
            />
            <div className="block bg-gray-600 w-14 h-8 rounded-full peer-checked:bg-purple-500 transition"></div>
            <div className="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-full"></div>
          </div>
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <div className="section-title text-gray-300 font-semibold">{t('remodelStyleTitle')}</div>
        <div className="grid grid-cols-3 gap-2">
          {stylePresets.map(preset => {
              const name = t(preset.key);
              const isActive = style === name;
              return (
                  <div
                      key={preset.key}
                      onClick={() => setStyle(name)}
                      className={`function-card group relative flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
                          isActive
                          ? 'bg-purple-600 border-purple-400 text-white shadow-lg scale-105'
                          : 'bg-gray-800 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
                      }`}
                      role="button"
                      aria-pressed={isActive}
                  >
                      <i className={`${preset.iconClassName} text-2xl text-gray-300`}></i>
                      <div className="mt-1 text-xs text-center font-semibold">{name}</div>
                  </div>
              )
          })}
        </div>
        <div>
          <label htmlFor="custom-style-input" className="section-title text-gray-400 font-semibold text-sm mb-2 block">{t('remodelCustomStyle')}</label>
          <input
              id="custom-style-input"
              type="text"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder={t('remodelCustomPlaceholder')}
              className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-200"
          />
        </div>
      </div>
      
       <div>
         <label htmlFor="additional-instructions" className="section-title text-gray-300 font-semibold mb-2 block">
           {t('remodelAdditionalInstructions')}
         </label>
        <PromptAnalyzer
          id="additional-instructions"
          placeholder={t('promptPlaceholder')}
          value={additionalPrompt}
          onChange={(e) => setAdditionalPrompt(e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
};

export default RemodelControls;