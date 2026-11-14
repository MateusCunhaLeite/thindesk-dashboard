package com.pfc.thindesk.service;

import com.pfc.thindesk.dto.DashboardDTOs.Contagem;
import com.pfc.thindesk.dto.DashboardDTOs.Indicadores;
import com.pfc.thindesk.dto.DashboardDTOs.Opcao;
import com.pfc.thindesk.dto.DashboardDTOs.Opcoes;
import com.pfc.thindesk.dto.DashboardDTOs.Periodo;
import com.pfc.thindesk.dto.DashboardDTOs.RankingTecnico;
import com.pfc.thindesk.dto.DashboardDTOs.RankingTipo;
import com.pfc.thindesk.dto.DashboardDTOs.ResumoPrioridade;
import com.pfc.thindesk.dto.DashboardDTOs.SerieTemporal;
import com.pfc.thindesk.dto.FiltroChamado;
import com.pfc.thindesk.entity.Chamado;
import com.pfc.thindesk.entity.Prioridade;
import com.pfc.thindesk.entity.StatusChamado;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/**
 * Regras de cálculo dos indicadores do dashboard.
 * Os chamados são filtrados no MongoDB e os cálculos são feitos aqui com streams,
 * o que deixa o código mais fácil de ler e o volume de dados é pequeno.
 */
@Service
public class DashboardService {

    @Autowired
    private MongoTemplate mongoTemplate;

    public List<Chamado> buscar(FiltroChamado filtro) {
        return mongoTemplate.find(filtro.montarQuery("dataAbertura"), Chamado.class);
    }

    // RF01 - Indicadores gerais
    public Indicadores indicadores(FiltroChamado filtro) {
        List<Chamado> chamados = buscar(filtro);

        long total = chamados.size();
        long abertos = contar(chamados, c -> c.getStatus() == StatusChamado.ABERTO);
        long emAndamento = contar(chamados, c -> c.getStatus() == StatusChamado.EM_ANDAMENTO);
        long aguardando = contar(chamados, c -> c.getStatus() == StatusChamado.AGUARDANDO);
        long concluidos = contar(chamados, c -> c.getStatus() == StatusChamado.CONCLUIDO);
        long cancelados = contar(chamados, c -> c.getStatus() == StatusChamado.CANCELADO);
        long pendentes = abertos + emAndamento + aguardando;

        long semTecnico = contar(chamados, c -> pendente(c) && (c.getTecnico() == null || c.getTecnico().isBlank()));
        long atrasados = contar(chamados, c -> pendente(c) && c.isForaDoPrazo());
        long noPrazo = contar(chamados, c -> c.getStatus() == StatusChamado.CONCLUIDO && !c.isForaDoPrazo());

        // cancelados não entram na taxa de resolução
        double taxaResolucao = percentual(concluidos, total - cancelados);
        double percentualNoPrazo = percentual(noPrazo, concluidos);

        return new Indicadores(total, pendentes, abertos, emAndamento, aguardando, concluidos, cancelados,
                semTecnico, atrasados, taxaResolucao, percentualNoPrazo, tempoMedio(chamados));
    }

    // RF02 - Abertos x concluídos por período
    public SerieTemporal porPeriodo(FiltroChamado filtro, String agrupamento) {
        String tipoAgrupamento = agrupamento == null ? "semana" : agrupamento.toLowerCase();
        if (!List.of("dia", "semana", "mes").contains(tipoAgrupamento)) {
            throw new IllegalArgumentException("Agrupamento inválido. Use: dia, semana ou mes");
        }

        List<Chamado> abertos = buscar(filtro);

        // concluídos são contados pela data de fechamento, não de abertura
        Query queryFechados = filtro.montarQuery("dataFechamento");
        List<Chamado> fechados = mongoTemplate.find(queryFechados, Chamado.class).stream()
                .filter(c -> c.getStatus() == StatusChamado.CONCLUIDO && c.getDataFechamento() != null)
                .toList();

        TreeMap<LocalDate, long[]> mapa = new TreeMap<>();
        for (Chamado c : abertos) {
            if (c.getDataAbertura() == null) {
                continue; // chamados antigos podem não ter data
            }
            mapa.computeIfAbsent(inicioPeriodo(c.getDataAbertura().toLocalDate(), tipoAgrupamento), k -> new long[2])[0]++;
        }
        for (Chamado c : fechados) {
            mapa.computeIfAbsent(inicioPeriodo(c.getDataFechamento().toLocalDate(), tipoAgrupamento), k -> new long[2])[1]++;
        }

        if (mapa.isEmpty()) {
            return new SerieTemporal(tipoAgrupamento, List.of());
        }

        LocalDate inicio = filtro.getInicio() != null ? filtro.getInicio() : mapa.firstKey();
        LocalDate fim = filtro.getFim() != null ? filtro.getFim() : LocalDate.now();

        if (tipoAgrupamento.equals("dia") && ChronoUnit.DAYS.between(inicio, fim) > 366) {
            throw new IllegalArgumentException("Para períodos maiores que 1 ano use o agrupamento por semana ou mês");
        }

        // preenche os períodos sem chamado com zero para o gráfico não "pular" datas
        List<Periodo> dados = new ArrayList<>();
        LocalDate atual = inicioPeriodo(inicio, tipoAgrupamento);
        while (!atual.isAfter(fim)) {
            long[] valores = mapa.getOrDefault(atual, new long[2]);
            String chave = tipoAgrupamento.equals("mes") ? atual.toString().substring(0, 7) : atual.toString();
            dados.add(new Periodo(chave, valores[0], valores[1]));
            atual = proximoPeriodo(atual, tipoAgrupamento);
        }
        return new SerieTemporal(tipoAgrupamento, dados);
    }

