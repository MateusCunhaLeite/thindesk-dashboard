// Dashboard Administrativo do Thindesk
// Busca os dados na API (/api/dashboard e /api/chamados) e monta indicadores, gráficos e tabelas.

const INTERVALO_ATUALIZACAO = 60 * 1000;

const CORES_STATUS = {
    ABERTO: '#0d6efd',
    EM_ANDAMENTO: '#ffc107',
    AGUARDANDO: '#6f42c1',
    CONCLUIDO: '#198754',
    CANCELADO: '#dc3545'
};

const CORES_PRIORIDADE = {
    BAIXA: '#adb5bd',
    MEDIA: '#0d6efd',
    ALTA: '#fd7e14',
    CRITICA: '#dc3545'
};

const estado = {
    opcoes: null,
    filtros: {},
    pagina: 1,
    graficos: {},
    tipos: [],
    timer: null
};

const $ = (id) => document.getElementById(id);

/* ================= Comunicação com a API (RF06) ================= */

function montarQuery(params) {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([chave, valor]) => {
        if (valor !== undefined && valor !== null && valor !== '') {
            query.append(chave, valor);
        }
    });
    const texto = query.toString();
    return texto ? '?' + texto : '';
}

async function requisicao(url, opcoes = {}) {
    let resposta;
    try {
        resposta = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...opcoes
        });
    } catch (e) {
        throw new Error('Não foi possível conectar ao servidor.');
    }

    // se a sessão expirou o Spring Security redireciona para a tela de login
    if (resposta.redirected && resposta.url.includes('/login')) {
        window.location.href = '/login';
        throw new Error('Sessão expirada. Faça login novamente.');
    }

    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok) {
        throw new Error((corpo && corpo.erro) || 'Erro ' + resposta.status + ' ao consultar a API');
    }
    return corpo;
}

const api = {
    opcoes: () => requisicao('/api/dashboard/opcoes'),
    indicadores: (f) => requisicao('/api/dashboard/indicadores' + montarQuery(f)),
    porPeriodo: (f, agrupamento) => requisicao('/api/dashboard/por-periodo' + montarQuery({ ...f, agrupamento })),
    porStatus: (f) => requisicao('/api/dashboard/por-status' + montarQuery(f)),
    porPrioridade: (f) => requisicao('/api/dashboard/por-prioridade' + montarQuery(f)),
    porTipo: (f) => requisicao('/api/dashboard/por-tipo' + montarQuery(f)),
    porTecnico: (f) => requisicao('/api/dashboard/por-tecnico' + montarQuery(f)),
    chamados: (f) => requisicao('/api/chamados' + montarQuery(f)),
    chamado: (id) => requisicao('/api/chamados/' + id),
    atualizarStatus: (id, dados) => requisicao('/api/chamados/' + id + '/status', { method: 'PATCH', body: JSON.stringify(dados) }),
    adicionarConsideracao: (id, dados) => requisicao('/api/chamados/' + id + '/consideracoes', { method: 'POST', body: JSON.stringify(dados) })
};

/* ================= Formatação (RF07) ================= */

