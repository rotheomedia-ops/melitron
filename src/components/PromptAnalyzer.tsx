import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslations } from '../context/LanguageContext';
import { suggestBetterPrompt } from '../services/geminiService';
import { FORBIDDEN_WORDS } from '../utils';

interface PromptAnalyzerProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  id?: string;
}

const PromptAnalyzer: React.FC<PromptAnalyzerProps> = ({ value, onChange, placeholder, rows = 4, disabled, id }) => {
  const { language, t } = useTranslations();
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [violatingWords, setViolatingWords] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const highlightedText = useMemo(() => {
    if (violatingWords.length === 0) {
      return value;
    }
    const regex = new RegExp(`\\b(${violatingWords.join('|')})\\b`, 'gi');
    return value.replace(regex, (match) => `<mark class="bg-red-500/50 text-red-100 rounded">${match}</mark>`);
  }, [value, violatingWords]);

  useEffect(() => {
    const checkPrompt = () => {
      if (!value) return false;
      const foundWords = FORBIDDEN_WORDS.filter(word => 
        new RegExp(`\\b${word}\\b`, 'i').test(value)
      );
      setViolatingWords(foundWords);
      return foundWords.length > 0;
    };

    const timeoutId = setTimeout(async () => {
      if (value.trim() !== '' && checkPrompt()) {
        setIsLoading(true);
        setError(null);
        setSuggestion(null);
        try {
          const newSuggestion = await suggestBetterPrompt(value, language);
          setSuggestion(newSuggestion);
        } catch (e: any) {
          setError(e.message || t('promptSuggestionError'));
        } finally {
          setIsLoading(false);
        }
      } else {
        setSuggestion(null);
        setError(null);
        setIsLoading(false);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [value, language, t]);

  const useSuggestion = () => {
    if (suggestion) {
      const syntheticEvent = {
        target: { value: suggestion }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      onChange(syntheticEvent);
      setSuggestion(null);
      setViolatingWords([]);
    }
  };

  const hasIssue = violatingWords.length > 0;
  const showSuggestionBox = isLoading || error || suggestion;
  const baseClasses = `prompt-input w-full rounded-md p-3 transition duration-200`;
  const textStyles = `whitespace-pre-wrap break-words`;
  
  return (
    <div className="relative w-full">
      <div className="relative">
        <div 
          ref={backdropRef}
          className={`${baseClasses} ${textStyles} absolute inset-0 bg-transparent border border-transparent overflow-y-auto pointer-events-none`}
          style={{ minHeight: `${rows * 1.5 + 1.5}rem` }}
          dangerouslySetInnerHTML={{ __html: highlightedText + '\n' }}
        />
        <textarea
          id={id}
          ref={textareaRef}
          className={`${baseClasses} ${textStyles} bg-gray-700 border focus:ring-2 caret-white text-transparent 
            ${hasIssue ? 'border-red-500/80 focus:ring-red-500' : 'border-gray-600 focus:ring-purple-500'}
            ${disabled ? 'bg-gray-600 cursor-not-allowed' : ''}
          `}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onScroll={handleScroll}
          rows={rows}
          disabled={disabled}
        />
      </div>

      {showSuggestionBox && (
        <div className="mt-2 p-3 bg-gray-700 border border-gray-600 rounded-lg animate-fade-in">
          {isLoading && <p className="text-sm text-yellow-400">{t('suggestionLoading')}</p>}
          {error && <p className="text-sm text-red-400">{t('errorTitle')}: {error}</p>}
          {suggestion && (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-1">{t('suggestedPromptTitle')}</h4>
              <p className="text-sm text-green-300 bg-gray-800 p-2 rounded">{suggestion}</p>
              <button 
                onClick={useSuggestion}
                className="mt-2 w-full text-center bg-purple-600 hover:bg-purple-700 p-2 rounded-md text-sm text-white font-semibold transition-colors"
              >
                {t('useSuggestion')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PromptAnalyzer;