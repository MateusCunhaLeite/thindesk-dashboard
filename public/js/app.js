// Lógica do dashboard: carrega os dados da API, desenha gráficos e tabelas

const INTERVALO_ATUALIZACAO = 60 * 1000;

const CORES_STATUS = {
  aberto: '#3b82f6',
  em_andamento: '#f59e0b',
  aguardando: '#8b5cf6',
  resolvido: '#10b981',
  fechado: '#6b7280',
  cancelado: '#ef4444',
};

const CORES_PRIORIDADE = {
  baixa: '#94a3b8',
  media: '#3b82f6',
  alta: '#f97316',
  critica: '#ef4444',
};

const estado = {
  opcoes: null,
  filtros: {},
  pagina: 1,
  busca: '',
  graficos: {},
  timer: null,
};

const $ = (id) => document.getElementById(id);

Chart.defaults.font.family = '"Segoe UI", Roboto, Arial, sans-serif';
Chart.defaults.color = '#6b7280';

/* ---------------- Mensagens ---------------- */

function mostrarAlerta(mensagem, tipo = 'erro') {
  const alerta = $('alerta');
  alerta.textContent = mensagem;
  alerta.className = `alerta ${tipo === 'sucesso' ? 'sucesso' : ''}`;
  clearTimeout(alerta.timer);
  alerta.timer = setTimeout(() => alerta.classList.add('oculto'), 6000);
}

function esconderAlerta() {
  $('alerta').classList.add('oculto');
}

/* ---------------- Filtros (RF05) ---------------- */

function preencherSelect(id, itens) {
  const select = $(id);
  itens.forEach(({ valor, texto }) => select.add(new Option(texto, valor)));
}

function preencherFiltros(opcoes) {
  preencherSelect('f-status', opcoes.status.map((s) => ({ valor: s.valor, texto: s.label })));
  preencherSelect('f-prioridade', opcoes.prioridades.map((p) => ({ valor: p.valor, texto: p.label })));
  preencherSelect('f-categoria', opcoes.categorias.map((c) => ({ valor: c.id, texto: c.nome })));
  preencherSelect('f-tecnico', opcoes.tecnicos.map((t) => ({ valor: t.id, texto: t.nome })));
  preencherSelect('f-setor', opcoes.setores.map((s) => ({ valor: s, texto: s })));
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
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - (dias - 1));
  $('f-inicio').value = fmt.diaISO(inicio);
  $('f-fim').value = fmt.diaISO(fim);

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('ativo', Number(chip.dataset.dias) === dias);
  });
}

/* ---------------- Indicadores (RF01) ---------------- */

function renderizarIndicadores(dados) {
  $('kpi-total').textContent = fmt.numero(dados.total);
  $('kpi-total-sub').textContent = `${fmt.numero(dados.cancelados)} cancelados`;

  $('kpi-pendentes').textContent = fmt.numero(dados.pendentes);
  $('kpi-pendentes-sub').textContent =
    `${dados.abertos} abertos · ${dados.emAndamento} em andamento · ${dados.aguardando} aguardando`;

  $('kpi-concluidos').textContent = fmt.numero(dados.concluidos);
  $('kpi-concluidos-sub').textContent = `Taxa de resolução: ${fmt.percentual(dados.taxaResolucao)}`;

  $('kpi-tempo').textContent = fmt.horas(dados.tempoMedioResolucaoHoras);

  $('kpi-sla').textContent = dados.concluidos ? fmt.percentual(dados.percentualNoPrazo) : '-';
  $('kpi-sla-sub').textContent = 'dos chamados concluídos';

  $('kpi-atrasados').textContent = fmt.numero(dados.atrasados);
  $('kpi-atrasados-sub').textContent = dados.semTecnico
    ? `${dados.semTecnico} pendente(s) sem técnico`
    : 'todos os pendentes têm técnico';
}

/* ---------------- Gráficos (RF02, RF03, RF04) ---------------- */

// Cria o gráfico na primeira vez e depois só atualiza os dados (evita "piscar")
function desenharGrafico(nome, config) {
  const existente = estado.graficos[nome];
  if (existente) {
    existente.data = config.data;
    existente.update();
    return;
  }
  estado.graficos[nome] = new Chart($(`grafico-${nome}`), config);
}

