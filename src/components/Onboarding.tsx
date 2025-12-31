import React, { useState, useLayoutEffect, useCallback } from 'react';
import { useTranslations } from '../context/LanguageContext';
import { AppMode } from '../types';

interface OnboardingProps {
  onComplete: () => void;
  triggers: {
    switchToEditMode: () => void;
    switchToCreateMode: () => void;
  };
}

type OnboardingStep = {
  elementId?: string;
  titleKey: Parameters<ReturnType<typeof useTranslations>['t']>[0];
  contentKey: Parameters<ReturnType<typeof useTranslations>['t']>[0];
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'switchToCreate' | 'switchToEdit';
};


const Onboarding: React.FC<OnboardingProps> = ({ onComplete, triggers }) => {
  const { t } = useTranslations();
  const [stepIndex, setStepIndex] = useState(0);
  const [style, setStyle] = useState({});

  const steps: OnboardingStep[] = [
    { titleKey: 'onboardingWelcomeTitle', contentKey: 'onboardingWelcomeBody', tooltipPosition: 'center' },
    { elementId: 'prompt', titleKey: 'onboardingPromptTitle', contentKey: 'onboardingPromptBody', tooltipPosition: 'bottom' },
    { elementId: 'mode-toggle', titleKey: 'onboardingModeToggleTitle', contentKey: 'onboardingModeToggleBody', tooltipPosition: 'bottom' },
    { elementId: 'createFunctions', titleKey: 'onboardingCreateFunctionsTitle', contentKey: 'onboardingCreateFunctionsBody', tooltipPosition: 'bottom', action: 'switchToCreate' },
    { elementId: 'generateBtn', titleKey: 'onboardingGenerateTitle', contentKey: 'onboardingGenerateBody', tooltipPosition: 'top' },
    { elementId: 'mode-toggle', titleKey: 'onboardingSwitchToEditTitle', contentKey: 'onboardingSwitchToEditBody', tooltipPosition: 'bottom', action: 'switchToEdit'},
    { elementId: 'editFunctions', titleKey: 'onboardingEditFunctionsTitle', contentKey: 'onboardingEditFunctionsBody', tooltipPosition: 'top' },
    { elementId: 'uploadArea', titleKey: 'onboardingUploadTitle', contentKey: 'onboardingUploadBody', tooltipPosition: 'top' },
    { elementId: 'resultPanel', titleKey: 'onboardingResultPanelTitle', contentKey: 'onboardingResultPanelBody', tooltipPosition: 'left' },
    { titleKey: 'onboardingFinishTitle', contentKey: 'onboardingFinishBody', tooltipPosition: 'center' }
  ];

  const currentStep = steps[stepIndex];

  const updateHighlight = useCallback(() => {
    if (!currentStep) return;

    if (currentStep.action === 'switchToCreate') {
        triggers.switchToCreateMode();
    } else if (currentStep.action === 'switchToEdit') {
        triggers.switchToEditMode();
    }

    const element = currentStep.elementId ? document.getElementById(currentStep.elementId) : null;
    
    if (element) {
        element.classList.add('onboarding-highlight');
        const rect = element.getBoundingClientRect();
        setStyle({
            '--highlight-width': `${rect.width}px`,
            '--highlight-height': `${rect.height}px`,
            '--highlight-top': `${rect.top}px`,
            '--highlight-left': `${rect.left}px`,
        });
    } else {
        // Center modal for steps without an element
         setStyle({
            '--highlight-width': '0px',
            '--highlight-height': '0px',
            '--highlight-top': '50%',
            '--highlight-left': '50%',
        });
    }

    return () => {
        if (element) {
            element.classList.remove('onboarding-highlight');
        }
    };
  }, [stepIndex, currentStep, triggers]);

  useLayoutEffect(() => {
     // We need a slight delay for the app to switch modes and re-render
     const timeoutId = setTimeout(() => {
        const cleanup = updateHighlight();
        window.addEventListener('resize', updateHighlight);
        
        return () => {
            if (cleanup) cleanup();
            window.removeEventListener('resize', updateHighlight);
        };
    }, 100);

    return () => clearTimeout(timeoutId);

  }, [updateHighlight]);
  
  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };
  
  const getTooltipPosition = () => {
      const pos = { top: 'auto', bottom: 'auto', left: 'auto', right: 'auto', transform: '' };
      const offset = '1rem'; // 16px

      switch (currentStep.tooltipPosition) {
          case 'top':
              pos.bottom = `calc(100% - var(--highlight-top) + ${offset})`;
              pos.left = 'var(--highlight-left)';
              pos.transform = 'translateX(0)';
              break;
          case 'bottom':
              pos.top = `calc(var(--highlight-top) + var(--highlight-height) + ${offset})`;
              pos.left = 'var(--highlight-left)';
              pos.transform = 'translateX(0)';
              break;
          case 'left':
              pos.top = 'var(--highlight-top)';
              pos.right = `calc(100% - var(--highlight-left) + ${offset})`;
              pos.transform = 'translateY(0)';
              break;
          case 'right':
              pos.top = 'var(--highlight-top)';
              pos.left = `calc(var(--highlight-left) + var(--highlight-width) + ${offset})`;
              pos.transform = 'translateY(0)';
              break;
          case 'center':
              pos.top = '50%';
              pos.left = '50%';
              pos.transform = 'translate(-50%, -50%)';
              break;
      }
      return pos;
  }

  return (
    <div 
        className="fixed inset-0 z-[1000] bg-black bg-opacity-50"
        style={style as React.CSSProperties}
    >
      <div 
        className="absolute p-6 bg-gray-800 rounded-lg shadow-2xl text-white max-w-sm w-full transition-all duration-300"
        style={getTooltipPosition()}
        role="dialog"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
      >
        <h2 id="onboarding-title" className="text-xl font-bold text-purple-400 mb-2">{t(currentStep.titleKey)}</h2>
        <p id="onboarding-description" className="text-gray-300 mb-4">{t(currentStep.contentKey)}</p>
        <div className="flex justify-between items-center">
          <div>
            {stepIndex < steps.length - 1 && (
                <button onClick={onComplete} className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 hover:text-white transition-colors">{t('onboardingSkip')}</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
                <button onClick={handlePrev} className="px-4 py-2 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors">{t('onboardingPrevious')}</button>
            )}
            <button onClick={handleNext} className="px-4 py-2 bg-purple-600 rounded-md hover:bg-purple-700 transition-colors">
              {stepIndex === steps.length - 1 ? t('onboardingFinish') : t('onboardingNext')}
            </button>
          </div>
        </div>
        <div className="text-center mt-3 text-xs text-gray-500">
          {stepIndex + 1} / {steps.length}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;