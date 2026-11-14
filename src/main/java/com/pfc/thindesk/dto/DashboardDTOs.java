package com.pfc.thindesk.dto;

import java.util.List;

/**
 * Objetos de resposta da API do dashboard.
 * Usei records (Java 16+) porque são só dados, sem regra nenhuma.
 */
public final class DashboardDTOs {

    private DashboardDTOs() {
    }

    public record Indicadores(
            long total,
            long pendentes,
            long abertos,
            long emAndamento,
            long aguardando,
            long concluidos,
            long cancelados,
            long semTecnico,
            long atrasados,
            double taxaResolucao,
            double percentualNoPrazo,
            Double tempoMedioResolucaoHoras) {
    }

    public record Periodo(String periodo, long abertos, long concluidos) {
    }

    public record SerieTemporal(String agrupamento, List<Periodo> dados) {
    }

    public record Contagem(String valor, String label, long total) {
    }

    public record ResumoPrioridade(String valor, String label, int slaHoras, long total, long pendentes, long atrasados) {
    }

    public record RankingTipo(String tipo, long total, long atendidos, long pendentes, double participacao, Double tempoMedioHoras) {
    }

    public record RankingTecnico(String tecnico, long total, long atendidos, long pendentes, double percentualNoPrazo, Double tempoMedioHoras) {
    }

    public record Opcao(String valor, String label) {
    }

    public record Opcoes(List<Opcao> status, List<Opcao> prioridades, List<String> tipos, List<String> tecnicos) {
    }

    public record Pagina<T>(List<T> dados, int pagina, int tamanho, long total, int totalPaginas) {
    }

    public record AtualizacaoStatus(String status, String tecnico) {
    }

    public record NovaConsideracao(String texto, String tecnico) {
    }
}