function renderizarPeriodo({ agrupamento, dados }) {
  desenharGrafico('periodo', {
    type: 'line',
    data: {
      labels: dados.map((d) => fmt.periodo(d.periodo, agrupamento)),
      datasets: [
        {
          label: 'Abertos',
          data: dados.map((d) => d.abertos),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.12)',
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Resolvidos',
          data: dados.map((d) => d.resolvidos),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function renderizarStatus(dados) {
  const comValor = dados.filter((d) => d.total > 0);
  desenharGrafico('status', {
    type: 'doughnut',
    data: {
      labels: comValor.map((d) => d.label),
      datasets: [
        {
          data: comValor.map((d) => d.total),
          backgroundColor: comValor.map((d) => CORES_STATUS[d.status]),
          borderWidth: 2,
        },
      ],
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
            },
          },
        },
      },
    },
  });
}

function renderizarPrioridade(dados) {
  desenharGrafico('prioridade', {
    type: 'bar',
    data: {
      labels: dados.map((d) => `${d.label} (SLA ${d.slaHoras}h)`),
      datasets: [
        {
          label: 'Total',
          data: dados.map((d) => d.total),
          backgroundColor: dados.map((d) => CORES_PRIORIDADE[d.prioridade]),
          borderRadius: 4,
        },
        {
          label: 'Pendentes',
          data: dados.map((d) => d.pendentes),
          backgroundColor: '#fcd34d',
          borderRadius: 4,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function renderizarCategorias(dados) {
  // guardado no estado porque o tooltip é criado só uma vez e precisa dos dados atuais
  estado.categorias = dados;
  desenharGrafico('categorias', {
    type: 'bar',
    data: {
      labels: dados.map((d) => d.nome),
      datasets: [
        {
          label: 'Atendidos',
          data: dados.map((d) => d.atendidos),
          backgroundColor: '#2563eb',
          borderRadius: 4,
        },
        {
          label: 'Pendentes',
          data: dados.map((d) => d.pendentes),
          backgroundColor: '#fbbf24',
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            afterBody: (itens) => {
              const cat = estado.categorias[itens[0].dataIndex];
              return `Participação: ${fmt.percentual(cat.participacao)}\nTempo médio: ${fmt.horas(cat.tempoMedioHoras)}`;
            },
          },
        },
      },
      scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true } },
    },
  });
}

function renderizarTecnicos(dados) {
  const corpo = $('tabela-tecnicos');
  if (!dados.length) {
    corpo.innerHTML = '<tr><td colspan="5" class="vazio">Nenhum dado para os filtros selecionados</td></tr>';
    return;
  }
  corpo.innerHTML = dados
    .map(
      (t) => `
      <tr>
        <td>${fmt.escapar(t.nome)}</td>
        <td class="num">${fmt.numero(t.atendidos)}</td>
        <td class="num">${fmt.numero(t.pendentes)}</td>
        <td class="num">${t.atendidos ? fmt.percentual(t.percentualNoPrazo) : '-'}</td>
        <td class="num">${fmt.horas(t.tempoMedioHoras)}</td>
      </tr>`
    )
    .join('');
}

/* ---------------- Lista de chamados ---------------- */

const labelStatus = (valor) => estado.opcoes.status.find((s) => s.valor === valor)?.label || valor;
const labelPrioridade = (valor) => estado.opcoes.prioridades.find((p) => p.valor === valor)?.label || valor;

const badgeStatus = (valor) => `<span class="badge status-${valor}">${labelStatus(valor)}</span>`;
const badgePrioridade = (valor) => `<span class="badge prioridade-${valor}">${labelPrioridade(valor)}</span>`;

async function carregarChamados() {
  const resposta = await api.chamados({
    ...estado.filtros,
    busca: estado.busca,
    pagina: estado.pagina,
    limite: 10,
  });

  const corpo = $('tabela-chamados');
  if (!resposta.dados.length) {
    corpo.innerHTML = '<tr><td colspan="8" class="vazio">Nenhum chamado encontrado</td></tr>';
  } else {
    corpo.innerHTML = resposta.dados
      .map(
        (c) => `
        <tr data-id="${c.id}">
          <td>#${c.id}</td>
          <td class="titulo">${fmt.escapar(c.titulo)}<br><small class="texto-suave">${fmt.escapar(c.solicitante)} · ${fmt.escapar(c.setor)}</small></td>
          <td>${fmt.escapar(c.categoria)}</td>
          <td>${badgePrioridade(c.prioridade)}</td>
          <td>${badgeStatus(c.status)}</td>
          <td>${c.tecnico ? fmt.escapar(c.tecnico) : '<span class="texto-suave">Não atribuído</span>'}</td>
          <td>${fmt.dataHora(c.data_abertura)}</td>
          <td class="num ${c.foraDoPrazo ? 'atrasado' : ''}" title="SLA: ${c.sla_horas}h">${fmt.horas(c.horas_decorridas)}</td>
        </tr>`
      )
      .join('');
  }

  const inicio = resposta.total ? (resposta.pagina - 1) * resposta.limite + 1 : 0;
  const fim = Math.min(resposta.pagina * resposta.limite, resposta.total);
  $('info-paginacao').textContent = `Mostrando ${inicio}-${fim} de ${fmt.numero(resposta.total)} chamados`;
  $('pag-anterior').disabled = resposta.pagina <= 1;
  $('pag-proxima').disabled = resposta.pagina >= resposta.totalPaginas;
}

/* ---------------- Carregamento geral (RF06 / RF07) ---------------- */

async function carregarDashboard() {
  const filtros = estado.filtros;
  $('conteudo').classList.add('carregando');

  try {
    const [indicadores, periodo, status, prioridade, categorias, tecnicos] = await Promise.all([
      api.indicadores(filtros),
      api.porPeriodo(filtros, $('agrupamento').value),
      api.porStatus(filtros),
      api.porPrioridade(filtros),
      api.porCategoria(filtros),
      api.porTecnico(filtros),
    ]);

    renderizarIndicadores(indicadores);
    renderizarPeriodo(periodo);
    renderizarStatus(status);
    renderizarPrioridade(prioridade);
    renderizarCategorias(categorias);
    renderizarTecnicos(tecnicos);
    await carregarChamados();

    $('ultima-atualizacao').textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
  } catch (erro) {
    mostrarAlerta(erro.message);
  } finally {
    $('conteudo').classList.remove('carregando');
  }
}

function configurarAtualizacaoAutomatica() {
  clearInterval(estado.timer);
  if ($('auto-atualizar').checked) {
    estado.timer = setInterval(() => {
      // não atualiza enquanto o usuário está com um chamado aberto
      if (!$('modal-chamado').open) carregarDashboard();
    }, INTERVALO_ATUALIZACAO);
  }
}

/* ---------------- Modal de detalhe ---------------- */

function opcoesSelect(itens, selecionado) {
  return itens
    .map((i) => `<option value="${i.valor}" ${String(i.valor) === String(selecionado) ? 'selected' : ''}>${fmt.escapar(i.texto)}</option>`)
    .join('');
}

async function abrirChamado(id) {
  let c;
  try {
    c = await api.chamado(id);
  } catch (erro) {
    mostrarAlerta(erro.message);
    return;
  }

  $('modal-titulo').textContent = `#${c.id} - ${c.titulo}`;

  const consideracoes = c.consideracoes.length
    ? `<ul class="linha-tempo">${c.consideracoes
        .map(
          (n) => `<li><small>${fmt.dataHora(n.data_registro)} · ${fmt.escapar(n.tecnico || 'Sistema')}</small>${fmt.escapar(n.texto)}</li>`
        )
        .join('')}</ul>`
    : '<p class="texto-suave">Nenhuma consideração registrada.</p>';

  const statusOpcoes = estado.opcoes.status.map((s) => ({ valor: s.valor, texto: s.label }));
  const tecnicoOpcoes = [{ valor: '', texto: 'Não atribuído' }].concat(
    estado.opcoes.tecnicos.map((t) => ({ valor: t.id, texto: t.nome }))
  );

  $('modal-corpo').innerHTML = `
    <dl class="detalhes">
      <div><dt>Status</dt><dd>${badgeStatus(c.status)}</dd></div>
      <div><dt>Prioridade</dt><dd>${badgePrioridade(c.prioridade)}</dd></div>
      <div><dt>Tipo</dt><dd>${fmt.escapar(c.categoria)}</dd></div>
      <div><dt>Solicitante</dt><dd>${fmt.escapar(c.solicitante)}</dd></div>
      <div><dt>Setor</dt><dd>${fmt.escapar(c.setor)}</dd></div>
      <div><dt>Técnico</dt><dd>${fmt.escapar(c.tecnico || 'Não atribuído')}</dd></div>
      <div><dt>Abertura</dt><dd>${fmt.dataHora(c.data_abertura)}</dd></div>
      <div><dt>Fechamento</dt><dd>${fmt.dataHora(c.data_fechamento)}</dd></div>
      <div><dt>Tempo / SLA</dt><dd class="${c.foraDoPrazo ? 'atrasado' : ''}">${fmt.horas(c.horas_decorridas)} / ${c.sla_horas}h</dd></div>
    </dl>

    <div class="descricao">${fmt.escapar(c.descricao || 'Sem descrição.')}</div>

    <div class="secao-modal">
      <h4>Atualizar chamado</h4>
      <form id="form-atualizar" class="form-linha">
        <select name="status" aria-label="Status">${opcoesSelect(statusOpcoes, c.status)}</select>
        <select name="tecnico_id" aria-label="Técnico">${opcoesSelect(tecnicoOpcoes, c.tecnico_id ?? '')}</select>
        <button type="submit" class="btn btn-primario">Salvar</button>
      </form>
    </div>

    <div class="secao-modal">
      <h4>Considerações técnicas</h4>
      ${consideracoes}
      <form id="form-consideracao">
        <textarea name="texto" maxlength="1000" placeholder="Registrar uma nova consideração..." required></textarea>
        <button type="submit" class="btn">Registrar consideração</button>
      </form>
    </div>
  `;

  $('form-atualizar').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(evento.target));
    try {
      await api.atualizarChamado(c.id, {
        status: dados.status,
        tecnico_id: dados.tecnico_id ? Number(dados.tecnico_id) : null,
      });
      mostrarAlerta(`Chamado #${c.id} atualizado.`, 'sucesso');
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
      await api.adicionarConsideracao(c.id, { texto, tecnico_id: c.tecnico_id });
      await abrirChamado(c.id);
    } catch (erro) {
      mostrarAlerta(erro.message);
    }
  });

  if (!$('modal-chamado').open) $('modal-chamado').showModal();
}

/* ---------------- Eventos ---------------- */

function registrarEventos() {
  $('form-filtros').addEventListener('submit', (evento) => {
    evento.preventDefault();
    try {
      estado.filtros = lerFiltros();
    } catch (erro) {
      mostrarAlerta(erro.message);
      return;
    }
    esconderAlerta();
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

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      definirPeriodo(Number(chip.dataset.dias));
      $('form-filtros').requestSubmit();
    });
  });

  // se o usuário mudar a data na mão, o atalho deixa de estar marcado
  ['f-inicio', 'f-fim'].forEach((id) =>
    $(id).addEventListener('change', () => document.querySelectorAll('.chip').forEach((c) => c.classList.remove('ativo')))
  );

  $('agrupamento').addEventListener('change', async () => {
    try {
      renderizarPeriodo(await api.porPeriodo(estado.filtros, $('agrupamento').value));
    } catch (erro) {
      mostrarAlerta(erro.message);
    }
  });

  let esperaBusca;
  $('busca').addEventListener('input', (evento) => {
    clearTimeout(esperaBusca);
    esperaBusca = setTimeout(() => {
      estado.busca = evento.target.value.trim();
      estado.pagina = 1;
      carregarChamados().catch((erro) => mostrarAlerta(erro.message));
    }, 350);
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

  $('modal-fechar').addEventListener('click', () => $('modal-chamado').close());
  $('btn-atualizar').addEventListener('click', carregarDashboard);
  $('auto-atualizar').addEventListener('change', configurarAtualizacaoAutomatica);
}

/* ---------------- Inicialização ---------------- */

async function iniciar() {
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
