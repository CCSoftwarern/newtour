/* ==========================================
   NEWTOUR - Site Público
   Dados dinâmicos via Xano API
   ========================================== */

// =============================================
// XANO CLIENT (mesma config do admin)
// =============================================
const CONFIG_KEY = 'newtour_admin_config';

function getConfig() {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) return JSON.parse(saved);
    return { apiUrl: '', apiKey: '' };
}

async function xanoFetch(endpoint) {
    const config = getConfig();
    if (!config.apiUrl) return null;

    const url = config.apiUrl.replace(/\/+$/, '') + '/' + endpoint;
    const headers = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers['Authorization'] = config.apiKey;

    try {
        const res = await fetch(url, { headers });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

// =============================================
// DOM READY
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    initHeader();
    initMobileMenu();
    initActiveNav();
    initSearch();
    initForms();
    initScrollAnimations();

    // Carrega dados do Xano e preenche o site
    await loadBanners();
    await Promise.all([loadDestinos(), loadPromocoes(), loadEmpresa()]);
});

// =============================================
// HEADER SCROLL
// =============================================
function initHeader() {
    const header = document.getElementById('header');
    const backToTop = document.getElementById('backToTop');

    const handleScroll = () => {
        header.classList.toggle('scrolled', window.scrollY > 50);
        backToTop.classList.toggle('visible', window.scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
}

// =============================================
// MOBILE MENU
// =============================================
function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.getElementById('nav');

    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        nav.classList.toggle('active');
        document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
    });

    nav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            nav.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
}

// =============================================
// ACTIVE NAV ON SCROLL
// =============================================
function initActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY + 150;
        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.getAttribute('id');
            if (scrollY >= top && scrollY < top + height) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) link.classList.add('active');
                });
            }
        });
    });
}

// =============================================
// BANNERS → HERO SLIDER
// =============================================
async function loadBanners() {
    const banners = await xanoFetch('banner');
    if (!banners || banners.length === 0) return;

    const now = new Date().toISOString().slice(0, 10);
    const active = banners
        .filter(b => b.ativa)
        .filter(b => {
            if (b.data_inicio && b.data_inicio > now) return false;
            if (b.data_fim && b.data_fim < now) return false;
            return true;
        })
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    if (active.length === 0) return;

    const slider = document.getElementById('heroSlider');
    if (!slider) return;

    slider.innerHTML = active.map((b, i) => `
        <div class="hero-slide ${i === 0 ? 'active' : ''}"
             style="background-image: url('${b.imagem_url}');"
             ${b.link ? `onclick="window.open('${b.link}','_self')"` : ''}>
        </div>
    `).join('');

    // Reinicia o slider automático
    startHeroSlider();
}

function startHeroSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length <= 1) return;

    let current = 0;
    setInterval(() => {
        slides[current].classList.remove('active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('active');
    }, 5000);
}

