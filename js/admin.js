/* ==========================================
   NEWTOUR - ADMIN PANEL JavaScript
   Integração completa com Xano API
   ========================================== */

// =============================================
// CONFIGURAÇÃO - Edite aqui sua URL do Xano
// =============================================
const CONFIG_KEY = 'newtour_admin_config';

function getConfig() {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) return JSON.parse(saved);
    return {
        apiUrl: '',
        apiKey: ''
    };
}

function saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// =============================================
// API CLIENT - Comunicação com Xano
// =============================================
class XanoClient {
    constructor() {
        this.config = getConfig();
    }

    get baseUrl() {
        return this.config.apiUrl.replace(/\/+$/, '');
    }

    get headers() {
        const h = { 'Content-Type': 'application/json' };
        if (this.config.apiKey) {
            h['Authorization'] = this.config.apiKey;
        }
        return h;
    }

    async request(endpoint, method = 'GET', body = null) {
        if (!this.baseUrl) {
            throw new Error('URL da API não configurada. Vá em Configurações.');
        }

        const options = {
            method,
            headers: this.headers
        };

        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, options);

        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(err.message || `Erro ${response.status}`);
        }

        if (response.status === 204) return null;
        return response.json();
    }

    // CRUD helpers
    async getAll(table) {
        return this.request(`/${table}`);
    }

    async getById(table, id) {
        return this.request(`/${table}/${id}`);
    }

    async create(table, data) {
        return this.request(`/${table}`, 'POST', data);
    }

    async update(table, id, data) {
        return this.request(`/${table}/${id}`, 'PATCH', data);
    }

    async remove(table, id) {
        return this.request(`/${table}/${id}`, 'DELETE');
    }

    async testConnection() {
        return this.request('/promocao');
    }
}

const api = new XanoClient();

// =============================================
// STATE
// =============================================
let promocoes = [];
let destinos = [];
let banners = [];
let deleteCallback = null;

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initConfig();
    initPromoForm();
    initDestinoForm();
    initBannerForm();
    initSearch();
    loadAll();
});

// =============================================
// NAVIGATION
// =============================================
function initNavigation() {
    const links = document.querySelectorAll('.sidebar-link[data-section]');
    const sections = document.querySelectorAll('.admin-section');
    const titleEl = document.getElementById('pageTitle');

    const titles = {
        dashboard: 'Dashboard',
        promocoes: 'Gerenciar Promoções',
        destinos: 'Gerenciar Destinos',
        banners: 'Gerenciar Banners',
        empresa: 'Dados da Empresa',
        config: 'Configurações'
    };

    function navigateTo(sectionId) {
        links.forEach(l => l.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));

        const link = document.querySelector(`.sidebar-link[data-section="${sectionId}"]`);
        const section = document.getElementById(`section-${sectionId}`);

        if (link) link.classList.add('active');
        if (section) section.classList.add('active');
        if (titleEl) titleEl.textContent = titles[sectionId] || sectionId;

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
    }

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.section);
        });
    });

    // Card links that navigate
    document.querySelectorAll('.card-link[data-nav]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.nav);
        });
    });

    // Quick actions
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const nav = btn.dataset.nav;
            navigateTo(nav);
            if (btn.dataset.action === 'nova' || btn.dataset.action === 'novo') {
                setTimeout(() => {
                    if (nav === 'promocoes') document.getElementById('btnNovaPromo').click();
                    if (nav === 'destinos') document.getElementById('btnNovoDestino').click();
                    if (nav === 'banners') document.getElementById('btnNovoBanner').click();
                }, 200);
            }
        });
    });

    // Mobile menu
    document.getElementById('menuToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    document.getElementById('sidebarClose').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
    });

    // Sidebar footer links
    document.querySelectorAll('.sidebar-footer .sidebar-link').forEach(link => {
        if (link.classList.contains('logout')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Tem certeza que deseja sair?')) {
                    localStorage.removeItem(CONFIG_KEY);
                    location.reload();
                }
            });
        }
    });
}

