// Gera dados de exemplo para o Thindesk.
// As datas são calculadas a partir de "hoje", então o dashboard sempre tem
// chamados recentes. A semente fixa faz o resultado ser sempre o mesmo.

const { formatarData } = require('./utils/datas');
const { PRIORIDADES, SETORES } = require('./constantes');

const CATEGORIAS = [
  {
    nome: 'Acesso e senhas',
    peso: 20,
    titulos: [
      'Reset de senha do AD',
      'Usuário bloqueado após várias tentativas',
      'Liberação de acesso a pasta da rede',
      'Criação de usuário para novo colaborador',
      'Acesso ao sistema de ponto negado',
    ],
    notas: [
      'Senha redefinida e usuário orientado a trocar no primeiro acesso.',
      'Conta desbloqueada no AD.',
      'Permissão concedida após aprovação do gestor do setor.',
    ],
  },
  {
    nome: 'Hardware',
    peso: 16,
    titulos: [
      'Computador não liga',
      'Monitor piscando',
      'Teclado com teclas falhando',
      'Notebook superaquecendo',
      'Mouse sem resposta',
    ],
    notas: [
      'Equipamento verificado no local, problema na fonte.',
      'Periférico substituído por um do estoque.',
      'Feita limpeza interna e troca da pasta térmica.',
    ],
  },
  {
    nome: 'Software',
    peso: 15,
    titulos: [
      'Erro ao abrir o Excel',
      'Instalação do Adobe Reader',
      'Atualização do Windows travada',
      'Antivírus bloqueando aplicação',
      'Programa fechando sozinho',
    ],
    notas: [
      'Reinstalado o pacote Office e reparado o perfil do usuário.',
      'Software instalado via acesso remoto.',
      'Adicionada exceção no antivírus após validação.',
    ],
  },
  {
    nome: 'Rede e internet',
    peso: 13,
    titulos: [
      'Sem acesso à internet',
      'Wi-Fi caindo constantemente',
      'Lentidão na rede',
      'Pasta compartilhada inacessível',
      'Ponto de rede sem sinal',
    ],
    notas: [
      'Cabo de rede substituído.',
      'Reiniciado o access point do andar.',
      'Porta do switch estava desabilitada, reativada.',
    ],
  },
  {
    nome: 'Impressoras',
    peso: 11,
    titulos: [
      'Impressora não imprime',
      'Papel atolando com frequência',
      'Instalar impressora de rede',
      'Impressão saindo borrada',
    ],
    notas: [
      'Fila de impressão limpa e serviço de spooler reiniciado.',
      'Toner substituído.',
      'Driver da impressora reinstalado.',
    ],
  },
  {
    nome: 'E-mail',
    peso: 10,
    titulos: [
      'Caixa de e-mail cheia',
      'Não recebe e-mails externos',
      'Outlook não sincroniza',
      'Configurar assinatura de e-mail',
    ],
    notas: [
      'Arquivados e-mails antigos para liberar espaço.',
      'Perfil do Outlook recriado.',
      'Regra de spam ajustada no servidor.',
    ],
  },
  {
    nome: 'Sistemas internos (ERP)',
    peso: 10,
    titulos: [
      'Erro ao emitir nota fiscal',
      'Relatório não carrega no ERP',
      'Lentidão no módulo de vendas',
      'Divergência no estoque do sistema',
    ],
    notas: [
      'Chamado aberto com o suporte do fornecedor do ERP.',
      'Cache do sistema limpo e sessão reiniciada.',
      'Ajustado cadastro que estava gerando o erro.',
    ],
  },
  {
    nome: 'Telefonia',
    peso: 5,
    titulos: ['Ramal mudo', 'Configurar ramal para novo colaborador', 'Telefone IP sem registro'],
    notas: ['Aparelho reconfigurado no PABX.', 'Ramal criado e testado com o usuário.'],
  },
];

const TECNICOS = [
  { nome: 'Carlos Mendes', email: 'carlos.mendes@thindesk.com' },
  { nome: 'Juliana Rocha', email: 'juliana.rocha@thindesk.com' },
  { nome: 'Rafael Souza', email: 'rafael.souza@thindesk.com' },
  { nome: 'Patrícia Lima', email: 'patricia.lima@thindesk.com' },
  { nome: 'Bruno Alves', email: 'bruno.alves@thindesk.com' },
];

