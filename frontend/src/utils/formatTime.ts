import i18n from '../i18n/config'

export function formatTimeAgo(dateString: string): string {
  const { t } = i18n
  const date = new Date(dateString)
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.round(diffMs / 60000)
  
  if (minutes < 1) return t('thread.justNow')
  if (minutes < 60) return `${minutes} ${t('home.minutes')} ${t('home.ago')}`
  
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours} ${hours > 1 ? t('home.hours') : t('home.hours')} ${t('home.ago')}`
  }
  
  const days = Math.round(hours / 24)
  if (days < 7) {
    return `${days} ${days > 1 ? t('home.days') : t('home.days')} ${t('home.ago')}`
  }
  
  const weeks = Math.round(days / 7)
  if (weeks < 4) {
    return `${weeks} ${weeks > 1 ? t('home.weeks') : t('home.weeks')} ${t('home.ago')}`
  }
  
  const months = Math.round(days / 30)
  if (months < 12) {
    return `${months} ${months > 1 ? t('home.months') : t('home.months')} ${t('home.ago')}`
  }
  
  const years = Math.round(days / 365)
  return `${years} ${years > 1 ? t('home.years') : t('home.years')} ${t('home.ago')}`
}