// =============================================
// DESTINOS → Grid dinâmico
// =============================================
async function loadDestinos() {
    const destinos = await xanoFetch('destino');
    const grid = document.getElementById('destinosGrid');
    if (!grid) return;

    if (!destinos || destinos.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:40px; color:#64748b;">
                <i class="fas fa-map-marked-alt" style="font-size:2rem; margin-bottom:10px; display:block; color:#cbd5e1;"></i>
                Cadastre seus destinos no painel administrativo
            </div>`;
        return;
    }

    const ativos = destinos
        .filter(d => d.ativa)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    grid.innerHTML = ativos.map(d => `
        <div class="destino-card" data-category="${d.categoria || 'internacional'}">
            <div class="destino-image">
                <img src="${d.imagem_url || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80'}" alt="${d.nome || ''}" loading="lazy">
                <div class="destino-overlay">
                    <span class="destino-badge">${d.tag || d.categoria || 'Destino'}</span>
                </div>
                <div class="destino-fav">
                    <i class="far fa-heart"></i>
                </div>
            </div>
            <div class="destino-info">
                <div class="destino-location">
                    <i class="fas fa-map-marker-alt"></i> ${d.localizacao || ''}
                </div>
                <h3>${d.nome || ''}</h3>
                <div class="destino-meta">
                    <span><i class="fas fa-clock"></i> ${d.duracao_dias || '?'} dias</span>
                    <span><i class="fas fa-star"></i> ${d.avaliacao || '4.5'}</span>
                </div>
                <div class="destino-footer">
                    <div class="destino-price">
                        <span>A partir de</span>
                        <strong>R$ ${formatPrice(d.preco)}</strong>
                    </div>
                    <a href="#contato" class="btn btn-primary btn-sm">Ver Pacote</a>
                </div>
            </div>
        </div>
    `).join('');

    // Atualiza stats do hero
    const statEl = document.getElementById('statDestinosHero');
    if (statEl) statEl.textContent = ativos.length + '+';

    // Preenche footer
    const footerList = document.getElementById('footerDestinos');
    if (footerList) {
        const top5 = ativos.slice(0, 5);
        footerList.innerHTML = top5.map(d =>
            `<li><a href="#destinos">${d.nome}</a></li>`
        ).join('');
    }

    // Reativa favoritos e scroll anim
    initFavorites();
    initScrollAnimations();
}

// =============================================
// PROMOÇÕES → Banner dinâmico
// =============================================
let promoCountdownDate = null;

async function loadPromocoes() {
    const promos = await xanoFetch('promocao');
    if (!promos || promos.length === 0) return;

    const now = new Date().toISOString().slice(0, 10);
    const ativas = promos
        .filter(p => p.ativa)
        .filter(p => {
            if (p.data_fim && p.data_fim < now) return false;
            return true;
        })
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    if (ativas.length === 0) return;

    const p = ativas[0]; // Primeira promoção ativa

    // Preenche o banner de promoção
    const badge = document.getElementById('promoBadge');
    const title = document.getElementById('promoTitle');
    const desc = document.getElementById('promoDesc');
    const btn = document.getElementById('promoBtn');
    const image = document.getElementById('promoImage');
    const countdown = document.getElementById('countdown');

    if (badge) badge.textContent = `${p.desconto_percentual || 0}% OFF`;
    if (title) title.innerHTML = `${p.titulo || 'Oferta Especial'}<br><span class="accent">${p.destino || ''}</span>`;
    if (desc) desc.textContent = p.descricao || `Aproveite esta promoção imperdível em ${p.destino || 'destino incrível'}.`;
    if (btn) btn.innerHTML = `<i class="fas fa-tag"></i> Ver por R$ ${formatPrice(p.preco_desconto)}`;
    if (image && p.imagem_url) {
        image.innerHTML = `<img src="${p.imagem_url}" alt="${p.titulo || 'Promoção'}">`;
    }

    // Countdown para data_fim
    if (countdown && p.data_fim) {
        promoCountdownDate = new Date(p.data_fim + 'T23:59:59');
        countdown.style.display = 'flex';
        startCountdown();
    }
}

function startCountdown() {
    const update = () => {
        if (!promoCountdownDate) return;
        const distance = promoCountdownDate.getTime() - Date.now();

        if (distance <= 0) return;

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = String(val).padStart(2, '0');
        };

        set('days', days);
        set('hours', hours);
        set('minutes', minutes);
        set('seconds', seconds);
    };

    update();
    setInterval(update, 1000);
}

// =============================================
// FAVORITES
// =============================================
function initFavorites() {
    document.querySelectorAll('.destino-fav').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const icon = btn.querySelector('i');
            icon.classList.toggle('far');
            icon.classList.toggle('fas');
            btn.style.background = icon.classList.contains('fas') ? '#ef4444' : 'rgba(255,255,255,0.9)';
            btn.style.color = icon.classList.contains('fas') ? '#fff' : '#64748b';
        });
    });
}

// =============================================
// SEARCH BOX → WhatsApp
// =============================================
function initSearch() {
    const searchBtn = document.querySelector('.search-btn');
    if (!searchBtn) return;

    searchBtn.addEventListener('click', () => {
        const destino = document.getElementById('searchDestino')?.value;
        const dataIda = document.getElementById('searchDataIda')?.value;
        const dataVolta = document.getElementById('searchDataVolta')?.value;

        if (destino) {
            const msg = encodeURIComponent(
                `Olá! Gostaria de um orçamento para:\n\nDestino: ${destino}\nData de ida: ${dataIda || 'A definir'}\nData de volta: ${dataVolta || 'A definir'}\nViajantes: ${document.getElementById('searchViajantes')?.value || '1 pessoa'}`
            );
            window.open(`https://wa.me/5511998765432?text=${msg}`, '_blank');
        } else {
            document.getElementById('searchDestino')?.focus();
        }
    });
}

