import { useTranslation } from 'react-i18next'
import './Footer.css'

export function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div>
          <strong>{t('header.mahidolForum')}</strong>
          <p>Built for the Mahidol University community to share, learn, and grow.</p>
        </div>
        <div className="footer__links">
          <a href="https://mahidol.ac.th" target="_blank" rel="noreferrer">
            Mahidol University
          </a>
          <a href="mailto:forum@mahidol.ac.th">{t('footer.contact')}</a>
        </div>
      </div>
    </footer>
  )
}


