package com.pfc.thindesk.controller;

import com.pfc.thindesk.dto.DashboardDTOs.Contagem;
import com.pfc.thindesk.dto.DashboardDTOs.Indicadores;
import com.pfc.thindesk.dto.DashboardDTOs.Opcoes;
import com.pfc.thindesk.dto.DashboardDTOs.RankingTecnico;
import com.pfc.thindesk.dto.DashboardDTOs.RankingTipo;
import com.pfc.thindesk.dto.DashboardDTOs.ResumoPrioridade;
import com.pfc.thindesk.dto.DashboardDTOs.SerieTemporal;
import com.pfc.thindesk.dto.FiltroChamado;
import com.pfc.thindesk.service.DashboardService;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints que alimentam o Dashboard Administrativo.
 * Todos aceitam os filtros: inicio, fim, status, prioridade, tipo e tecnico.
 */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @Autowired
    private DashboardService dashboardService;

    @GetMapping("/opcoes")
    public Opcoes opcoes() {
        return dashboardService.opcoes();
    }

    @GetMapping("/indicadores")
    public Indicadores indicadores(FiltroChamado filtro) {
        return dashboardService.indicadores(filtro);
    }

    @GetMapping("/por-periodo")
    public SerieTemporal porPeriodo(FiltroChamado filtro, @RequestParam(defaultValue = "semana") String agrupamento) {
        return dashboardService.porPeriodo(filtro, agrupamento);
    }

    @GetMapping("/por-status")
    public List<Contagem> porStatus(FiltroChamado filtro) {
        return dashboardService.porStatus(filtro);
    }

    @GetMapping("/por-prioridade")
    public List<ResumoPrioridade> porPrioridade(FiltroChamado filtro) {
        return dashboardService.porPrioridade(filtro);
    }

    @GetMapping("/por-tipo")
    public List<RankingTipo> porTipo(FiltroChamado filtro, @RequestParam(defaultValue = "10") int limite) {
        return dashboardService.porTipo(filtro, limite);
    }

    @GetMapping("/por-tecnico")
    public List<RankingTecnico> porTecnico(FiltroChamado filtro) {
        return dashboardService.porTecnico(filtro);
    }
}
