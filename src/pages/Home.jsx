import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../DataContext';
import { useLang } from '../i18n';
import { useTheme } from '../utils/useTheme';
import { getDirectImageUrl, PLACEHOLDER_IMAGE } from '../utils';
import { getWhatsAppShareUrl, buildNoticeShareMessage, openShareUrl } from '../utils/reminder';
import samajMataImg from '../smjmata.jpg';
import '../styles/Home.css';

function AnimatedNumber({ value, duration = 1500 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = Math.max(0, Number(value) || 0);
    if (end === 0) {
      setCount(0);
      return;
    }
    // Cap increment time to a safe minimum (16ms ~ 1 frame) so very large
    // numbers don't lock up the UI with sub-millisecond intervals.
    const incrementTime = Math.max(16, duration / end);
    const step = Math.max(1, Math.ceil(end / (duration / incrementTime)));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        start = end;
        setCount(start);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, incrementTime);
    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{count.toLocaleString('en-IN')}</span>;
}

function ThemeLangToggle() {
  const { lang, setLang } = useLang();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="nav-toggle-wrapper">
      <div className="theme-lang-toggle" role="group" aria-label="Language toggle">
        <button
          type="button"
          className={lang === 'en' ? 'active' : ''}
          onClick={() => setLang('en')}
          aria-pressed={lang === 'en'}
          title="English"
        >
          EN
        </button>
        <button
          type="button"
          className={lang === 'hi' ? 'active' : ''}
          onClick={() => setLang('hi')}
          aria-pressed={lang === 'hi'}
          title="हिंदी"
        >
          हिं
        </button>
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        aria-label="Toggle theme"
        style={{
          background: 'rgba(212, 160, 23, 0.15)',
          border: '1px solid rgba(212, 160, 23, 0.3)',
          color: 'var(--gold)',
          padding: '4px 10px',
          borderRadius: '16px',
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'all 0.2s'
        }}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  );
}

