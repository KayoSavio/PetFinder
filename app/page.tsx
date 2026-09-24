import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="hero" style={{ paddingBottom: 'var(--space-2xl)' }}>
        <div className="hero-logo" style={{
          background: 'var(--bg-brand-soft)',
          color: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3.5rem',
          width: '100px',
          height: '100px',
          borderRadius: 'var(--radius-xl)',
          margin: '0 auto var(--space-xl)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          🐾
        </div>
        <h1 className="hero-title">
          <span className="text-gradient">Encontre</span> seu pet.<br />
          <span style={{ color: 'var(--text-primary)' }}>Reúna famílias.</span>
        </h1>
        <p className="hero-subtitle">
          Plataforma colaborativa com mapa em tempo real para ajudar a encontrar animais perdidos. Publique, aviste, busque — juntos somos mais fortes.
        </p>
        <div className="hero-actions">
          <Link href="/posts/new" className="btn btn-primary btn-lg">
            ➕ Publicar Pet
          </Link>
          <Link href="/map" className="btn btn-secondary btn-lg">
            🗺️ Abrir Mapa
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-bar">
        <div className="stat-item">
          <div className="stat-value">2.4K+</div>
          <div className="stat-label">Pets Reencontrados</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">15K+</div>
          <div className="stat-label">Avistamentos</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">8K+</div>
          <div className="stat-label">Voluntários</div>
        </div>
      </section>

      {/* Features */}
      <section className="page-content" style={{ marginTop: 'var(--space-2xl)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>Como funciona</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>Ferramentas criadas para maximizar as chances de um reencontro feliz.</p>
        </div>

        <div className="features-grid">
          <div className="glass-card feature-card">
            <div className="feature-icon" style={{ background: 'var(--bg-brand-soft)', color: 'var(--color-primary-dark)' }}>📍</div>
            <h3 className="feature-title">Mapa em Tempo Real</h3>
            <p className="feature-desc">
              Veja pets perdidos e encontrados na sua região com pins interativos e busca por proximidade.
            </p>
          </div>
          <div className="glass-card feature-card">
            <div className="feature-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>👁️</div>
            <h3 className="feature-title">Avistamentos (IA)</h3>
            <p className="feature-desc">
              Viu um animal? Registre foto e local. Nossa IA compara com pets perdidos automaticamente.
            </p>
          </div>
          <div className="glass-card feature-card">
            <div className="feature-icon" style={{ background: '#fefce8', color: '#ca8a04' }}>🔔</div>
            <h3 className="feature-title">Alertas Inteligentes</h3>
            <p className="feature-desc">
              Configure alertas para ser notificado imediatamente quando um pet cruzar a sua área.
            </p>
          </div>
          <div className="glass-card feature-card">
            <div className="feature-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>📱</div>
            <h3 className="feature-title">Contato Direto</h3>
            <p className="feature-desc">
              Comunicação direta via WhatsApp com quem publicou. Sem intermediários ou demoras.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        textAlign: 'center',
        padding: 'var(--space-3xl) var(--space-lg)',
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border-subtle)',
        marginTop: 'var(--space-2xl)'
      }}>
        <div style={{ margin: '0 auto', maxWidth: '600px' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: 'var(--space-md)' }}>
            Pronto para ajudar? <span className="text-gradient">Comece agora.</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', fontSize: '1.125rem' }}>
            Sem fins lucrativos. Sem anúncios. Apenas uma comunidade unida para trazer pets de volta para casa.
          </p>
          <Link href="/posts/new" className="btn btn-primary btn-lg">
            Publicar Pet Perdido ou Encontrado
          </Link>
        </div>
      </section>
    </>
  );
}