    // RF03 - Situação dos chamados
    public List<Contagem> porStatus(FiltroChamado filtro) {
        Map<StatusChamado, Long> totais = buscar(filtro).stream()
                .filter(c -> c.getStatus() != null)
                .collect(Collectors.groupingBy(Chamado::getStatus, Collectors.counting()));

        return Arrays.stream(StatusChamado.values())
                .map(s -> new Contagem(s.name(), s.getLabel(), totais.getOrDefault(s, 0L)))
                .toList();
    }

    public List<ResumoPrioridade> porPrioridade(FiltroChamado filtro) {
        List<Chamado> chamados = buscar(filtro);

        return Arrays.stream(Prioridade.values())
                .map(p -> {
                    List<Chamado> daPrioridade = chamados.stream().filter(c -> c.getPrioridade() == p).toList();
                    return new ResumoPrioridade(p.name(), p.getLabel(), p.getSlaHoras(),
                            daPrioridade.size(),
                            contar(daPrioridade, this::pendente),
                            contar(daPrioridade, c -> pendente(c) && c.isForaDoPrazo()));
                })
                .toList();
    }

    // RF04 - Tipos de chamados mais atendidos
    public List<RankingTipo> porTipo(FiltroChamado filtro, int limite) {
        List<Chamado> chamados = buscar(filtro);
        long totalGeral = chamados.size();

        Map<String, List<Chamado>> porTipo = chamados.stream()
                .collect(Collectors.groupingBy(c -> c.getTipo() == null ? "Não informado" : c.getTipo()));

        return porTipo.entrySet().stream()
                .map(e -> new RankingTipo(
                        e.getKey(),
                        e.getValue().size(),
                        contar(e.getValue(), c -> c.getStatus() == StatusChamado.CONCLUIDO),
                        contar(e.getValue(), this::pendente),
                        percentual(e.getValue().size(), totalGeral),
                        tempoMedio(e.getValue())))
                .sorted(Comparator.comparingLong(RankingTipo::atendidos).reversed()
                        .thenComparing(Comparator.comparingLong(RankingTipo::total).reversed()))
                .limit(limite)
                .toList();
    }

    public List<RankingTecnico> porTecnico(FiltroChamado filtro) {
        Map<String, List<Chamado>> porTecnico = buscar(filtro).stream()
                .filter(c -> c.getTecnico() != null && !c.getTecnico().isBlank())
                .collect(Collectors.groupingBy(Chamado::getTecnico));

        return porTecnico.entrySet().stream()
                .map(e -> {
                    long atendidos = contar(e.getValue(), c -> c.getStatus() == StatusChamado.CONCLUIDO);
                    long noPrazo = contar(e.getValue(), c -> c.getStatus() == StatusChamado.CONCLUIDO && !c.isForaDoPrazo());
                    return new RankingTecnico(e.getKey(), e.getValue().size(), atendidos,
                            contar(e.getValue(), this::pendente), percentual(noPrazo, atendidos), tempoMedio(e.getValue()));
                })
                .sorted(Comparator.comparingLong(RankingTecnico::atendidos).reversed())
                .toList();
    }

    // RF05 - valores para preencher os filtros da tela
    public Opcoes opcoes() {
        List<Opcao> status = Arrays.stream(StatusChamado.values()).map(s -> new Opcao(s.name(), s.getLabel())).toList();
        List<Opcao> prioridades = Arrays.stream(Prioridade.values())
                .map(p -> new Opcao(p.name(), p.getLabel() + " (SLA " + p.getSlaHoras() + "h)")).toList();

        List<String> tipos = distintos("tipo");
        List<String> tecnicos = distintos("tecnico");
        return new Opcoes(status, prioridades, tipos, tecnicos);
    }

    /* ---------- métodos auxiliares ---------- */

    private List<String> distintos(String campo) {
        return mongoTemplate.findDistinct(new Query(), campo, Chamado.class, String.class).stream()
                .filter(Objects::nonNull)
                .sorted()
                .toList();
    }

    private boolean pendente(Chamado c) {
        return c.getStatus() != null && c.getStatus().isPendente();
    }

    private long contar(List<Chamado> chamados, Predicate<Chamado> condicao) {
        return chamados.stream().filter(condicao).count();
    }

    private double percentual(long parte, long total) {
        if (total <= 0) {
            return 0;
        }
        return Math.round(parte * 1000.0 / total) / 10.0;
    }

    /** Média de horas de resolução dos concluídos. Retorna null se não houver nenhum. */
    private Double tempoMedio(List<Chamado> chamados) {
        var media = chamados.stream()
                .filter(c -> c.getStatus() == StatusChamado.CONCLUIDO && c.getHorasDecorridas() != null)
                .mapToDouble(Chamado::getHorasDecorridas)
                .average();
        return media.isPresent() ? Math.round(media.getAsDouble() * 10) / 10.0 : null;
    }

    private LocalDate inicioPeriodo(LocalDate data, String agrupamento) {
        return switch (agrupamento) {
            case "semana" -> data.with(DayOfWeek.MONDAY);
            case "mes" -> data.withDayOfMonth(1);
            default -> data;
        };
    }

    private LocalDate proximoPeriodo(LocalDate data, String agrupamento) {
        return switch (agrupamento) {
            case "semana" -> data.plusWeeks(1);
            case "mes" -> data.plusMonths(1);
            default -> data.plusDays(1);
        };
    }
}
