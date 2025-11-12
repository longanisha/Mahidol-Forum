import './HeroSection.css'

export function HeroSection() {
  return (
    <section className="hero">
      <div className="hero__content">
        <span className="hero__eyebrow">Welcome to Mahidol Forum</span>
        <h1>Where ideas find peers and actions</h1>
        <p>
          Discover campus stories, research breakthroughs, student-led initiatives, and curated events.
          Join in with questions, advice, and support from the Mahidol family.
        </p>
        <div className="hero__actions">
          <a href="#threads" className="hero__action hero__action--primary">
            Explore discussions
          </a>
          <a href="/register" className="hero__action">
            Create account
          </a>
        </div>
      </div>

      <div className="hero__card" aria-hidden="true">
        <div className="hero__card-body">
          <div>
            <strong>Trending today</strong>
            <p>Graduate Research Showcase · Sustainability in Bangkok · MU Health Week</p>
          </div>
          <div className="hero__card-footer">
            <span>+96 active members</span>
            <span>12 new threads</span>
          </div>
        </div>
      </div>
    </section>
  )
}


