import { useTranslation } from 'react-i18next'
import './HeroSection.css'

export function HeroSection() {
  const { t } = useTranslation()
  return (
    <section className="hero">
      <div className="hero__content">
        <span className="hero__eyebrow">{t('hero.welcome')}</span>
        <h1>{t('hero.title')}</h1>
        <p>
          {t('hero.description')}
        </p>
        <div className="hero__actions">
          <a href="#threads" className="hero__action hero__action--primary">
            {t('hero.exploreDiscussions')}
          </a>
          <a href="/register" className="hero__action">
            {t('hero.createAccount')}
          </a>
        </div>
      </div>

      <div className="hero__card" aria-hidden="true">
        <div className="hero__card-body">
          <div>
            <strong>{t('hero.trendingToday')}</strong>
            <p>Graduate Research Showcase · Sustainability in Bangkok · MU Health Week</p>
          </div>
          <div className="hero__card-footer">
            <span>+96 {t('hero.activeMembers')}</span>
            <span>12 {t('hero.newThreads')}</span>
          </div>
        </div>
      </div>
    </section>
  )
}


