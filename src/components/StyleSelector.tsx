import React from 'react';
import { useTranslations } from '../context/LanguageContext';

interface StyleSelectorProps {
  style: string;
  setStyle: (style: string) => void;
}

type StylePreset = {
    key: 'stylePhotorealistic' | 'styleAnime' | 'styleWatercolor' | 'styleFantasy' | 'styleCartoon' | 'stylePixelArt' | 'styleSteampunk' | 'styleCyberpunk' | 'styleVintage' | 'style3DRender' | 'styleMinimalist' | 'styleAbstract';
    iconClassName: string;
};

const stylePresets: StylePreset[] = [
  { key: 'stylePhotorealistic', iconClassName: 'fa-solid fa-camera' },
  { key: 'styleAnime', iconClassName: 'fa-solid fa-pen-fancy' },
  { key: 'styleWatercolor', iconClassName: 'fa-solid fa-palette' },
  { key: 'styleFantasy', iconClassName: 'fa-solid fa-dragon' },
  { key: 'styleCartoon', iconClassName: 'fa-solid fa-face-smile-beam' },
  { key: 'stylePixelArt', iconClassName: 'fa-solid fa-chess-board' },
  { key: 'styleSteampunk', iconClassName: 'fa-solid fa-gear' },
  { key: 'styleCyberpunk', iconClassName: 'fa-solid fa-robot' },
  { key: 'styleVintage', iconClassName: 'fa-solid fa-film' },
  { key: 'style3DRender', iconClassName: 'fa-solid fa-cube' },
  { key: 'styleMinimalist', iconClassName: 'fa-solid fa-window-minimize' },
  { key: 'styleAbstract', iconClassName: 'fa-solid fa-swatchbook' },
];

const StyleSelector: React.FC<StyleSelectorProps> = ({ style, setStyle }) => {
  const { t } = useTranslations();

  return (
    <div className="functions-section flex flex-col gap-4">
      <div className="section-title text-gray-300 font-semibold">{t('styleTitle')}</div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {stylePresets.map(preset => {
            const name = t(preset.key);
            const isActive = style === name;
            return (
                <div
                    key={preset.key}
                    onClick={() => setStyle(name)}
                    className={`function-card group relative flex flex-col items-center justify-center p-3 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
                        isActive
                        ? 'bg-purple-600 border-purple-400 text-white shadow-lg scale-105'
                        : 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
                    }`}
                    role="button"
                    aria-pressed={isActive}
                >
                    <i className={`${preset.iconClassName} text-3xl text-gray-300`}></i>
                    <div className="mt-2 text-sm text-center font-semibold">{name}</div>
                </div>
            )
        })}
      </div>
      <div>
        <label htmlFor="custom-style-input" className="section-title text-gray-400 font-semibold text-sm mb-2 block">{t('styleCustom')}</label>
        <input
            id="custom-style-input"
            type="text"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder={t('styleCustomPlaceholder')}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-200"
        />
      </div>
    </div>
  );
};

export default StyleSelector;