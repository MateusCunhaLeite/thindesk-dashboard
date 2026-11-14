// Comunicação com a API do Thindesk (RF06)
const api = (() => {
  const BASE = '/api';

  // remove filtros vazios para não mandar "status=&tecnico=" na URL
  function montarQuery(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([chave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') query.append(chave, valor);
    });
    const texto = query.toString();
    return texto ? `?${texto}` : '';
  }

  async function requisicao(caminho, opcoes = {}) {
    let resposta;
    try {
      resposta = await fetch(BASE + caminho, {
        headers: { 'Content-Type': 'application/json' },
        ...opcoes,
      });
    } catch {
      throw new Error('Não foi possível conectar à API. Verifique se o servidor está rodando.');
    }

    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      throw new Error(corpo?.erro || `Erro ${resposta.status} ao consultar a API`);
    }
    return corpo;
  }

  const get = (caminho, params) => requisicao(caminho + montarQuery(params));
  const enviar = (metodo, caminho, dados) =>
    requisicao(caminho, { method: metodo, body: JSON.stringify(dados) });

  return {
    opcoes: () => get('/opcoes'),
    indicadores: (filtros) => get('/dashboard/indicadores', filtros),
    porPeriodo: (filtros, agrupamento) => get('/dashboard/por-periodo', { ...filtros, agrupamento }),
    porStatus: (filtros) => get('/dashboard/por-status', filtros),
    porPrioridade: (filtros) => get('/dashboard/por-prioridade', filtros),
    porCategoria: (filtros) => get('/dashboard/por-categoria', filtros),
    porTecnico: (filtros) => get('/dashboard/por-tecnico', filtros),
    chamados: (filtros) => get('/chamados', filtros),
    chamado: (id) => get(`/chamados/${id}`),
    atualizarChamado: (id, dados) => enviar('PATCH', `/chamados/${id}`, dados),
    adicionarConsideracao: (id, dados) => enviar('POST', `/chamados/${id}/consideracoes`, dados),
  };
})();