const SOLICITANTES = [
  'Ana Paula Ferreira', 'Marcos Vinícius', 'Fernanda Costa', 'João Pedro Martins',
  'Luciana Ribeiro', 'Ricardo Gomes', 'Camila Barbosa', 'Diego Santos',
  'Beatriz Oliveira', 'Gustavo Pereira', 'Renata Carvalho', 'Thiago Nunes',
  'Aline Moreira', 'Eduardo Teixeira', 'Vanessa Duarte', 'Felipe Araújo',
  'Mariana Lopes', 'André Cardoso', 'Simone Rezende', 'Leonardo Batista',
];

const DETALHES = [
  'O problema começou hoje pela manhã.',
  'Já tentou reiniciar o computador, sem sucesso.',
  'Está impedindo a execução das atividades do setor.',
  'Ocorre de forma intermitente desde a semana passada.',
  'Outros colegas do setor relatam o mesmo problema.',
  '',
];

const NOTAS_INICIO = [
  'Chamado recebido, iniciando análise.',
  'Contato realizado com o usuário para entender o problema.',
  'Acesso remoto realizado para diagnóstico.',
];

const NOTAS_AGUARDANDO = [
  'Aguardando retorno do usuário para validar.',
  'Usuário não estava no local, aguardando novo horário.',
  'Aguardando aprovação do gestor.',
];

const NOTAS_CONCLUSAO = [
  'Problema resolvido, usuário confirmou o funcionamento.',
  'Solução aplicada e testada junto ao usuário.',
  'Atendimento concluído.',
];

