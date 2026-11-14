const { STATUS, PRIORIDADES, SETORES } = require('../constantes');
const { dataValida } = require('./datas');
const { ErroValidacao } = require('./erros');

function inteiroPositivo(valor, nome) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ErroValidacao(`O parâmetro "${nome}" deve ser um número inteiro positivo`);
  }
  return numero;
}

// Permite receber mais de um valor separado por vírgula (ex: status=aberto,em_andamento)
function listaValores(valor, permitidos, nome) {
  const lista = String(valor)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  const invalidos = lista.filter((v) => !permitidos.includes(v));
  if (invalidos.length) {
    throw new ErroValidacao(`Valor inválido para "${nome}": ${invalidos.join(', ')}`);
  }
  return lista;
}

/**
 * Monta a cláusula WHERE a partir da query string.
 * Todos os endpoints do dashboard e a listagem usam essa mesma função,
 * assim os filtros funcionam igual em todo lugar.
 *
 * Filtros aceitos: inicio, fim, status, categoria, tecnico, prioridade, setor, busca
 */
function montarFiltros(query = {}, { colunaData = 'c.data_abertura' } = {}) {
  const condicoes = [];
  const params = {};

  const { inicio, fim, status, categoria, tecnico, prioridade, setor, busca } = query;

  if (inicio) {
    if (!dataValida(inicio)) throw new ErroValidacao('Data inicial inválida. Use o formato AAAA-MM-DD');
    condicoes.push(`${colunaData} >= :inicio`);
    params.inicio = inicio;
  }

  if (fim) {
    if (!dataValida(fim)) throw new ErroValidacao('Data final inválida. Use o formato AAAA-MM-DD');
    // soma 1 dia para incluir o dia final inteiro
    condicoes.push(`${colunaData} < date(:fim, '+1 day')`);
    params.fim = fim;
  }

  if (inicio && fim && inicio > fim) {
    throw new ErroValidacao('A data inicial não pode ser maior que a data final');
  }

  if (status) {
    const lista = listaValores(status, Object.keys(STATUS), 'status');
    const marcadores = lista.map((valor, i) => {
      params[`status${i}`] = valor;
      return `:status${i}`;
    });
    condicoes.push(`c.status IN (${marcadores.join(', ')})`);
  }

  if (prioridade) {
    const lista = listaValores(prioridade, Object.keys(PRIORIDADES), 'prioridade');
    const marcadores = lista.map((valor, i) => {
      params[`prioridade${i}`] = valor;
      return `:prioridade${i}`;
    });
    condicoes.push(`c.prioridade IN (${marcadores.join(', ')})`);
  }

  if (categoria) {
    condicoes.push('c.categoria_id = :categoria');
    params.categoria = inteiroPositivo(categoria, 'categoria');
  }

  if (tecnico) {
    condicoes.push('c.tecnico_id = :tecnico');
    params.tecnico = inteiroPositivo(tecnico, 'tecnico');
  }

  if (setor) {
    if (!SETORES.includes(setor)) throw new ErroValidacao(`Setor inválido: ${setor}`);
    condicoes.push('c.setor = :setor');
    params.setor = setor;
  }

  if (busca && String(busca).trim()) {
    const texto = String(busca).trim().slice(0, 100);
    condicoes.push('(c.titulo LIKE :busca OR c.solicitante LIKE :busca OR CAST(c.id AS TEXT) = :buscaId)');
    params.busca = `%${texto}%`;
    params.buscaId = texto.replace('#', '');
  }

  return {
    where: condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '',
    params,
  };
}

module.exports = { montarFiltros, inteiroPositivo };
