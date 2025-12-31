import React, { useState, useEffect } from 'react';
import { gcd } from '../utils';
import { useTranslations } from '../context/LanguageContext';

interface AspectRatioSelectorProps {
    selectedRatio: string;
    onRatioChange: (ratio: string) => void;
}

const SUPPORTED_RATIOS = [
    { value: '1:1', decimal: 1 / 1 },
    { value: '9:16', decimal: 9 / 16 },
    { value: '16:9', decimal: 16 / 9 },
    { value: '4:3', decimal: 4 / 3 },
    { value: '3:4', decimal: 3 / 4 },
];

const findClosestSupportedRatio = (ratio: string): string => {
    const parts = ratio.split(':');
    if (parts.length !== 2) return SUPPORTED_RATIOS[0].value;
    
    const [w, h] = parts.map(Number);
    if (isNaN(w) || isNaN(h) || h === 0) return SUPPORTED_RATIOS[0].value;

    const customDecimal = w / h;

    let closest = SUPPORTED_RATIOS[0];
    let minDiff = Math.abs(customDecimal - closest.decimal);

    for (let i = 1; i < SUPPORTED_RATIOS.length; i++) {
        const diff = Math.abs(customDecimal - SUPPORTED_RATIOS[i].decimal);
        if (diff < minDiff) {
            minDiff = diff;
            closest = SUPPORTED_RATIOS[i];
        }
    }
    return closest.value;
};

const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({ selectedRatio, onRatioChange }) => {
    const { t } = useTranslations();
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');
    const [calculatedRatio, setCalculatedRatio] = useState('');
    const [closestSupportedRatio, setClosestSupportedRatio] = useState('');
    const [userSelection, setUserSelection] = useState(selectedRatio);
    
    const extendedPresets = [
        { value: '1:1', label: t('ratioSquare'), iconClassName: 'fa-solid fa-square' },
        { value: '9:16', label: t('ratioStory'), iconClassName: 'fa-solid fa-mobile-screen-button' },
        { value: '16:9', label: t('ratioWidescreen'), iconClassName: 'fa-solid fa-display' },
        { value: '4:3', label: t('ratioPhoto'), iconClassName: 'fa-solid fa-camera-retro' },
        { value: '3:4', label: t('ratioPortrait'), iconClassName: 'fa-solid fa-portrait' },
        { value: '3:2', label: t('ratio35mm'), iconClassName: 'fa-solid fa-film' },
        { value: '5:4', label: t('ratioLargeFormat'), iconClassName: 'fa-solid fa-book' },
        { value: '2:1', label: t('ratioPanoramic'), iconClassName: 'fa-solid fa-panorama' },
    ];

    useEffect(() => {
        setUserSelection(selectedRatio);
    }, [selectedRatio]);

    useEffect(() => {
        const numWidth = parseInt(width, 10);
        const numHeight = parseInt(height, 10);

        if (numWidth > 0 && numHeight > 0) {
            const divisor = gcd(numWidth, numHeight);
            const simplifiedWidth = numWidth / divisor;
            const simplifiedHeight = numHeight / divisor;
            const customRatio = `${simplifiedWidth}:${simplifiedHeight}`;
            
            setCalculatedRatio(customRatio);
            setClosestSupportedRatio(findClosestSupportedRatio(customRatio));

        } else {
            setCalculatedRatio('');
            setClosestSupportedRatio('');
        }
    }, [width, height]);
    
    const handlePresetClick = (presetValue: string) => {
        setUserSelection(presetValue);
        onRatioChange(findClosestSupportedRatio(presetValue));
    };
    
    const handleApplyCalculator = () => {
        if (closestSupportedRatio) {
            setUserSelection(calculatedRatio || closestSupportedRatio);
            onRatioChange(closestSupportedRatio);
        }
    }
    
    const isSupported = (ratio: string) => SUPPORTED_RATIOS.some(r => r.value === ratio);

    return (
        <div className="functions-section">
            <div className="section-title text-gray-300 font-semibold mb-2 flex items-center gap-2">
                <i className="fa-solid fa-aspect-ratio"></i>
                {t('aspectRatioTitle')} 
                ({t('selected')}: <span className="text-purple-400 font-bold">{userSelection}</span>
                { userSelection !== selectedRatio && `, ${t('applied')}: ${selectedRatio}`})
            </div>
            <div className="functions-grid grid grid-cols-3 gap-2">
                 <div
                    className="function-card flex flex-col items-center justify-center p-3 rounded-lg border-2 bg-gray-700 border-gray-600 opacity-50 cursor-not-allowed"
                    title="The original aspect ratio is only available in Edit mode."
                >
                    <i className="fa-solid fa-image text-2xl text-gray-500"></i>
                    <div className="mt-1 text-xs font-semibold text-center">{t('ratioOriginal')}</div>
                    <div className="text-xs text-gray-400">{t('ratioOriginalSub')}</div>
                </div>

                {extendedPresets.map(preset => (
                    <div
                        key={preset.value}
                        className={`function-card flex flex-col items-center justify-center p-3 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
                            userSelection === preset.value
                                ? 'bg-purple-600 border-purple-400 text-white shadow-lg scale-105'
                                : 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
                        }`}
                        onClick={() => handlePresetClick(preset.value)}
                        role="button"
                        aria-pressed={userSelection === preset.value}
                        tabIndex={0}
                        title={!isSupported(preset.value) ? `${t('applied')}: ${findClosestSupportedRatio(preset.value)}` : `${t('aspectRatioTitle')}: ${preset.value}`}
                    >
                        <i className={`${preset.iconClassName} text-2xl text-gray-300`}></i>
                        <div className="mt-1 text-xs font-semibold text-center">{preset.label}</div>
                        <div className="text-xs text-gray-300">{preset.value}</div>
                    </div>
                ))}
            </div>
            
            <div className="mt-4">
                 <div className="section-title text-gray-400 font-semibold text-sm mb-2">{t('ratioCalculator')}</div>
                 <div className="grid grid-cols-2 gap-2 items-center">
                     <input 
                        type="number"
                        placeholder={t('widthPlaceholder')}
                        value={width}
                        onChange={(e) => setWidth(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-md p-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 transition"
                        aria-label="Width for ratio calculation"
                     />
                     <input 
                        type="number"
                        placeholder={t('heightPlaceholder')}
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-md p-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 transition"
                        aria-label="Height for ratio calculation"
                     />
                 </div>
                {calculatedRatio && (
                    <div className="mt-2 text-center bg-gray-700 p-2 rounded-lg">
                        <p className="text-sm text-gray-300">
                            {t('yourRatio')}: <span className="font-bold text-white">{calculatedRatio}</span>
                        </p>
                        <p className="text-sm text-purple-400">
                            {t('closestSupportedRatio')}: <span className="font-bold">{closestSupportedRatio}</span>
                        </p>
                    </div>
                )}

                 <button 
                    onClick={handleApplyCalculator}
                    disabled={!closestSupportedRatio}
                    className="mt-2 w-full text-center bg-gray-700 hover:bg-purple-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed p-2 rounded-md h-10 flex items-center justify-center transition-colors text-white font-semibold"
                 >
                    {closestSupportedRatio ? `${t('applyRatio')} ${closestSupportedRatio}` : t('fillDimensions')}
                 </button>
            </div>
        </div>
    );
};

export default AspectRatioSelector;