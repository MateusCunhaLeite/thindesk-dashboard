# Thindesk - Dashboard Administrativo

Painel administrativo para acompanhar os chamados técnicos do Thindesk. O dashboard consome uma API REST
(também desenvolvida neste projeto) que disponibiliza indicadores, gráficos, rankings e a lista de chamados com filtros.

A ideia é que o responsável pelo suporte consiga ver rapidamente:

- quantos chamados existem e quantos ainda estão pendentes;
- como a demanda evoluiu ao longo do tempo (abertos x resolvidos);
- quais chamados estão fora do prazo (SLA);
- quais tipos de problema mais aparecem e como cada técnico está desempenhando;
- o histórico de considerações técnicas de cada chamado.

## Tecnologias

| Camada     | Tecnologia                                   |
|------------|----------------------------------------------|
| API        | Node.js + Express                            |
| Banco      | SQLite (módulo nativo `node:sqlite`)         |
| Front-end  | HTML, CSS e JavaScript puro + Chart.js       |
| Testes     | Test runner nativo do Node (`node --test`)   |

Optei por não usar framework no front-end para manter o projeto simples de rodar e de entender.
O SQLite nativo do Node evita ter que instalar e configurar um servidor de banco.

## Como executar

Pré-requisito: **Node.js 22.13 ou superior** (por causa do `node:sqlite`).

```bash
npm install
npm start
```

Depois é só acessar **http://localhost:3000**.

Na primeira execução o banco (`data/thindesk.db`) é criado automaticamente e populado com cerca de 450
chamados de exemplo distribuídos nos últimos 6 meses. As datas são geradas a partir do dia atual, então
o dashboard sempre tem dados recentes.

Outros comandos:

```bash
npm run dev    # reinicia o servidor ao salvar arquivos
npm run seed   # apaga o banco e gera os dados de exemplo de novo
npm test       # roda os testes da API
```

A porta pode ser alterada com a variável `PORT` e o caminho do banco com `DB_PATH`.

## Estrutura do projeto

```
thindesk-dashboard/
├── docs/
│   ├── api.md              # documentação dos endpoints
│   └── modelagem.md        # análise de requisitos, regras de negócio e modelo de dados
├── public/                 # front-end (servido pelo próprio Express)
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js          # chamadas para a API
│       ├── formatadores.js # formatação de números, datas e horas
│       └── app.js          # lógica do dashboard
├── src/
│   ├── server.js           # inicia o servidor
│   ├── app.js              # configuração do Express e rotas
│   ├── db.js               # conexão e criação das tabelas
│   ├── seed.js             # dados de exemplo
│   ├── constantes.js       # status, prioridades, SLA e setores
│   ├── routes/
│   │   ├── dashboard.js    # indicadores e dados dos gráficos
│   │   ├── chamados.js     # listagem, detalhe e atualização de chamados
│   │   └── opcoes.js       # valores para os filtros
│   └── utils/
│       ├── filtros.js      # monta o WHERE a partir dos filtros da URL
│       ├── datas.js
│       └── erros.js
└── test/
    └── api.test.js
```

## Requisitos atendidos

| Requisito | Como foi atendido |
|-----------|-------------------|
| **RF01** - Indicadores gerais | Cards com total, pendentes, concluídos, taxa de resolução, tempo médio de resolução, % resolvido dentro do SLA e pendentes fora do prazo. Endpoint `GET /api/dashboard/indicadores` |
| **RF02** - Chamados por período | Gráfico de linhas com abertos x resolvidos, agrupado por dia, semana ou mês. Endpoint `GET /api/dashboard/por-periodo` |
| **RF03** - Situação dos chamados | Gráfico de rosca por status e gráfico de barras por prioridade (com pendentes). Endpoints `por-status` e `por-prioridade` |
| **RF04** - Tipos mais atendidos | Ranking de categorias (atendidos e pendentes) e tabela de desempenho por técnico. Endpoints `por-categoria` e `por-tecnico` |
| **RF05** - Filtros | Período (com atalhos de 7/30/90/180 dias), status, tipo, prioridade, técnico e setor. Todos os endpoints aceitam os mesmos filtros. Na lista também há busca por texto |
| **RF06** - Integração com a API | O front-end busca todos os dados via `fetch` em `public/js/api.js`; nenhum dado fica fixo na tela |
| **RF07** - Atualização e tratamento | Atualização automática a cada 60s (pode desligar) e botão de atualizar; alteração de status/técnico e registro de considerações pelo modal do chamado; validação dos parâmetros na API (erro 400 com mensagem), tratamento de erro de conexão no front, valores nulos exibidos como "-", formatação de horas, datas e percentuais e preenchimento de períodos sem chamados no gráfico |

## API

Resumo dos endpoints (detalhes e exemplos em [docs/api.md](docs/api.md)):

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Verifica se a API está no ar |
| GET | `/api/opcoes` | Status, prioridades, categorias, técnicos e setores para os filtros |
| GET | `/api/dashboard/indicadores` | Indicadores gerais |
| GET | `/api/dashboard/por-periodo` | Abertos x resolvidos por dia/semana/mês |
| GET | `/api/dashboard/por-status` | Quantidade por status |
| GET | `/api/dashboard/por-prioridade` | Quantidade por prioridade |
| GET | `/api/dashboard/por-categoria` | Ranking dos tipos de chamado |
| GET | `/api/dashboard/por-tecnico` | Ranking dos técnicos |
| GET | `/api/chamados` | Lista paginada de chamados |
| GET | `/api/chamados/:id` | Detalhe do chamado com considerações técnicas |
| POST | `/api/chamados` | Abre um chamado |
| PATCH | `/api/chamados/:id` | Atualiza status, técnico ou prioridade |
| POST | `/api/chamados/:id/consideracoes` | Registra uma consideração técnica |

## Modelagem

A análise dos requisitos, as regras de negócio (SLA, ciclo de vida do chamado) e o diagrama do banco
estão em [docs/modelagem.md](docs/modelagem.md).

## Possíveis melhorias

- Autenticação para o acesso ao painel;
- Exportar os dados filtrados para CSV/Excel;
- Histórico completo de mudanças de status (hoje só a data de fechamento é registrada);
- Considerar apenas horário comercial no cálculo do SLA.
