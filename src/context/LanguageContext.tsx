import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Language } from '../types';
import * as ptTranslations from '../locales/pt';
import * as enTranslations from '../locales/en';

type Translations = typeof ptTranslations.default;
type TranslationKey = keyof Translations;

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  // FIX: Updated the 't' function signature to accept a second argument for substitutions.
  t: (key: TranslationKey, substitutions?: Record<string, string | number>) => string;
}

const translations = { pt: ptTranslations.default, en: enTranslations.default };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('pt');

  useEffect(() => {
    document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
  }, [language]);

  // FIX: Updated the 't' function to handle placeholder substitutions, resolving a TypeScript error.
  const t = (key: TranslationKey, substitutions?: Record<string, string | number>): string => {
    // Fallback chain: selected language -> English -> key
    let translation = translations[language][key] || translations['en'][key] || key;
    
    if (substitutions) {
        Object.entries(substitutions).forEach(([subKey, value]) => {
            translation = translation.replace(new RegExp(`\\{${subKey}\\}`, 'g'), String(value));
        });
    }

    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslations = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslations must be used within a LanguageProvider');
  }
  return context;
};
