package com.pfc.thindesk.dto;

import com.pfc.thindesk.entity.Prioridade;
import com.pfc.thindesk.entity.StatusChamado;
import java.time.LocalDate;
import lombok.Data;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.format.annotation.DateTimeFormat;

/**
 * Filtros aceitos pela API (vêm da query string).
 * Ex: /api/dashboard/indicadores?inicio=2026-08-01&fim=2026-08-31&status=ABERTO&tipo=Rede
 */
@Data
public class FiltroChamado {

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate inicio;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate fim;

    private StatusChamado status;
    private Prioridade prioridade;
    private String tipo;
    private String tecnico;

    /**
     * Monta a consulta do MongoDB com os filtros preenchidos.
     *
     * @param campoData campo usado no filtro de período (dataAbertura ou dataFechamento)
     */
    public Query montarQuery(String campoData) {
        if (inicio != null && fim != null && inicio.isAfter(fim)) {
            throw new IllegalArgumentException("A data inicial não pode ser maior que a data final");
        }

        Query query = new Query();

        if (inicio != null || fim != null) {
            Criteria periodo = Criteria.where(campoData);
            if (inicio != null) {
                periodo = periodo.gte(inicio.atStartOfDay());
            }
            if (fim != null) {
                // até o fim do dia informado
                periodo = periodo.lt(fim.plusDays(1).atStartOfDay());
            }
            query.addCriteria(periodo);
        }
        if (status != null) {
            query.addCriteria(Criteria.where("status").is(status));
        }
        if (prioridade != null) {
            query.addCriteria(Criteria.where("prioridade").is(prioridade));
        }
        if (tipo != null && !tipo.isBlank()) {
            query.addCriteria(Criteria.where("tipo").is(tipo));
        }
        if (tecnico != null && !tecnico.isBlank()) {
            query.addCriteria(Criteria.where("tecnico").is(tecnico));
        }
        return query;
    }
}
