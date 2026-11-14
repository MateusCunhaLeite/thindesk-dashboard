package com.pfc.thindesk.entity;

/**
 * Prioridade do chamado e o SLA (tempo máximo de resolução, em horas) de cada uma.
 */
public enum Prioridade {

    BAIXA("Baixa", 72),
    MEDIA("Média", 24),
    ALTA("Alta", 8),
    CRITICA("Crítica", 4);

    private final String label;
    private final int slaHoras;

    Prioridade(String label, int slaHoras) {
        this.label = label;
        this.slaHoras = slaHoras;
    }

    public String getLabel() {
        return label;
    }

    public int getSlaHoras() {
        return slaHoras;
    }
}