// =============================================
// CONFIGURAÇÕES
// =============================================
function initConfig() {
    const config = getConfig();
    const urlInput = document.getElementById('configApiUrl');
    const keyInput = document.getElementById('configApiKey');

    if (config.apiUrl) urlInput.value = config.apiUrl;
    if (config.apiKey) keyInput.value = config.apiKey;

    document.getElementById('btnSalvarConfig').addEventListener('click', () => {
        saveConfig({
            apiUrl: urlInput.value.trim(),
            apiKey: keyInput.value.trim()
        });
        api.config = getConfig();
        showToast('Configurações salvas!', 'success');
    });

    document.getElementById('btnTestarConexao').addEventListener('click', async () => {
        const statusEl = document.getElementById('connectionStatus');
        statusEl.className = 'connection-status';
        statusEl.style.display = 'none';

        // Save first
        saveConfig({
            apiUrl: urlInput.value.trim(),
            apiKey: keyInput.value.trim()
        });
        api.config = getConfig();

        try {
            const data = await api.testConnection();
            statusEl.textContent = `✓ Conexão OK! Tabela "promocao" retornou ${Array.isArray(data) ? data.length : '?'} registros.`;
            statusEl.className = 'connection-status success';
        } catch (err) {
            statusEl.textContent = `✗ Erro: ${err.message}`;
            statusEl.className = 'connection-status error';
        }
    });
}

// =============================================
// LOAD ALL DATA
// =============================================
async function loadAll() {
    await Promise.all([
        loadPromocoes(),
        loadDestinos(),
        loadBanners()
    ]);
    updateDashboard();
    initEmpresa();
}

// =============================================
// PROMOÇÕES
// =============================================
async function loadPromocoes() {
    try {
        promocoes = await api.getAll('promocao');
        renderPromoTable();
    } catch (err) {
        console.warn('Erro ao carregar promoções:', err.message);
        promocoes = [];
        renderPromoTable();
    }
}

