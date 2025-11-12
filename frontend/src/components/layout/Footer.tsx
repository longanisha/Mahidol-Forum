import './Footer.css'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div>
          <strong>Mahidol Forum</strong>
          <p>Built for the Mahidol University community to share, learn, and grow.</p>
        </div>
        <div className="footer__links">
          <a href="https://mahidol.ac.th" target="_blank" rel="noreferrer">
            Mahidol University
          </a>
          <a href="mailto:forum@mahidol.ac.th">Contact Support</a>
        </div>
      </div>
    </footer>
  )
}