function Home() {
  const { members, committee, settings, notifications, gallery } = useData();
  const { t } = useLang();
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
    return name.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase() || '?';
  };

  const handleShareNotice = (notif) => {
    const msg = buildNoticeShareMessage(notif);
    openShareUrl(getWhatsAppShareUrl(msg));
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
          <span>{t('offline.message')}</span>
        </div>
      )}
      <nav className={`home-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="home-nav-inner">
          <Link to="/" className="home-nav-logo">
            <span className="om-symbol-nav">ॐ</span>
            <span>SVAKS</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThemeLangToggle />
            <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
          <div className={`home-nav-links ${mobileMenuOpen ? 'open' : ''}`}>
            <a href="#home" onClick={() => setMobileMenuOpen(false)}>{t('nav.home')}</a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)}>{t('nav.about')}</a>
            <a href="#committee" onClick={() => setMobileMenuOpen(false)}>{t('nav.committee')}</a>
            <a href="#notifications" onClick={() => setMobileMenuOpen(false)}>{t('nav.notifications')}</a>
            <Link to="/admin-login" className="admin-nav-btn" onClick={() => setMobileMenuOpen(false)}>{t('nav.adminPanel')}</Link>
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
          <h1 className="hero-english-title">Somavamsha Aarya Kshthriya Samaj</h1>
          <p className="hero-subtitle">{t('hero.subtitle')}</p>
          <p className="hero-description">
            {t('hero.description')}
          </p>
          <div className="hero-actions">
            <a href="#about" className="btn-primary">
              {t('hero.learnMore')} ▼
            </a>
            <a href="#stats" className="btn-secondary" style={{ color: 'var(--gold-light)', borderColor: 'rgba(212,160,23,0.4)' }}>
              {t('hero.viewStats')} ▼
            </a>
          </div>
        </div>
      </section>

      <section className={`stats-section ${visibleSections.stats ? 'visible' : ''}`} id="stats">
        <div className="section-header-center">
          <span className="ancient-label">{t('stats.title')}</span>
          <h2>{t('stats.heading')}</h2>
        </div>
        <div className="stats-grid" style={{ justifyContent: 'center' }}>
          <div className="stat-card premium-stat" style={{ minWidth: '220px' }}>
            <div className="stat-icon-wrapper">👨‍👩‍👧‍👦</div>
            <span className="stat-number"><AnimatedNumber value={members.length} /></span>
            <span className="stat-label">{t('stats.totalFamilies')}</span>
            <div className="stat-shine"></div>
          </div>
        </div>
      </section>

      <section className={`notifications-section ${visibleSections.notifications ? 'visible' : ''}`} id="notifications">
        <div className="notification-board">
          <div className="notification-header">
            <span className="om-mini">📜</span>
            <h3>{t('notice.title')} <span className="live-indicator"></span></h3>
            <span className="om-mini">📜</span>
          </div>
          <div className="notification-content">
            {activeNotifs.length > 0 ? (
              activeNotifs.map((notif, i) => (
                <div key={notif.id} className="notification-card" style={{ animationDelay: `${i * 0.1}s` }}>
                  <span className="notification-badge">{notif.title}</span>
                  <p>{notif.text}</p>
                  <span className="notification-date">{notif.date}</span>
                  <div className="notice-share-row">
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📢 {t('notice.share')}</span>
                    <button
                      className="notice-share-btn"
                      onClick={() => handleShareNotice(notif)}
                      title={t('notice.share')}
                    >
                      💬 WhatsApp
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="notification-empty">{t('notice.empty')}</div>
            )}
          </div>
          <div className="notification-border"></div>
        </div>
      </section>

      <section className={`about-section ${visibleSections.about ? 'visible' : ''}`} id="about">
        <div className="section-header">
          <span className="ancient-label" style={{ color: 'var(--saffron)' }}>{t('about.label')}</span>
          <h2>{t('about.heading')}</h2>
          <p>{t('about.subheading')}</p>
        </div>
        <div className="about-grid">
          <div className="about-card dharmik-card">
            <div className="card-om">ॐ</div>
            <span className="card-icon">🕉️</span>
            <h3>{t('about.dharma.title')}</h3>
            <p>{t('about.dharma.desc')}</p>
          </div>
          <div className="about-card dharmik-card">
            <div className="card-om">ॐ</div>
            <span className="card-icon">🤝</span>
            <h3>{t('about.support.title')}</h3>
            <p>{t('about.support.desc')}</p>
          </div>
          <div className="about-card dharmik-card">
            <div className="card-om">ॐ</div>
            <span className="card-icon">📚</span>
            <h3>{t('about.education.title')}</h3>
            <p>{t('about.education.desc')}</p>
          </div>
          <div className="about-card dharmik-card">
            <div className="card-om">ॐ</div>
            <span className="card-icon">🏛️</span>
            <h3>{t('about.organization.title')}</h3>
            <p>{t('about.organization.desc')}</p>
          </div>
          <div className="about-card dharmik-card">
            <div className="card-om">ॐ</div>
            <span className="card-icon">🙏</span>
            <h3>{t('about.service.title')}</h3>
            <p>{t('about.service.desc')}</p>
          </div>
          <div className="about-card dharmik-card">
            <div className="card-om">ॐ</div>
            <span className="card-icon">🎉</span>
            <h3>{t('about.festivals.title')}</h3>
            <p>{t('about.festivals.desc')}</p>
          </div>
        </div>
      </section>

      <section className={`committee-section ${visibleSections.committee ? 'visible' : ''}`} id="committee">
        <div className="section-header">
          <span className="ancient-label">{t('committee.label')}</span>
          <h2>{t('committee.heading')}</h2>
          <p>{t('committee.subheading')}</p>
        </div>
        <div className="committee-grid">
          {committee.map((member) => {
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
                    <span style={{ color: '#999', fontSize: '13px' }}>{t('committee.addPhone')}</span>
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
          <span className="ancient-label">{t('gallery.label')}</span>
          <h2>{t('gallery.heading')}</h2>
          <p>{t('gallery.subheading')}</p>
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
            <p>{t('gallery.empty')}</p>
          </div>
        )}

        {gallery && gallery.some(album => album.photos && album.photos.length > 0) && (
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <a href="#gallery" className="btn-secondary" style={{ padding: '12px 24px', display: 'inline-block' }}>
              {t('gallery.viewAll')} ↑
            </a>
          </div>
        )}
      </section>

      <section className={`info-section ${visibleSections.info ? 'visible' : ''}`} id="info">
        <div className="info-section-bg"></div>
        <div className="info-container">
          <div className="info-temple">
            <div className="temple-icon">🛕</div>
            <h3>{t('info.temple.title')}</h3>
            <p>{t('info.temple.desc')}</p>
          </div>
          <div className="info-matrimony">
            <div className="matrimony-icon">💑</div>
            <h3>{t('info.matrimony.title')}</h3>
            <p>{t('info.matrimony.desc')}</p>
          </div>
          <div className="info-education">
            <div className="education-icon">🎓</div>
            <h3>{t('info.education.title')}</h3>
            <p>{t('info.education.desc')}</p>
          </div>
          <div className="info-medical">
            <div className="medical-icon">🏥</div>
            <h3>{t('info.medical.title')}</h3>
            <p>{t('info.medical.desc')}</p>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="footer-om">ॐ</div>
        <p>© 2026 {settings.appName || 'Somavamsha Aarya Kshthriya Samaj'}, {settings.location || 'Yadgir'} | <Link to="/admin-login">{t('nav.adminPanel')}</Link></p>
        <p className="footer-mantra">{t('footer.mantra')}</p>
      </footer>
    </div>
  );
}

export default Home;