function renderPromoTable() {
    const tbody = document.getElementById('promoTableBody');
    const filter = document.getElementById('filterPromoStatus').value;
    const search = document.getElementById('searchPromo').value.toLowerCase();

    let filtered = promocoes.filter(p => {
        if (filter === 'ativa' && !p.ativa) return false;
        if (filter === 'inativa' && p.ativa) return false;
        if (filter === 'expirada' && new Date(p.data_fim) >= new Date()) return false;
        if (search && !p.titulo?.toLowerCase().includes(search) && !p.destino?.toLowerCase().includes(search)) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhuma promoção encontrada</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(p => {
        const isExpired = new Date(p.data_fim) < new Date();
        const statusClass = !p.ativa ? 'badge-inactive' : isExpired ? 'badge-expired' : 'badge-active';
        const statusText = !p.ativa ? 'Inativa' : isExpired ? 'Expirada' : 'Ativa';

        return `
        <tr>
            <td><img class="table-thumb" src="${p.imagem_url || 'https://via.placeholder.com/100x60?text=IMG'}" alt=""></td>
            <td><strong>${p.titulo || '-'}</strong></td>
            <td>${p.destino || '-'}</td>
            <td>R$ ${formatPrice(p.preco_original)}</td>
            <td><strong style="color: var(--green);">R$ ${formatPrice(p.preco_desconto)}</strong></td>
            <td><span class="badge badge-active">${p.desconto_percentual || 0}% OFF</span></td>
            <td style="font-size:0.8rem;">${formatDate(p.data_inicio)} → ${formatDate(p.data_fim)}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn-icon edit" onclick="editPromo(${p.id})" title="Editar"><i class="fas fa-pen"></i></button>
                <button class="btn-icon view" onclick="viewPromo(${p.id})" title="Ver" target="_blank"><i class="fas fa-eye"></i></button>
                <button class="btn-icon delete" onclick="confirmDelete('promocao', ${p.id}, '${(p.titulo||'').replace(/'/g,"\\'")}')" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function initPromoForm() {
    // Botão nova promoção
    document.getElementById('btnNovaPromo').addEventListener('click', () => {
        document.getElementById('modalPromoTitle').textContent = 'Nova Promoção';
        document.getElementById('formPromo').reset();
        document.getElementById('promoId').value = '';
        document.getElementById('promoImagemPreview').classList.remove('show');
        openModal('modalPromo');
    });

    // Calcular desconto automaticamente
    const precoOrig = document.getElementById('promoPrecoOriginal');
    const precoDesc = document.getElementById('promoPrecoDesconto');
    const descontoEl = document.getElementById('promoDesconto');

    const calcDesconto = () => {
        const orig = parseFloat(precoOrig.value) || 0;
        const desc = parseFloat(precoDesc.value) || 0;
        if (orig > 0 && desc > 0 && desc < orig) {
            descontoEl.value = Math.round(((orig - desc) / orig) * 100);
        } else {
            descontoEl.value = '';
        }
    };

    precoOrig.addEventListener('input', calcDesconto);
    precoDesc.addEventListener('input', calcDesconto);

    // Preview imagem
    document.getElementById('promoImagem').addEventListener('input', (e) => {
        const preview = document.getElementById('promoImagemPreview');
        if (e.target.value) {
            preview.innerHTML = `<img src="${e.target.value}" alt="Preview" onerror="this.parentElement.classList.remove('show')">`;
            preview.classList.add('show');
        } else {
            preview.classList.remove('show');
        }
    });

    // Salvar
    document.getElementById('btnSalvarPromo').addEventListener('click', savePromo);
}

async function savePromo() {
    const id = document.getElementById('promoId').value;
    const data = {
        titulo: document.getElementById('promoTitulo').value,
        destino: document.getElementById('promoDestino').value,
        descricao: document.getElementById('promoDescricao').value,
        imagem_url: document.getElementById('promoImagem').value,
        preco_original: parseFloat(document.getElementById('promoPrecoOriginal').value) || 0,
        preco_desconto: parseFloat(document.getElementById('promoPrecoDesconto').value) || 0,
        desconto_percentual: parseInt(document.getElementById('promoDesconto').value) || 0,
        data_inicio: document.getElementById('promoDataInicio').value,
        data_fim: document.getElementById('promoDataFim').value,
        ativa: document.getElementById('promoAtiva').value === 'true',
        ordem: parseInt(document.getElementById('promoOrdem').value) || 0
    };

    try {
        if (id) {
            await api.update('promocao', id, data);
            showToast('Promoção atualizada com sucesso!', 'success');
        } else {
            await api.create('promocao', data);
            showToast('Promoção criada com sucesso!', 'success');
        }
        closeModal('modalPromo');
        await loadPromocoes();
        updateDashboard();
    } catch (err) {
        showToast(`Erro: ${err.message}`, 'error');
    }
}

window.editPromo = async function(id) {
    try {
        const p = await api.getById('promocao', id);
        document.getElementById('modalPromoTitle').textContent = 'Editar Promoção';
        document.getElementById('promoId').value = p.id;
        document.getElementById('promoTitulo').value = p.titulo || '';
        document.getElementById('promoDestino').value = p.destino || '';
        document.getElementById('promoDescricao').value = p.descricao || '';
        document.getElementById('promoImagem').value = p.imagem_url || '';
        document.getElementById('promoPrecoOriginal').value = p.preco_original || '';
        document.getElementById('promoPrecoDesconto').value = p.preco_desconto || '';
        document.getElementById('promoDesconto').value = p.desconto_percentual || '';
        document.getElementById('promoDataInicio').value = p.data_inicio || '';
        document.getElementById('promoDataFim').value = p.data_fim || '';
        document.getElementById('promoOrdem').value = p.ordem || 0;
        document.getElementById('promoAtiva').value = p.ativa ? 'true' : 'false';

        // Preview imagem
        const preview = document.getElementById('promoImagemPreview');
        if (p.imagem_url) {
            preview.innerHTML = `<img src="${p.imagem_url}" alt="Preview">`;
            preview.classList.add('show');
        } else {
            preview.classList.remove('show');
        }

        openModal('modalPromo');
    } catch (err) {
        showToast(`Erro ao carregar: ${err.message}`, 'error');
    }
};

window.viewPromo = function(id) {
    const p = promocoes.find(x => x.id === id);
    if (p && p.imagem_url) {
        window.open(p.imagem_url, '_blank');
    }
};

// =============================================
// DESTINOS
// =============================================
async function loadDestinos() {
    try {
        destinos = await api.getAll('destino');
        renderDestinoTable();
    } catch (err) {
        console.warn('Erro ao carregar destinos:', err.message);
        destinos = [];
        renderDestinoTable();
    }
}

function renderDestinoTable() {
    const tbody = document.getElementById('destinoTableBody');
    const filter = document.getElementById('filterDestinoCategoria').value;
    const search = document.getElementById('searchDestino').value.toLowerCase();

    let filtered = destinos.filter(d => {
        if (filter && d.categoria !== filter) return false;
        if (search && !d.nome?.toLowerCase().includes(search) && !d.localizacao?.toLowerCase().includes(search)) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhum destino encontrado</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(d => `
        <tr>
            <td><img class="table-thumb" src="${d.imagem_url || 'https://via.placeholder.com/100x60?text=IMG'}" alt=""></td>
            <td><strong>${d.nome || '-'}</strong></td>
            <td>${d.localizacao || '-'}</td>
            <td><span class="badge badge-active">${d.categoria || '-'}</span></td>
            <td>${d.duracao_dias || '-'} dias</td>
            <td>⭐ ${d.avaliacao || '-'}</td>
            <td><strong>R$ ${formatPrice(d.preco)}</strong></td>
            <td><span class="badge ${d.ativa ? 'badge-active' : 'badge-inactive'}">${d.ativa ? 'Ativo' : 'Inativo'}</span></td>
            <td>
                <button class="btn-icon edit" onclick="editDestino(${d.id})" title="Editar"><i class="fas fa-pen"></i></button>
                <button class="btn-icon delete" onclick="confirmDelete('destino', ${d.id}, '${(d.nome||'').replace(/'/g,"\\'")}')" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function initDestinoForm() {
    document.getElementById('btnNovoDestino').addEventListener('click', () => {
        document.getElementById('modalDestinoTitle').textContent = 'Novo Destino';
        document.getElementById('formDestino').reset();
        document.getElementById('destinoId').value = '';
        document.getElementById('destinoImagemPreview').classList.remove('show');
        openModal('modalDestino');
    });

    document.getElementById('destinoImagem').addEventListener('input', (e) => {
        const preview = document.getElementById('destinoImagemPreview');
        if (e.target.value) {
            preview.innerHTML = `<img src="${e.target.value}" alt="Preview" onerror="this.parentElement.classList.remove('show')">`;
            preview.classList.add('show');
        } else {
            preview.classList.remove('show');
        }
    });

    document.getElementById('btnSalvarDestino').addEventListener('click', saveDestino);
}

async function saveDestino() {
    const id = document.getElementById('destinoId').value;
    const data = {
        nome: document.getElementById('destinoNome').value,
        localizacao: document.getElementById('destinoLocalizacao').value,
        descricao: document.getElementById('destinoDescricao').value,
        imagem_url: document.getElementById('destinoImagem').value,
        categoria: document.getElementById('destinoCategoria').value,
        tag: document.getElementById('destinoTag').value,
        duracao_dias: parseInt(document.getElementById('destinoDuracao').value) || 1,
        avaliacao: parseFloat(document.getElementById('destinoAvaliacao').value) || 4.5,
        preco: parseFloat(document.getElementById('destinoPreco').value) || 0,
        ativa: document.getElementById('destinoAtiva').value === 'true',
        ordem: parseInt(document.getElementById('destinoOrdem').value) || 0
    };

    try {
        if (id) {
            await api.update('destino', id, data);
            showToast('Destino atualizado com sucesso!', 'success');
        } else {
            await api.create('destino', data);
            showToast('Destino criado com sucesso!', 'success');
        }
        closeModal('modalDestino');
        await loadDestinos();
        updateDashboard();
    } catch (err) {
        showToast(`Erro: ${err.message}`, 'error');
    }
}

window.editDestino = async function(id) {
    try {
        const d = await api.getById('destino', id);
        document.getElementById('modalDestinoTitle').textContent = 'Editar Destino';
        document.getElementById('destinoId').value = d.id;
        document.getElementById('destinoNome').value = d.nome || '';
        document.getElementById('destinoLocalizacao').value = d.localizacao || '';
        document.getElementById('destinoDescricao').value = d.descricao || '';
        document.getElementById('destinoImagem').value = d.imagem_url || '';
        document.getElementById('destinoCategoria').value = d.categoria || 'nacional';
        document.getElementById('destinoTag').value = d.tag || '';
        document.getElementById('destinoDuracao').value = d.duracao_dias || '';
        document.getElementById('destinoAvaliacao').value = d.avaliacao || '';
        document.getElementById('destinoPreco').value = d.preco || '';
        document.getElementById('destinoOrdem').value = d.ordem || 0;
        document.getElementById('destinoAtiva').value = d.ativa ? 'true' : 'false';

        const preview = document.getElementById('destinoImagemPreview');
        if (d.imagem_url) {
            preview.innerHTML = `<img src="${d.imagem_url}" alt="Preview">`;
            preview.classList.add('show');
        } else {
            preview.classList.remove('show');
        }

        openModal('modalDestino');
    } catch (err) {
        showToast(`Erro ao carregar: ${err.message}`, 'error');
    }
};

// =============================================
// BANNERS
// =============================================
async function loadBanners() {
    try {
        banners = await api.getAll('banner');
        renderBannerTable();
    } catch (err) {
        console.warn('Erro ao carregar banners:', err.message);
        banners = [];
        renderBannerTable();
    }
}

function renderBannerTable() {
    const tbody = document.getElementById('bannerTableBody');
    const search = document.getElementById('searchBanner').value.toLowerCase();

    let filtered = banners.filter(b => {
        if (search && !b.titulo?.toLowerCase().includes(search)) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhum banner encontrado</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(b => `
        <tr>
            <td><img class="table-thumb" src="${b.imagem_url || 'https://via.placeholder.com/100x60?text=IMG'}" alt=""></td>
            <td><strong>${b.titulo || '-'}</strong></td>
            <td>${b.ordem || 0}</td>
            <td style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${b.link || '-'}</td>
            <td style="font-size:0.8rem;">${formatDate(b.data_inicio)} → ${formatDate(b.data_fim)}</td>
            <td><span class="badge ${b.ativa ? 'badge-active' : 'badge-inactive'}">${b.ativa ? 'Ativo' : 'Inativo'}</span></td>
            <td>
                <button class="btn-icon edit" onclick="editBanner(${b.id})" title="Editar"><i class="fas fa-pen"></i></button>
                <button class="btn-icon delete" onclick="confirmDelete('banner', ${b.id}, '${(b.titulo||'').replace(/'/g,"\\'")}')" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function initBannerForm() {
    document.getElementById('btnNovoBanner').addEventListener('click', () => {
        document.getElementById('modalBannerTitle').textContent = 'Novo Banner';
        document.getElementById('formBanner').reset();
        document.getElementById('bannerId').value = '';
        document.getElementById('bannerImagemPreview').classList.remove('show');
        openModal('modalBanner');
    });

    document.getElementById('bannerImagem').addEventListener('input', (e) => {
        const preview = document.getElementById('bannerImagemPreview');
        if (e.target.value) {
            preview.innerHTML = `<img src="${e.target.value}" alt="Preview" onerror="this.parentElement.classList.remove('show')">`;
            preview.classList.add('show');
        } else {
            preview.classList.remove('show');
        }
    });

    document.getElementById('btnSalvarBanner').addEventListener('click', saveBanner);
}

async function saveBanner() {
    const id = document.getElementById('bannerId').value;
    const data = {
        titulo: document.getElementById('bannerTitulo').value,
        subtitulo: document.getElementById('bannerSubtitulo').value,
        imagem_url: document.getElementById('bannerImagem').value,
        link: document.getElementById('bannerLink').value,
        data_inicio: document.getElementById('bannerDataInicio').value,
        data_fim: document.getElementById('bannerDataFim').value,
        ativa: document.getElementById('bannerAtiva').value === 'true',
        ordem: parseInt(document.getElementById('bannerOrdem').value) || 0
    };

    try {
        if (id) {
            await api.update('banner', id, data);
            showToast('Banner atualizado com sucesso!', 'success');
        } else {
            await api.create('banner', data);
            showToast('Banner criado com sucesso!', 'success');
        }
        closeModal('modalBanner');
        await loadBanners();
        updateDashboard();
    } catch (err) {
        showToast(`Erro: ${err.message}`, 'error');
    }
}

window.editBanner = async function(id) {
    try {
        const b = await api.getById('banner', id);
        document.getElementById('modalBannerTitle').textContent = 'Editar Banner';
        document.getElementById('bannerId').value = b.id;
        document.getElementById('bannerTitulo').value = b.titulo || '';
        document.getElementById('bannerSubtitulo').value = b.subtitulo || '';
        document.getElementById('bannerImagem').value = b.imagem_url || '';
        document.getElementById('bannerLink').value = b.link || '';
        document.getElementById('bannerDataInicio').value = b.data_inicio || '';
        document.getElementById('bannerDataFim').value = b.data_fim || '';
        document.getElementById('bannerOrdem').value = b.ordem || 0;
        document.getElementById('bannerAtiva').value = b.ativa ? 'true' : 'false';

        const preview = document.getElementById('bannerImagemPreview');
        if (b.imagem_url) {
            preview.innerHTML = `<img src="${b.imagem_url}" alt="Preview">`;
            preview.classList.add('show');
        } else {
            preview.classList.remove('show');
        }

        openModal('modalBanner');
    } catch (err) {
        showToast(`Erro ao carregar: ${err.message}`, 'error');
    }
};

// =============================================
// DELETE
// =============================================
window.confirmDelete = function(table, id, name) {
    document.getElementById('confirmText').textContent = `Tem certeza que deseja excluir "${name}"?`;
    deleteCallback = async () => {
        try {
            await api.remove(table, id);
            showToast('Excluído com sucesso!', 'success');
            if (table === 'promocao') await loadPromocoes();
            if (table === 'destino') await loadDestinos();
            if (table === 'banner') await loadBanners();
            updateDashboard();
        } catch (err) {
            showToast(`Erro ao excluir: ${err.message}`, 'error');
        }
    };
    openModal('modalConfirm');
};

document.getElementById('btnConfirmDelete').addEventListener('click', async () => {
    if (deleteCallback) {
        await deleteCallback();
        deleteCallback = null;
    }
    closeModal('modalConfirm');
});

// =============================================
// EMPRESA / CONFIGURAÇÃO
// =============================================
async function initEmpresa() {
    // Load existing data
    try {
        const configs = await api.getAll('configuracao');
        if (configs && configs.length > 0) {
            fillEmpresaForm(configs[0]);
        }
    } catch (err) {
        console.warn('Tabela configuracao não encontrada ou vazia:', err.message);
    }

    // Color pickers sync
    const corPrimariaPick = document.getElementById('cfgCorPrimariaPick');
    const corPrimariaText = document.getElementById('cfgCorPrimaria');
    const corSecundariaPick = document.getElementById('cfgCorSecundariaPick');
    const corSecundariaText = document.getElementById('cfgCorSecundaria');

    if (corPrimariaPick && corPrimariaText) {
        corPrimariaPick.addEventListener('input', () => corPrimariaText.value = corPrimariaPick.value);
        corPrimariaText.addEventListener('input', () => {
            if (/^#[0-9a-f]{6}$/i.test(corPrimariaText.value)) corPrimariaPick.value = corPrimariaText.value;
        });
    }
    if (corSecundariaPick && corSecundariaText) {
        corSecundariaPick.addEventListener('input', () => corSecundariaText.value = corSecundariaPick.value);
        corSecundariaText.addEventListener('input', () => {
            if (/^#[0-9a-f]{6}$/i.test(corSecundariaText.value)) corSecundariaPick.value = corSecundariaText.value;
        });
    }

    // Logo previews
    const logoInput = document.getElementById('cfgLogoUrl');
    const logoPreview = document.getElementById('logoPreview');
    if (logoInput && logoPreview) {
        logoInput.addEventListener('input', (e) => {
            if (e.target.value) {
                logoPreview.innerHTML = `<img src="${e.target.value}" alt="Logo Preview" onerror="this.parentElement.classList.remove('show')">`;
                logoPreview.classList.add('show');
            } else {
                logoPreview.classList.remove('show');
            }
        });
    }

    const logoFooterInput = document.getElementById('cfgLogoFooterUrl');
    const logoFooterPreview = document.getElementById('logoFooterPreview');
    if (logoFooterInput && logoFooterPreview) {
        logoFooterInput.addEventListener('input', (e) => {
            if (e.target.value) {
                logoFooterPreview.innerHTML = `<img src="${e.target.value}" alt="Logo Footer Preview" onerror="this.parentElement.classList.remove('show')">`;
                logoFooterPreview.classList.add('show');
            } else {
                logoFooterPreview.classList.remove('show');
            }
        });
    }

    // Save button
    document.getElementById('btnSalvarEmpresa').addEventListener('click', saveEmpresa);
}

let empresaConfigId = null;

function fillEmpresaForm(cfg) {
    empresaConfigId = cfg.id;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('cfgNomeEmpresa', cfg.nome_empresa);
    setVal('cfgSlogan', cfg.slogan);
    setVal('cfgDescricaoEmpresa', cfg.descricao_empresa);
    setVal('cfgLogoUrl', cfg.logo_url);
    setVal('cfgLogoFooterUrl', cfg.logo_footer_url);
    setVal('cfgFaviconUrl', cfg.favicon_url);
    setVal('cfgEndereco', cfg.endereco);
    setVal('cfgTelefone1', cfg.telefone1);
    setVal('cfgTelefone2', cfg.telefone2);
    setVal('cfgEmail1', cfg.email1);
    setVal('cfgEmail2', cfg.email2);
    setVal('cfgWhatsapp', cfg.whatsapp);
    setVal('cfgHorario', cfg.horario_funcionamento);
    setVal('cfgCnpj', cfg.cnpj);
    setVal('cfgInstagram', cfg.instagram);
    setVal('cfgFacebook', cfg.facebook);
    setVal('cfgYoutube', cfg.youtube);
    setVal('cfgTiktok', cfg.tiktok);
    setVal('cfgPinterest', cfg.pinterest);
    setVal('cfgWhatsappLink', cfg.whatsapp_link);
    setVal('cfgCorPrimaria', cfg.cor_primaria);
    setVal('cfgCorSecundaria', cfg.cor_secundaria);

    // Sync color pickers
    if (cfg.cor_primaria) {
        document.getElementById('cfgCorPrimariaPick').value = cfg.cor_primaria || '#0891b2';
    }
    if (cfg.cor_secundaria) {
        document.getElementById('cfgCorSecundariaPick').value = cfg.cor_secundaria || '#f59e0b';
    }

    // Logo previews
    const logoPreview = document.getElementById('logoPreview');
    if (cfg.logo_url && logoPreview) {
        logoPreview.innerHTML = `<img src="${cfg.logo_url}" alt="Logo">`;
        logoPreview.classList.add('show');
    }
    const logoFooterPreview = document.getElementById('logoFooterPreview');
    if (cfg.logo_footer_url && logoFooterPreview) {
        logoFooterPreview.innerHTML = `<img src="${cfg.logo_footer_url}" alt="Logo Footer">`;
        logoFooterPreview.classList.add('show');
    }
}

async function saveEmpresa() {
    const getVal = (id) => document.getElementById(id)?.value || '';

    const data = {
        nome_empresa: getVal('cfgNomeEmpresa'),
        slogan: getVal('cfgSlogan'),
        descricao_empresa: getVal('cfgDescricaoEmpresa'),
        logo_url: getVal('cfgLogoUrl'),
        logo_footer_url: getVal('cfgLogoFooterUrl'),
        favicon_url: getVal('cfgFaviconUrl'),
        endereco: getVal('cfgEndereco'),
        telefone1: getVal('cfgTelefone1'),
        telefone2: getVal('cfgTelefone2'),
        email1: getVal('cfgEmail1'),
        email2: getVal('cfgEmail2'),
        whatsapp: getVal('cfgWhatsapp'),
        horario_funcionamento: getVal('cfgHorario'),
        cnpj: getVal('cfgCnpj'),
        instagram: getVal('cfgInstagram'),
        facebook: getVal('cfgFacebook'),
        youtube: getVal('cfgYoutube'),
        tiktok: getVal('cfgTiktok'),
        pinterest: getVal('cfgPinterest'),
        whatsapp_link: getVal('cfgWhatsappLink'),
        cor_primaria: getVal('cfgCorPrimaria'),
        cor_secundaria: getVal('cfgCorSecundaria')
    };

    try {
        if (empresaConfigId) {
            await api.update('configuracao', empresaConfigId, data);
            showToast('Dados da empresa atualizados com sucesso!', 'success');
        } else {
            const created = await api.create('configuracao', data);
            empresaConfigId = created.id;
            showToast('Dados da empresa salvos com sucesso!', 'success');
        }
    } catch (err) {
        showToast(`Erro: ${err.message}`, 'error');
    }
}

// =============================================
// SEARCH & FILTERS
// =============================================
function initSearch() {
    document.getElementById('searchPromo')?.addEventListener('input', renderPromoTable);
    document.getElementById('filterPromoStatus')?.addEventListener('change', renderPromoTable);
    document.getElementById('searchDestino')?.addEventListener('input', renderDestinoTable);
    document.getElementById('filterDestinoCategoria')?.addEventListener('change', renderDestinoTable);
    document.getElementById('searchBanner')?.addEventListener('input', renderBannerTable);
}

// =============================================
// DASHBOARD
// =============================================
function updateDashboard() {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    document.getElementById('statPromos').textContent = promocoes.filter(p => p.ativa).length;
    document.getElementById('statDestinos').textContent = destinos.length;
    document.getElementById('statBanners').textContent = banners.filter(b => b.ativa).length;
    document.getElementById('statExpirando').textContent = promocoes.filter(p => {
        const end = new Date(p.data_fim);
        return p.ativa && end >= now && end <= in7Days;
    }).length;

    // Recent promos table
    const tbody = document.getElementById('dashboardPromos');
    const recent = [...promocoes].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5);

    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhuma promoção ainda</td></tr>';
        return;
    }

    tbody.innerHTML = recent.map(p => {
        const isExpired = new Date(p.data_fim) < new Date();
        const statusClass = !p.ativa ? 'badge-inactive' : isExpired ? 'badge-expired' : 'badge-active';
        const statusText = !p.ativa ? 'Inativa' : isExpired ? 'Expirada' : 'Ativa';
        return `
        <tr>
            <td><strong>${p.titulo || '-'}</strong></td>
            <td>${p.desconto_percentual || 0}% OFF</td>
            <td style="font-size:0.8rem;">${formatDate(p.data_inicio)} → ${formatDate(p.data_fim)}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
        </tr>`;
    }).join('');
}

// =============================================
// UTILITIES
// =============================================
function openModal(id) {
    document.getElementById(id).classList.add('show');
    document.body.style.overflow = 'hidden';
}

window.closeModal = function(id) {
    document.getElementById(id).classList.remove('show');
    document.body.style.overflow = '';
};

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function formatPrice(val) {
    if (!val && val !== 0) return '0,00';
    return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
    if (!dateStr) return '--';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('show');
            document.body.style.overflow = '';
        }
    });
});

// ESC to close modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.show').forEach(m => {
            m.classList.remove('show');
            document.body.style.overflow = '';
        });
    }
});
