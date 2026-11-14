package com.pfc.thindesk.entity;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;


@Document(collection = "chamados")
public class Chamado{

    @Id
    private String id;
    private String descricao;
    private StatusChamado status;
    private String tipo;
    private String tecnico;
    private String usuario;

    // campos adicionados para o dashboard
    private Prioridade prioridade;
    @Indexed
    private LocalDateTime dataAbertura;
    private LocalDateTime dataFechamento;
    private List<Consideracao> consideracoes = new ArrayList<>();

    /**
     * Horas desde a abertura até o fechamento (ou até agora, se ainda estiver pendente).
     * Não é salvo no banco, só aparece no JSON da API.
     */
    public Double getHorasDecorridas() {
        if (dataAbertura == null) {
            return null;
        }
        LocalDateTime fim = dataFechamento != null ? dataFechamento : LocalDateTime.now();
        return Duration.between(dataAbertura, fim).toMinutes() / 60.0;
    }

    /** Passou do SLA da prioridade? Chamados cancelados não contam. */
    public boolean isForaDoPrazo() {
        Double horas = getHorasDecorridas();
        if (horas == null || prioridade == null || status == StatusChamado.CANCELADO) {
            return false;
        }
        return horas > prioridade.getSlaHoras();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public StatusChamado getStatus() {
        return status;
    }

    public void setStatus(StatusChamado status) {
        this.status = status;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getTecnico() {
        return tecnico;
    }

    public void setTecnico(String tecnico) {
        this.tecnico = tecnico;
    }

    public String getUsuario() {
        return usuario;
    }

    public void setUsuario(String usuario) {
        this.usuario = usuario;
    }

    public Prioridade getPrioridade() {
        return prioridade;
    }

    public void setPrioridade(Prioridade prioridade) {
        this.prioridade = prioridade;
    }

    public LocalDateTime getDataAbertura() {
        return dataAbertura;
    }

    public void setDataAbertura(LocalDateTime dataAbertura) {
        this.dataAbertura = dataAbertura;
    }

    public LocalDateTime getDataFechamento() {
        return dataFechamento;
    }

    public void setDataFechamento(LocalDateTime dataFechamento) {
        this.dataFechamento = dataFechamento;
    }

    public List<Consideracao> getConsideracoes() {
        return consideracoes;
    }

    public void setConsideracoes(List<Consideracao> consideracoes) {
        this.consideracoes = consideracoes;
    }

}
