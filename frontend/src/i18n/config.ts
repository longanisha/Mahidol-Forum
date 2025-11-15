import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enTranslations from './locales/en.json'
import zhTranslations from './locales/zh.json'
import thTranslations from './locales/th.json'

i18n
  .use(LanguageDetector) // 检测用户浏览器语言
  .use(initReactI18next) // 将 i18n 传递给 react-i18next
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
      zh: {
        translation: zhTranslations,
      },
      th: {
        translation: thTranslations,
      },
    },
    fallbackLng: 'en', // 默认语言
    debug: false,
    interpolation: {
      escapeValue: false, // React 已经转义了
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n

