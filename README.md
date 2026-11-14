# Thindesk - Dashboard Administrativo

Dashboard administrativo integrado ao sistema de chamados **Thindesk** (projeto base disponibilizado na disciplina,
feito com Spring Boot, MongoDB e Thymeleaf).

O painel permite que o responsável pelos chamados acompanhe o andamento do suporte: indicadores gerais, evolução
dos chamados ao longo do tempo, situação atual, tipos mais atendidos, desempenho dos técnicos e as considerações
técnicas de cada chamado. Todos os dados vêm de uma API REST que também foi desenvolvida neste trabalho.

## Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Back-end / API | Java 17, Spring Boot 3.4 (Web, Data MongoDB, Security) |
| Banco de dados | MongoDB |
| Páginas | Thymeleaf + Bootstrap 5 (mesmo layout do projeto base) |
| Gráficos | Chart.js |

## Como executar

Pré-requisitos:
- Java 17 ou superior
- MongoDB rodando localmente na porta padrão (27017)

```bash
./mvnw spring-boot:run
```

No Windows: `mvnw.cmd spring-boot:run` (ou pelo NetBeans, botão **Run**).

Depois acesse **http://localhost:8080/login** e entre com:

- usuário: `admin`
- senha: `thindesk`

O dashboard fica no menu lateral em **Dashboard** (`/dashboard`).

Na primeira execução, se a coleção `chamados` estiver vazia, o sistema gera automaticamente cerca de 450 chamados de
exemplo dos últimos 6 meses (e alguns clientes), para que os gráficos tenham dados. Isso pode ser desligado em
`application.properties` com `thindesk.dados-exemplo=false`.

Para usar outro MongoDB (por exemplo o Atlas), defina a variável de ambiente `MONGODB_URI` com a string de conexão.
Deixei a conexão fora do código para não expor usuário e senha do banco no repositório.

## O que foi feito

### Alterações no projeto base

- `Chamado` ganhou os campos `prioridade`, `dataAbertura`, `dataFechamento` e a lista de `consideracoes`;
  `status` passou a ser um enum (`StatusChamado`) para evitar valores diferentes para a mesma situação
  (antes existiam "Aberto" e "ABERTO", por exemplo).
- Novos enums `StatusChamado` e `Prioridade` (a prioridade guarda o SLA de cada nível).
- `ChamadoService` e `ChamadoController` ganharam busca por id, listagem paginada com filtros,
  atualização de status e registro de considerações.
- Nova página `dashboard.html` e item **Dashboard** no menu lateral.
- `pom.xml`: versão do Java ajustada para 17 e flag `-parameters` no compilador (sem ela o Spring não consegue
  ler os nomes dos `@PathVariable`/`@RequestParam`).
- `application.properties`: conexão do MongoDB configurável por variável de ambiente.

### Novas classes

```
src/main/java/com/pfc/thindesk/
├── config/DadosExemploConfig.java      # gera os dados de exemplo
├── controller/DashboardController.java # endpoints do dashboard
├── controller/ApiExceptionHandler.java # erros da API em JSON
├── dto/FiltroChamado.java              # filtros da query string -> consulta do MongoDB
├── dto/DashboardDTOs.java              # objetos de resposta (records)
├── entity/Consideracao.java
├── entity/Prioridade.java
├── entity/StatusChamado.java
└── service/DashboardService.java       # cálculo dos indicadores

src/main/resources/
├── templates/dashboard.html
├── static/css/dashboard.css
└── static/js/dashboard.js              # consome a API e monta os gráficos
```

## Requisitos atendidos

| Requisito | Como foi atendido |
|-----------|-------------------|
| **RF01** - Indicadores gerais | Cards com total, pendentes (abertos / em andamento / aguardando), concluídos, taxa de resolução, tempo médio de resolução, % resolvido dentro do SLA e pendentes fora do prazo |
| **RF02** - Chamados por período | Gráfico de linhas com abertos x concluídos, agrupado por dia, semana ou mês |
| **RF03** - Situação dos chamados | Gráfico de rosca por status e gráfico de barras por prioridade (total, pendentes e atrasados) |
| **RF04** - Tipos mais atendidos | Ranking dos tipos de chamado (atendidos e pendentes, com participação e tempo médio) e tabela de desempenho por técnico |
| **RF05** - Filtros | Período (com atalhos de 7/30/90/180 dias), status, tipo, prioridade e técnico. Os mesmos filtros valem para todos os endpoints |
| **RF06** - Integração com a API | A página não recebe dados pelo Thymeleaf: tudo é carregado via `fetch` dos endpoints `/api/dashboard/*` e `/api/chamados` |
| **RF07** - Atualização e tratamento | Atualização automática a cada 60s (pode desligar) e botão de atualizar; alteração de status/técnico e registro de considerações técnicas pelo detalhe do chamado; validação dos parâmetros na API com erro 400/404 em JSON; formatação de horas, datas e percentuais; períodos sem chamados preenchidos com zero no gráfico |

## Endpoints

Detalhes, parâmetros e exemplos de resposta em [docs/api.md](docs/api.md).

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/dashboard/opcoes` | Valores para os filtros (status, prioridades, tipos, técnicos) |
| GET | `/api/dashboard/indicadores` | Indicadores gerais |
| GET | `/api/dashboard/por-periodo` | Abertos x concluídos por dia/semana/mês |
| GET | `/api/dashboard/por-status` | Quantidade por status |
| GET | `/api/dashboard/por-prioridade` | Quantidade por prioridade, pendentes e atrasados |
| GET | `/api/dashboard/por-tipo` | Ranking dos tipos de chamado |
| GET | `/api/dashboard/por-tecnico` | Ranking dos técnicos |
| GET | `/api/chamados` | Lista paginada com filtros |
| GET | `/api/chamados/{id}` | Detalhe do chamado |
| POST | `/api/chamados` | Abre um chamado |
| PUT | `/api/chamados/{id}` | Atualiza o chamado (endpoint do projeto base) |
| PATCH | `/api/chamados/{id}/status` | Altera status e/ou técnico |
| POST | `/api/chamados/{id}/consideracoes` | Registra uma consideração técnica |

## Análise e modelagem

Atores, requisitos, regras de negócio (SLA, ciclo de vida do chamado) e o modelo de dados estão em
[docs/modelagem.md](docs/modelagem.md).