const fmt = {
    numero: (v) => (v === null || v === undefined ? '-' : Number(v).toLocaleString('pt-BR')),

    percentual: (v) => (v === null || v === undefined ? '-' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'),

    // 27.5 -> "1d 3h" | 3.2 -> "3h 12min" | 0.4 -> "24min"
    horas(v) {
        if (v === null || v === undefined) return '-';
        const totalMin = Math.round(v * 60);
        const dias = Math.floor(totalMin / 1440);
        const horas = Math.floor((totalMin % 1440) / 60);
        const minutos = totalMin % 60;
        if (dias > 0) return horas ? `${dias}d ${horas}h` : `${dias}d`;
        if (horas > 0) return minutos ? `${horas}h ${minutos}min` : `${horas}h`;
        return `${minutos}min`;
    },

    // "2026-11-14T09:30:00" -> "14/11/2026 09:30"
    dataHora(texto) {
        if (!texto) return '-';
        const [data, hora = ''] = texto.split('T');
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano} ${hora.substring(0, 5)}`.trim();
    },

    periodo(chave, agrupamento) {
        const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        const [ano, mes, dia] = chave.split('-');
        if (agrupamento === 'mes') return `${meses[Number(mes) - 1]}/${ano.substring(2)}`;
        if (agrupamento === 'semana') return `sem. ${dia}/${mes}`;
        return `${dia}/${mes}`;
    },

    diaISO(data) {
        const p = (n) => String(n).padStart(2, '0');
        return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
    },

    escapar(texto) {
        return String(texto ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
};

/* ================= Alertas ================= */

function mostrarAlerta(mensagem, tipo = 'danger') {
    const alerta = $('alerta');
    alerta.textContent = mensagem;
    alerta.className = 'alert alert-' + tipo;
    clearTimeout(alerta.timer);
    alerta.timer = setTimeout(() => alerta.classList.add('d-none'), 6000);
}

/* ================= Filtros (RF05) ================= */

function preencherSelect(id, itens) {
    const select = $(id);
    itens.forEach((item) => select.add(new Option(item.label, item.valor)));
}

function preencherFiltros(opcoes) {
    preencherSelect('f-status', opcoes.status);
    preencherSelect('f-prioridade', opcoes.prioridades);
    preencherSelect('f-tipo', opcoes.tipos.map((t) => ({ valor: t, label: t })));
    preencherSelect('f-tecnico', opcoes.tecnicos.map((t) => ({ valor: t, label: t })));
}

function lerFiltros() {
    const dados = new FormData($('form-filtros'));
    const filtros = Object.fromEntries([...dados.entries()].filter(([, v]) => v !== ''));
    if (filtros.inicio && filtros.fim && filtros.inicio > filtros.fim) {
        throw new Error('A data inicial não pode ser maior que a data final.');
    }
    return filtros;
}

function definirPeriodo(dias) {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - (dias - 1));
    $('f-inicio').value = fmt.diaISO(inicio);
    $('f-fim').value = fmt.diaISO(new Date());

    document.querySelectorAll('.atalho').forEach((botao) => {
        botao.classList.toggle('active', Number(botao.dataset.dias) === dias);
    });
}

/* ================= Indicadores (RF01) ================= */

function renderizarIndicadores(d) {
    $('kpi-total').textContent = fmt.numero(d.total);
    $('kpi-total-sub').textContent = `${fmt.numero(d.cancelados)} cancelados`;

    $('kpi-pendentes').textContent = fmt.numero(d.pendentes);
    $('kpi-pendentes-sub').textContent = `${d.abertos} abertos · ${d.emAndamento} em andamento · ${d.aguardando} aguardando`;

    $('kpi-concluidos').textContent = fmt.numero(d.concluidos);
    $('kpi-concluidos-sub').textContent = 'Taxa de resolução: ' + fmt.percentual(d.taxaResolucao);

    $('kpi-tempo').textContent = fmt.horas(d.tempoMedioResolucaoHoras);
    $('kpi-sla').textContent = d.concluidos ? fmt.percentual(d.percentualNoPrazo) : '-';

    $('kpi-atrasados').textContent = fmt.numero(d.atrasados);
    $('kpi-atrasados-sub').textContent = d.semTecnico ? `${d.semTecnico} pendente(s) sem técnico` : 'todos os pendentes têm técnico';
}

/* ================= Gráficos (RF02, RF03, RF04) ================= */

// cria o gráfico na primeira vez e depois só troca os dados
function desenharGrafico(nome, config) {
    const existente = estado.graficos[nome];
    if (existente) {
        existente.data = config.data;
        existente.update();
        return;
    }
    estado.graficos[nome] = new Chart($('grafico-' + nome), config);
}

function renderizarPeriodo(serie) {
    const dados = serie.dados;
    desenharGrafico('periodo', {
        type: 'line',
        data: {
            labels: dados.map((d) => fmt.periodo(d.periodo, serie.agrupamento)),
            datasets: [
                { label: 'Abertos', data: dados.map((d) => d.abertos), borderColor: '#0d6efd', backgroundColor: 'rgba(13, 110, 253, 0.1)', fill: true, tension: 0.3 },
                { label: 'Concluídos', data: dados.map((d) => d.concluidos), borderColor: '#198754', backgroundColor: 'rgba(25, 135, 84, 0.08)', fill: true, tension: 0.3 }
            ]
        },
        options: {
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

function renderizarStatus(dados) {
    const comValor = dados.filter((d) => d.total > 0);
    desenharGrafico('status', {
        type: 'doughnut',
        data: {
            labels: comValor.map((d) => d.label),
            datasets: [{ data: comValor.map((d) => d.total), backgroundColor: comValor.map((d) => CORES_STATUS[d.valor]) }]
        },
        options: {
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: { position: 'right' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            return ` ${ctx.label}: ${ctx.raw} (${fmt.percentual((ctx.raw / total) * 100)})`;
                        }
                    }
                }
            }
        }
    });
}

function renderizarPrioridade(dados) {
    desenharGrafico('prioridade', {
        type: 'bar',
        data: {
            labels: dados.map((d) => `${d.label} (SLA ${d.slaHoras}h)`),
            datasets: [
                { label: 'Total', data: dados.map((d) => d.total), backgroundColor: dados.map((d) => CORES_PRIORIDADE[d.valor]) },
                { label: 'Pendentes', data: dados.map((d) => d.pendentes), backgroundColor: '#ffda6a' },
                { label: 'Atrasados', data: dados.map((d) => d.atrasados), backgroundColor: '#dc3545' }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

function renderizarTipos(dados) {
    // guardado no estado porque o tooltip é criado uma vez só e precisa dos dados atuais
    estado.tipos = dados;
    desenharGrafico('tipos', {
        type: 'bar',
        data: {
            labels: dados.map((d) => d.tipo),
            datasets: [
                { label: 'Atendidos', data: dados.map((d) => d.atendidos), backgroundColor: '#0d6efd' },
                { label: 'Pendentes', data: dados.map((d) => d.pendentes), backgroundColor: '#ffc107' }
            ]
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        afterBody: (itens) => {
                            const tipo = estado.tipos[itens[0].dataIndex];
                            return `Participação: ${fmt.percentual(tipo.participacao)}\nTempo médio: ${fmt.horas(tipo.tempoMedioHoras)}`;
                        }
                    }
                }
            },
            scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true } }
        }
    });
}

function renderizarTecnicos(dados) {
    const corpo = $('tabela-tecnicos');
    if (!dados.length) {
        corpo.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Nenhum dado para os filtros selecionados</td></tr>';
        return;
    }
    corpo.innerHTML = dados.map((t) => `
        <tr>
            <td>${fmt.escapar(t.tecnico)}</td>
            <td class="text-end">${fmt.numero(t.atendidos)}</td>
            <td class="text-end">${fmt.numero(t.pendentes)}</td>
            <td class="text-end">${t.atendidos ? fmt.percentual(t.percentualNoPrazo) : '-'}</td>
            <td class="text-end">${fmt.horas(t.tempoMedioHoras)}</td>
        </tr>`).join('');
}

/* ================= Lista de chamados ================= */

const labelStatus = (v) => (estado.opcoes.status.find((s) => s.valor === v) || {}).label || v || '-';
const labelPrioridade = (v) => ({ BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' }[v] || v || '-');

const badgeStatus = (v) => `<span class="badge status-${v}">${labelStatus(v)}</span>`;
const badgePrioridade = (v) => `<span class="badge prioridade-${v}">${labelPrioridade(v)}</span>`;

async function carregarChamados() {
    const resposta = await api.chamados({ ...estado.filtros, pagina: estado.pagina, tamanho: 10 });
    const corpo = $('tabela-chamados');

    if (!resposta.dados.length) {
        corpo.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Nenhum chamado encontrado</td></tr>';
    } else {
        corpo.innerHTML = resposta.dados.map((c) => `
            <tr data-id="${c.id}">
                <td>${fmt.escapar(c.descricao)}</td>
                <td>${fmt.escapar(c.tipo)}</td>
                <td>${badgePrioridade(c.prioridade)}</td>
                <td>${badgeStatus(c.status)}</td>
                <td>${c.tecnico ? fmt.escapar(c.tecnico) : '<span class="text-muted">Não atribuído</span>'}</td>
                <td>${fmt.escapar(c.usuario)}</td>
                <td class="text-nowrap">${fmt.dataHora(c.dataAbertura)}</td>
                <td class="text-end text-nowrap ${c.foraDoPrazo ? 'atrasado' : ''}">${fmt.horas(c.horasDecorridas)}</td>
            </tr>`).join('');
    }

    const inicio = resposta.total ? (resposta.pagina - 1) * resposta.tamanho + 1 : 0;
    const fim = Math.min(resposta.pagina * resposta.tamanho, resposta.total);
    $('info-paginacao').textContent = `Mostrando ${inicio}-${fim} de ${fmt.numero(resposta.total)} chamados`;
    $('pag-anterior').disabled = resposta.pagina <= 1;
    $('pag-proxima').disabled = resposta.pagina >= resposta.totalPaginas;
}

/* ================= Carregamento geral (RF06 / RF07) ================= */

async function carregarDashboard() {
    const f = estado.filtros;
    $('content').classList.add('carregando');

    try {
        // as consultas são independentes, então rodam em paralelo
        const [indicadores, periodo, status, prioridade, tipos, tecnicos] = await Promise.all([
            api.indicadores(f),
            api.porPeriodo(f, $('agrupamento').value),
            api.porStatus(f),
            api.porPrioridade(f),
            api.porTipo(f),
            api.porTecnico(f)
        ]);

        renderizarIndicadores(indicadores);
        renderizarPeriodo(periodo);
        renderizarStatus(status);
        renderizarPrioridade(prioridade);
        renderizarTipos(tipos);
        renderizarTecnicos(tecnicos);
        await carregarChamados();

        $('ultima-atualizacao').textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR');
    } catch (erro) {
        mostrarAlerta(erro.message);
    } finally {
        $('content').classList.remove('carregando');
    }
}

function configurarAtualizacaoAutomatica() {
    clearInterval(estado.timer);
    if ($('auto-atualizar').checked) {
        estado.timer = setInterval(() => {
            // não atualiza enquanto o detalhe de um chamado está aberto
            if (!$('modal-chamado').classList.contains('show')) {
                carregarDashboard();
            }
        }, INTERVALO_ATUALIZACAO);
    }
}

/* ================= Detalhe do chamado ================= */

async function abrirChamado(id) {
    let c;
    try {
        c = await api.chamado(id);
    } catch (erro) {
        mostrarAlerta(erro.message);
        return;
    }

    $('modal-titulo').textContent = c.descricao || 'Chamado';

    const consideracoes = c.consideracoes && c.consideracoes.length
        ? `<ul class="linha-tempo">${c.consideracoes.map((n) => `
            <li>
                <small class="text-muted d-block">${fmt.dataHora(n.data)} · ${fmt.escapar(n.tecnico || 'Sem técnico')}</small>
                ${fmt.escapar(n.texto)}
            </li>`).join('')}</ul>`
        : '<p class="text-muted">Nenhuma consideração registrada.</p>';

    const opcoesStatus = estado.opcoes.status
        .map((s) => `<option value="${s.valor}" ${s.valor === c.status ? 'selected' : ''}>${s.label}</option>`).join('');
    const opcoesTecnico = ['<option value="">Não atribuído</option>']
        .concat(estado.opcoes.tecnicos.map((t) => `<option ${t === c.tecnico ? 'selected' : ''}>${fmt.escapar(t)}</option>`)).join('');

    $('modal-corpo').innerHTML = `
        <div class="row g-3 mb-3">
            <div class="col-6 col-md-4"><small class="text-muted d-block">Status</small>${badgeStatus(c.status)}</div>
            <div class="col-6 col-md-4"><small class="text-muted d-block">Prioridade</small>${badgePrioridade(c.prioridade)}</div>
            <div class="col-6 col-md-4"><small class="text-muted d-block">Tipo</small>${fmt.escapar(c.tipo)}</div>
            <div class="col-6 col-md-4"><small class="text-muted d-block">Usuário</small>${fmt.escapar(c.usuario)}</div>
            <div class="col-6 col-md-4"><small class="text-muted d-block">Técnico</small>${fmt.escapar(c.tecnico || 'Não atribuído')}</div>
            <div class="col-6 col-md-4"><small class="text-muted d-block">Tempo / SLA</small>
                <span class="${c.foraDoPrazo ? 'atrasado' : ''}">${fmt.horas(c.horasDecorridas)}</span>
            </div>
            <div class="col-6 col-md-4"><small class="text-muted d-block">Abertura</small>${fmt.dataHora(c.dataAbertura)}</div>
            <div class="col-6 col-md-4"><small class="text-muted d-block">Fechamento</small>${fmt.dataHora(c.dataFechamento)}</div>
        </div>

        <h6>Atualizar chamado</h6>
        <form id="form-status" class="row g-2 mb-4">
            <div class="col-md-5"><select class="form-select form-select-sm" name="status">${opcoesStatus}</select></div>
            <div class="col-md-5"><select class="form-select form-select-sm" name="tecnico">${opcoesTecnico}</select></div>
            <div class="col-md-2 d-grid"><button class="btn btn-sm btn-primary">Salvar</button></div>
        </form>

        <h6>Considerações técnicas</h6>
        ${consideracoes}
        <form id="form-consideracao">
            <textarea class="form-control form-control-sm mb-2" name="texto" rows="3" maxlength="1000"
                      placeholder="Registrar uma nova consideração técnica..." required></textarea>
            <button class="btn btn-sm btn-outline-primary">Registrar consideração</button>
        </form>`;

    $('form-status').addEventListener('submit', async (evento) => {
        evento.preventDefault();
        const dados = Object.fromEntries(new FormData(evento.target));
        try {
            await api.atualizarStatus(c.id, dados);
            mostrarAlerta('Chamado atualizado com sucesso.', 'success');
            await abrirChamado(c.id);
            carregarDashboard();
        } catch (erro) {
            mostrarAlerta(erro.message);
        }
    });

    $('form-consideracao').addEventListener('submit', async (evento) => {
        evento.preventDefault();
        const texto = evento.target.texto.value.trim();
        if (!texto) return;
        try {
            await api.adicionarConsideracao(c.id, { texto, tecnico: c.tecnico });
            await abrirChamado(c.id);
        } catch (erro) {
            mostrarAlerta(erro.message);
        }
    });

    bootstrap.Modal.getOrCreateInstance($('modal-chamado')).show();
}

/* ================= Eventos ================= */

function registrarEventos() {
    $('form-filtros').addEventListener('submit', (evento) => {
        evento.preventDefault();
        try {
            estado.filtros = lerFiltros();
        } catch (erro) {
            mostrarAlerta(erro.message);
            return;
        }
        estado.pagina = 1;
        carregarDashboard();
    });

    $('btn-limpar').addEventListener('click', () => {
        $('form-filtros').reset();
        definirPeriodo(90);
        estado.filtros = lerFiltros();
        estado.pagina = 1;
        carregarDashboard();
    });

    document.querySelectorAll('.atalho').forEach((botao) => {
        botao.addEventListener('click', () => {
            definirPeriodo(Number(botao.dataset.dias));
            $('form-filtros').requestSubmit();
        });
    });

    ['f-inicio', 'f-fim'].forEach((id) => $(id).addEventListener('change', () => {
        document.querySelectorAll('.atalho').forEach((b) => b.classList.remove('active'));
    }));

    $('agrupamento').addEventListener('change', async () => {
        try {
            renderizarPeriodo(await api.porPeriodo(estado.filtros, $('agrupamento').value));
        } catch (erro) {
            mostrarAlerta(erro.message);
        }
    });

    $('pag-anterior').addEventListener('click', () => {
        estado.pagina--;
        carregarChamados().catch((erro) => mostrarAlerta(erro.message));
    });
    $('pag-proxima').addEventListener('click', () => {
        estado.pagina++;
        carregarChamados().catch((erro) => mostrarAlerta(erro.message));
    });

    $('tabela-chamados').addEventListener('click', (evento) => {
        const linha = evento.target.closest('tr[data-id]');
        if (linha) abrirChamado(linha.dataset.id);
    });

    $('btn-atualizar').addEventListener('click', carregarDashboard);
    $('auto-atualizar').addEventListener('change', configurarAtualizacaoAutomatica);
}

/* ================= Início ================= */

async function iniciar() {
    Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    registrarEventos();

    try {
        estado.opcoes = await api.opcoes();
        preencherFiltros(estado.opcoes);
    } catch (erro) {
        mostrarAlerta(erro.message);
        $('ultima-atualizacao').textContent = 'Sem conexão com a API';
        return;
    }

    definirPeriodo(90);
    estado.filtros = lerFiltros();
    await carregarDashboard();
    configurarAtualizacaoAutomatica();
}

iniciar();
