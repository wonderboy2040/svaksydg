import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../DataContext';
import { getDirectImageUrl, PLACEHOLDER_IMAGE } from '../utils';
import samajMataImg from '../smjmata.jpg';
import '../styles/Home.css';

function AnimatedNumber({ value, duration = 1500 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const incrementTime = duration / Math.max(end, 1);
    const timer = setInterval(() => {
      start++;
      setCount(start);
      if (start >= end) clearInterval(timer);
    }, incrementTime > 0 ? incrementTime : 10);
    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{count.toLocaleString('en-IN')}</span>;
}

function Home() {
  const { members, collections, expenditure, committee, settings, notifications, gallery, syncStatus } = useData();
  const [visibleSections, setVisibleSections] = useState({});
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const activeNotifs = notifications.filter(n => n.active);

  const totalCollections = collections.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const totalExpenditure = expenditure.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const balance = totalCollections - totalExpenditure;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
      const sections = ['home', 'stats', 'about', 'committee', 'gallery', 'notifications', 'info'];
      sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.85) {
            setVisibleSections(prev => ({ ...prev, [id]: true }));
          }
        }
      });
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div style={{ background: 'var(--bg)' }}>
      {/* Offline Indicator */}
      {!isOnline && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(90deg, #E17055, #D63031)',
          color: 'white',
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: '13px',
          fontFamily: 'Inter, sans-serif',
          zIndex: 100000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <span>📡</span>
          <span>You are offline. Changes will be saved locally.</span>
        </div>
      )}
      <nav className={`home-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="home-nav-inner">
          <Link to="/" className="home-nav-logo">
            <span className="om-symbol-nav">ॐ</span>
            <span>SVAKS</span>
          </Link>
          <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
          <div className={`home-nav-links ${mobileMenuOpen ? 'open' : ''}`}>
            <a href="#home" onClick={() => setMobileMenuOpen(false)}>Home</a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)}>About</a>
            <a href="#committee" onClick={() => setMobileMenuOpen(false)}>Committee</a>
            <a href="#notifications" onClick={() => setMobileMenuOpen(false)}>Notifications</a>
            <Link to="/admin-login" className="admin-nav-btn" onClick={() => setMobileMenuOpen(false)}>Admin Panel</Link>
          </div>
        </div>
      </nav>

      <section className="hero-section" id="home">
        <div className="hero-bg-image"></div>
        <div className="hero-bg-overlay"></div>
        <div className="hero-glow"></div>
        <div className="hero-pattern"></div>
        <div className="mandal-bg"></div>
        <div className="diya-container">
          <div className="diya"></div>
          <div className="diya-light"></div>
        </div>
        <div className="particles-container">
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className="particle"></div>
          ))}
        </div>
        <div className="hero-border">
          <div className="corner-ornament top-left"></div>
          <div className="corner-ornament top-right"></div>
          <div className="corner-ornament bottom-left"></div>
          <div className="corner-ornament bottom-right"></div>
        </div>
        <div className="hero-content">
          <div className="hero-avatar-frame">
            <div className="hero-avatar-glow"></div>
            <div className="hero-avatar-border">
              <img src={samajMataImg} alt="Samaj Mata" className="hero-avatar-img" />
            </div>
          </div>
          <h1 className="hero-english-title">Soma Vamshi Aarya Kshthriya Samaj</h1>
          <p className="hero-subtitle">YADGIR • KARNATAKA</p>
          <p className="hero-description">
            "Our society is built on the foundation of unity, dharma and brotherhood.
            Through collective organization, cooperation and welfare, we build a strong community."
          </p>
          <div className="hero-actions">
            <a href="#about" className="btn-primary">
              Learn More ▼
            </a>
            <a href="#stats" className="btn-secondary" style={{ color: 'var(--gold-light)', borderColor: 'rgba(212,160,23,0.4)' }}>
              View Stats ▼
            </a>
          </div>
        </div>
      </section>

      <section className={`stats-section ${visibleSections.stats ? 'visible' : ''}`} id="stats">
        <div className="section-header-center">
          <span className="ancient-label">SAMAJ STATISTICS</span>
          <h2>Samaj Overview</h2>
        </div>
        <div className="stats-grid" style={{ justifyContent: 'center' }}>
          <div className="stat-card premium-stat" style={{ minWidth: '220px' }}>
            <div className="stat-icon-wrapper">👨‍👩‍👧‍👦</div>
            <span className="stat-number"><AnimatedNumber value={members.length} /></span>
            <span className="stat-label">Total Families</span>
            <div className="stat-shine"></div>
          </div>
        </div>
      </section>

      <section className={`notifications-section ${visibleSections.notifications ? 'visible' : ''}`} id="notifications">
        <div className="notification-board">
          <div className="notification-header">
            <span className="om-mini">📜</span>
            <h3>Notice Board <span className="live-indicator"></span></h3>
            <span className="om-mini">📜</span>
          </div>
          <div className="notification-content">
            {activeNotifs.length > 0 ? (
              activeNotifs.map((notif, i) => (
                <div key={notif.id} className="notification-card" style={{ animationDelay: `${i * 0.1}s` }}>
                  <span className="notification-badge">{notif.title}</span>
                  <p>{notif.text}</p>
                  <span className="notification-date">{notif.date}</span>
                </div>
              ))
            ) : (
              <div className="notification-empty">No notices to display</div>
            )}
          </div>
          <div className="notification-border"></div>
        </div>
      </section>

      <section className={`about-section ${visibleSections.about ? 'visible' : ''}`} id="about">
        <div className="section-header">
          <span className="ancient-label" style={{ color: 'var(--saffron)' }}>ABOUT US</span>
          <h2>Samaj Mission</h2>
          <p>Our main objectives and values</p>
        </div>
        <div className="about-grid">
          <div className="about-card dharmik-card">
            <div className="card-om">ॐ</div>
            <span className="card-icon">🕉️</span>
            <h3>Dharma & Culture</h3>
            <p>Protection of ancient Sanatan Dharma, preservation of cultural traditions and passing them to future generations.</p>
          </div>
          <div className="about-card dharmik-card">
            <div className="card-om">ॐ</div>
            <span className="card-icon">🤝</span>
            <h3>Collective Support</h3>
            <p>Every member's monthly contribution helps in samaj development and helping needy members. Unity is strength.</p>
          </div>
          <div className="about-card dharmik-card">
            <div className="card-om">ॐ</div>
            <span className="card-icon">📚</span>
            <h3>Education & Knowledge</h3>
            <p>Promoting education for samaj children, identifying talent and helping them succeed in life.</p>
          </div>
          <div className="about-card dharmik-card">
            <div className="card-om">ॐ</div>
            <span className="card-icon">🏛️</span>
            <h3>Samaj Organization</h3>
            <p>Managing samaj with unity and transparency, organizing annual meetings and cultural programs.</p>
          </div>
          <div className="about-card dharmik-card">
            <div className="card-om">ॐ</div>
            <span className="card-icon">🙏</span>
            <h3>Service & Sacrifice</h3>
            <p>Support for elderly and children, help during illness, and volunteers contribution in social programs.</p>
          </div>
          <div className="about-card dharmik-card">
            <div className="card-om">ॐ</div>
            <span className="card-icon">🎉</span>
            <h3>Festivals & Celebrations</h3>
            <p>Celebrating Navratri, Diwali, Holi and other religious festivals collectively, organizing community programs.</p>
          </div>
        </div>
      </section>

      <section className={`committee-section ${visibleSections.committee ? 'visible' : ''}`} id="committee">
        <div className="section-header">
          <span className="ancient-label">OUR TEAM</span>
          <h2>Samaj Committee</h2>
          <p>Meet the people who lead our samaj</p>
        </div>
        <div className="committee-grid">
          {committee.map((member, idx) => {
            const initials = getInitials(member.name || member.position);
            const hasName = member.name && member.name.trim() !== '';
            const hasPhoto = member.photo && member.photo.trim() !== '';
            const imgSrc = hasPhoto ? getDirectImageUrl(member.photo) : '';
            return (
              <div className="committee-card" key={member.id}>
                {hasPhoto && imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={member.name || member.position}
                    className="committee-avatar"
                    loading="lazy"
                    onError={(e) => {
                      console.warn('[SVAKS] Image failed:', member.photo, '→', imgSrc);
                      e.target.onerror = null;
                      e.target.src = PLACEHOLDER_IMAGE;
                    }}
                  />
                ) : (
                  <div className="committee-avatar-initials">{initials}</div>
                )}
                {hasName && (
                  <div className="committee-name">{member.name}</div>
                )}
                <div className="committee-designation">{member.position}</div>
                <div className="committee-phone">
                  {member.phone ? (
                    <a href={`tel:${member.phone}`}>{member.phone}</a>
                  ) : (
                    <span style={{ color: '#999', fontSize: '13px' }}>Add phone via admin</span>
                  )}
                </div>
                {member.address && (
                  <div style={{ color: '#999', fontSize: '12px', marginTop: '4px' }}>{member.address}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Gallery Section */}
      <section className={`gallery-section ${visibleSections.gallery ? 'visible' : ''}`} id="gallery">
        <div className="section-header">
          <span className="ancient-label">GALLERY</span>
          <h2>Samaj Events Gallery</h2>
          <p>Photos from our community celebrations and programs</p>
        </div>

        {gallery && gallery.length > 0 ? (
          <div className="gallery-grid">
            {gallery.filter(album => album.photos && album.photos.length > 0).slice(0, 6).map(album => (
              <div key={album.id} className="gallery-album-card">
                <div className="gallery-album-cover">
                  {album.photos && album.photos[0] ? (
                    <img
                      src={getDirectImageUrl(album.photos[0].url)}
                      alt={album.title}
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                  ) : null}
                  <div className="gallery-album-placeholder" style={{ display: album.photos && album.photos[0] ? 'none' : 'flex' }}>
                    📸
                  </div>
                  <div className="gallery-album-overlay">
                    <span className="photo-count">{album.photos?.length || 0} 📷</span>
                  </div>
                </div>
                <div className="gallery-album-info">
                  <h4>{album.title}</h4>
                  <span>{album.date}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="gallery-empty">
            <span style={{ fontSize: '48px' }}>📸</span>
            <p>No event photos yet. Add photos from Admin panel!</p>
          </div>
        )}

        {gallery && gallery.some(album => album.photos && album.photos.length > 0) && (
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <a href="#committee" className="btn-secondary" style={{ padding: '12px 24px', display: 'inline-block' }}>
              View All Albums →
            </a>
          </div>
        )}
      </section>

      <section className={`info-section ${visibleSections.info ? 'visible' : ''}`} id="info">
        <div className="info-section-bg"></div>
        <div className="info-container">
          <div className="info-temple">
            <div className="temple-icon">🛕</div>
            <h3>Temple & Puja</h3>
            <p>Collective puja programs and festival arrangements</p>
          </div>
          <div className="info-matrimony">
            <div className="matrimony-icon">💑</div>
            <h3>Matrimony</h3>
            <p>Finding suitable match for sons and daughters</p>
          </div>
          <div className="info-education">
            <div className="education-icon">🎓</div>
            <h3>Education Aid</h3>
            <p>Scholarships for economically weaker students</p>
          </div>
          <div className="info-medical">
            <div className="medical-icon">🏥</div>
            <h3>Medical Help</h3>
            <p>Assistance for treatment of poor patients</p>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="footer-om">ॐ</div>
        <p>© 2026 {settings.appName || 'Soma Vamshi Aarya Kshthriya Samaj'}, {settings.location || 'Yadgir'} | <Link to="/admin-login">Admin Panel</Link></p>
        <p className="footer-mantra">ॐ Sarve Bhavantu Sukhinah • Sarve Santu Niramayah</p>
      </footer>
    </div>
  );
}

export default Home;