// Gerador pseudoaleatório simples (mulberry32) para ter sempre os mesmos dados
function criarAleatorio(semente) {
  let a = semente;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

function popularBanco(db, { quantidade = 450, dias = 180, semente = 2026 } = {}) {
  const rand = criarAleatorio(semente);
  const escolher = (lista) => lista[Math.floor(rand() * lista.length)];
  const escolherComPeso = (pares) => {
    const total = pares.reduce((soma, [, peso]) => soma + peso, 0);
    let sorteio = rand() * total;
    for (const [valor, peso] of pares) {
      sorteio -= peso;
      if (sorteio <= 0) return valor;
    }
    return pares[pares.length - 1][0];
  };

  const inserirCategoria = db.prepare('INSERT INTO categorias (nome) VALUES (?)');
  const inserirTecnico = db.prepare('INSERT INTO tecnicos (nome, email) VALUES (?, ?)');
  const inserirChamado = db.prepare(`
    INSERT INTO chamados
      (titulo, descricao, categoria_id, prioridade, status, solicitante, setor,
       tecnico_id, data_abertura, data_atualizacao, data_fechamento)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const inserirConsideracao = db.prepare(
    'INSERT INTO consideracoes (chamado_id, tecnico_id, texto, data_registro) VALUES (?, ?, ?, ?)'
  );

  const agora = Date.now();

  db.exec('BEGIN');
  try {
    const categorias = CATEGORIAS.map((cat) => ({
      ...cat,
      id: Number(inserirCategoria.run(cat.nome).lastInsertRowid),
    }));
    const tecnicos = TECNICOS.map((t) => Number(inserirTecnico.run(t.nome, t.email).lastInsertRowid));

    // dados ordenados por data de abertura para os IDs ficarem em ordem cronológica
    const aberturas = [];
    for (let i = 0; i < quantidade; i++) {
      // potência > 1 concentra mais chamados nos meses recentes (simula crescimento da demanda)
      const diasAtras = Math.pow(rand(), 1.25) * dias;
      const data = new Date(agora - diasAtras * DIA);

      // a maior parte dos chamados é aberta em dia útil
      if ((data.getDay() === 0 || data.getDay() === 6) && rand() < 0.85) {
        data.setDate(data.getDate() - (data.getDay() === 0 ? 2 : 1));
      }
      data.setHours(8 + Math.floor(rand() * 10), Math.floor(rand() * 60), Math.floor(rand() * 60));
      if (data.getTime() > agora) data.setTime(agora - rand() * 3 * HORA);

      aberturas.push(data);
    }
    aberturas.sort((a, b) => a - b);

    for (const abertura of aberturas) {
      const categoria = escolherComPeso(categorias.map((c) => [c, c.peso]));
      const prioridade = escolherComPeso([['baixa', 30], ['media', 40], ['alta', 22], ['critica', 8]]);
      const sla = PRIORIDADES[prioridade].slaHoras;
      const titulo = escolher(categoria.titulos);
      const descricao = `${titulo}. ${escolher(DETALHES)}`.trim();
      const idadeHoras = (agora - abertura.getTime()) / HORA;

      // ~80% resolvidos dentro do SLA, o restante passa do prazo
      const horasResolucao = sla * (rand() < 0.8 ? 0.1 + rand() * 0.85 : 1.05 + rand() * 1.5);

      let status;
      let fechamento = null;

      if (rand() < 0.04) {
        status = 'cancelado';
        fechamento = new Date(abertura.getTime() + Math.min(idadeHoras, 2) * rand() * HORA);
      } else if (horasResolucao < idadeHoras && !(idadeHoras < 30 * 24 && rand() < 0.1)) {
        status = idadeHoras > 7 * 24 && rand() < 0.85 ? 'fechado' : 'resolvido';
        fechamento = new Date(abertura.getTime() + horasResolucao * HORA);
      } else if (idadeHoras < 2) {
        status = 'aberto';
      } else {
        status = escolherComPeso([['aberto', 25], ['em_andamento', 50], ['aguardando', 25]]);
      }

      const tecnicoId = status === 'aberto' && rand() < 0.6 ? null : escolher(tecnicos);
      const setor = escolher(SETORES);

      // registra considerações técnicas ao longo do atendimento
      const notas = [];
      if (tecnicoId) {
        const fim = fechamento ? fechamento.getTime() : agora;
        const duracao = fim - abertura.getTime();
        notas.push({ texto: escolher(NOTAS_INICIO), momento: abertura.getTime() + duracao * 0.1 });

        if (status === 'aguardando') {
          notas.push({ texto: escolher(NOTAS_AGUARDANDO), momento: abertura.getTime() + duracao * 0.6 });
        } else if (status === 'resolvido' || status === 'fechado') {
          if (rand() < 0.6) {
            notas.push({ texto: escolher(categoria.notas), momento: abertura.getTime() + duracao * 0.7 });
          }
          notas.push({ texto: escolher(NOTAS_CONCLUSAO), momento: fim });
        } else if (status === 'em_andamento' && rand() < 0.5) {
          notas.push({ texto: escolher(categoria.notas), momento: abertura.getTime() + duracao * 0.5 });
        }
      }

      const ultimaAtualizacao = fechamento
        ? fechamento
        : new Date(notas.length ? notas[notas.length - 1].momento : abertura.getTime());

      const { lastInsertRowid } = inserirChamado.run(
        titulo,
        descricao,
        categoria.id,
        prioridade,
        status,
        escolher(SOLICITANTES),
        setor,
        tecnicoId,
        formatarData(abertura),
        formatarData(ultimaAtualizacao),
        fechamento ? formatarData(fechamento) : null
      );

      for (const nota of notas) {
        inserirConsideracao.run(lastInsertRowid, tecnicoId, nota.texto, formatarData(new Date(nota.momento)));
      }
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { popularBanco };

// Execução direta: npm run seed (apaga o banco e gera de novo)
if (require.main === module) {
  const fs = require('node:fs');
  const { abrirBanco, CAMINHO_PADRAO } = require('./db');
  const caminho = process.env.DB_PATH || CAMINHO_PADRAO;

  if (process.argv.includes('--reset')) {
    fs.rmSync(caminho, { force: true });
  }

  const db = abrirBanco(caminho);
  const { qtd } = db.prepare('SELECT COUNT(*) AS qtd FROM chamados').get();
  console.log(`Banco pronto em ${caminho} com ${qtd} chamados.`);
  db.close();
}
