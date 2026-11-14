package com.pfc.thindesk.entity;

/**
 * Situações possíveis de um chamado.
 * Pendentes: ABERTO, EM_ANDAMENTO e AGUARDANDO.
 * Encerrados: CONCLUIDO e CANCELADO.
 */
public enum StatusChamado {

    ABERTO("Aberto"),
    EM_ANDAMENTO("Em andamento"),
    AGUARDANDO("Aguardando usuário"),
    CONCLUIDO("Concluído"),
    CANCELADO("Cancelado");

    private final String label;

    StatusChamado(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public boolean isPendente() {
        return this == ABERTO || this == EM_ANDAMENTO || this == AGUARDANDO;
    }

    public boolean isEncerrado() {
        return !isPendente();
    }
}