// =============================================
// FORMS
// =============================================
function initForms() {
    const contatoForm = document.getElementById('contatoForm');
    const newsletterForm = document.getElementById('newsletterForm');

    if (contatoForm) {
        contatoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = contatoForm.querySelector('.btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Mensagem Enviada!';
            btn.style.background = '#22c55e';
            btn.style.boxShadow = '0 4px 15px rgba(34, 197, 94, 0.4)';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = '';
                btn.style.boxShadow = '';
                contatoForm.reset();
            }, 3000);
        });
    }

    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = newsletterForm.querySelector('.btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Cadastrado!';
            btn.style.background = '#22c55e';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = '';
                newsletterForm.reset();
            }, 3000);
        });
    }
}

// =============================================
// SCROLL ANIMATIONS
// =============================================
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.destino-card, .servico-card, .contato-item, .feature').forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = `all 0.6s ease ${i * 0.05}s`;
        observer.observe(el);
    });
}

// =============================================
// EMPRESA / CONFIGURAÇÕES
// =============================================
async function loadEmpresa() {
    const configs = await xanoFetch('configuracao');
    if (!configs || configs.length === 0) return;

    const cfg = configs[0]; // Único registro

    // ---------- HEADER LOGO ----------
    if (cfg.logo_url) {
        const headerLogo = document.getElementById('headerLogo');
        if (headerLogo) {
            headerLogo.innerHTML = `<img src="${cfg.logo_url}" alt="${cfg.nome_empresa || 'Logo'}" style="height:36px;">`;
        }
    }

    // ---------- TITLE / SLOGAN ----------
    if (cfg.nome_empresa) {
        document.title = `${cfg.nome_empresa} - Agência de Viagens`;
    }

    // ---------- HERO STATS ----------
    if (cfg.slogan) {
        const heroP = document.querySelector('.hero-content p');
        if (heroP) heroP.textContent = cfg.slogan;
    }

    // ---------- SOBRE ----------
    if (cfg.descricao_empresa) {
        const sobreEl = document.getElementById('sobreTexto');
        if (sobreEl) sobreEl.textContent = cfg.descricao_empresa;
    }

    // ---------- CONTATO ----------
    if (cfg.endereco) {
        const el = document.getElementById('siteEndereco');
        if (el) el.textContent = cfg.endereco;
    }

    if (cfg.telefone1 || cfg.telefone2 || cfg.whatsapp) {
        const el = document.getElementById('siteTelefones');
        if (el) {
            let lines = [];
            if (cfg.telefone1) lines.push(cfg.telefone1);
            if (cfg.telefone2) lines.push(cfg.telefone2 + ' (WhatsApp)');
            el.innerHTML = lines.join('<br>');
        }
    }

    if (cfg.email1 || cfg.email2) {
        const el = document.getElementById('siteEmails');
        if (el) {
            let lines = [];
            if (cfg.email1) lines.push(cfg.email1);
            if (cfg.email2) lines.push(cfg.email2);
            el.innerHTML = lines.join('<br>');
        }
    }

    if (cfg.horario_funcionamento) {
        const el = document.getElementById('siteHorario');
        if (el) el.textContent = cfg.horario_funcionamento;
    }

    // ---------- REDES SOCIAIS (CONTATO) ----------
    const socialContainer = document.getElementById('siteContatoSocial');
    if (socialContainer) {
        let links = [];
        if (cfg.whatsapp_link) links.push(`<a href="${cfg.whatsapp_link}" class="social-link" target="_blank"><i class="fab fa-whatsapp"></i></a>`);
        if (cfg.instagram) links.push(`<a href="${cfg.instagram}" class="social-link" target="_blank"><i class="fab fa-instagram"></i></a>`);
        if (cfg.facebook) links.push(`<a href="${cfg.facebook}" class="social-link" target="_blank"><i class="fab fa-facebook-f"></i></a>`);
        if (cfg.youtube) links.push(`<a href="${cfg.youtube}" class="social-link" target="_blank"><i class="fab fa-youtube"></i></a>`);
        if (cfg.tiktok) links.push(`<a href="${cfg.tiktok}" class="social-link" target="_blank"><i class="fab fa-tiktok"></i></a>`);
        if (links.length > 0) socialContainer.innerHTML = links.join('');
    }

    // ---------- FOOTER ----------
    if (cfg.logo_url) {
        const footerLogo = document.getElementById('footerLogo');
        if (footerLogo) {
            footerLogo.innerHTML = `<img src="${cfg.logo_url}" alt="${cfg.nome_empresa || 'Logo'}" style="height:36px;">`;
        }
    }

    if (cfg.descricao_empresa) {
        const el = document.getElementById('footerDescricao');
        if (el) el.textContent = cfg.descricao_empresa;
    }

    const footerSocial = document.getElementById('footerSocial');
    if (footerSocial) {
        let links = [];
        if (cfg.instagram) links.push(`<a href="${cfg.instagram}" target="_blank"><i class="fab fa-instagram"></i></a>`);
        if (cfg.facebook) links.push(`<a href="${cfg.facebook}" target="_blank"><i class="fab fa-facebook-f"></i></a>`);
        if (cfg.youtube) links.push(`<a href="${cfg.youtube}" target="_blank"><i class="fab fa-youtube"></i></a>`);
        if (cfg.tiktok) links.push(`<a href="${cfg.tiktok}" target="_blank"><i class="fab fa-tiktok"></i></a>`);
        if (cfg.pinterest) links.push(`<a href="${cfg.pinterest}" target="_blank"><i class="fab fa-pinterest"></i></a>`);
        if (links.length > 0) footerSocial.innerHTML = links.join('');
    }

    if (cfg.nome_empresa || cfg.cnpj) {
        const el = document.getElementById('footerCopyright');
        if (el) {
            let text = `© ${new Date().getFullYear()} ${cfg.nome_empresa || 'NewTour'}. Todos os direitos reservados.`;
            if (cfg.cnpj) text += ` CNPJ: ${cfg.cnpj}`;
            el.textContent = text;
        }
    }

    // ---------- WHATSAPP FLOAT ----------
    if (cfg.whatsapp_link) {
        const wpp = document.getElementById('whatsappFloat');
        if (wpp) wpp.href = cfg.whatsapp_link;
    }

    // ---------- FAVICON ----------
    if (cfg.favicon_url) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = cfg.favicon_url;
    }

    // ---------- CORES ----------
    if (cfg.cor_primaria) {
        document.documentElement.style.setProperty('--primary', cfg.cor_primaria);
    }
    if (cfg.cor_secundaria) {
        document.documentElement.style.setProperty('--secondary', cfg.cor_secundaria);
    }
}

// =============================================
// UTILS
// =============================================
function formatPrice(val) {
    if (!val && val !== 0) return '0,00';
    return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
