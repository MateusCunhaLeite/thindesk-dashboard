package com.pfc.thindesk.controller;

import com.pfc.thindesk.dto.DashboardDTOs.AtualizacaoStatus;
import com.pfc.thindesk.dto.DashboardDTOs.NovaConsideracao;
import com.pfc.thindesk.dto.DashboardDTOs.Pagina;
import com.pfc.thindesk.dto.FiltroChamado;
import com.pfc.thindesk.entity.Chamado;
import com.pfc.thindesk.entity.Consideracao;
import com.pfc.thindesk.service.ChamadoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.ui.Model;

@RestController
@RequestMapping("/api/chamados")
public class ChamadoController {

    @Autowired
    private ChamadoService chamadoService;

    @PostMapping
    public Chamado criarChamado(@RequestBody Chamado chamado) {
        return chamadoService.criarChamado(chamado);
    }

    /**
     * Lista paginada com os mesmos filtros do dashboard.
     * Ex: /api/chamados?pagina=1&tamanho=10&status=ABERTO
     */
    @GetMapping
    public Pagina<Chamado> listarChamados(FiltroChamado filtro,
            @RequestParam(defaultValue = "1") int pagina,
            @RequestParam(defaultValue = "10") int tamanho) {
        return chamadoService.listarPaginado(filtro, pagina, tamanho);
    }

    @GetMapping("/{id}")
    public Chamado buscarChamado(@PathVariable String id) {
        return chamadoService.buscarPorId(id);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Chamado> atualizarChamado(@PathVariable String id, @RequestBody Chamado chamadoAtualizado) {
        Chamado chamado = chamadoService.atualizarChamado(id, chamadoAtualizado);
        return ResponseEntity.ok(chamado);
    }

    /** Atualiza só o status e/ou o técnico (usado pelo dashboard). */
    @PatchMapping("/{id}/status")
    public Chamado atualizarStatus(@PathVariable String id, @RequestBody AtualizacaoStatus dados) {
        return chamadoService.atualizarStatus(id, dados.status(), dados.tecnico());
    }

    @PostMapping("/{id}/consideracoes")
    @ResponseStatus(HttpStatus.CREATED)
    public Consideracao adicionarConsideracao(@PathVariable String id, @RequestBody NovaConsideracao dados) {
        return chamadoService.adicionarConsideracao(id, dados.texto(), dados.tecnico());
    }

    @PostMapping("/atualizar/{id}")
    public String atualizarChamado(@PathVariable String id, @ModelAttribute Chamado chamadoAtualizado, Model model) {
        chamadoService.atualizarChamado(id, chamadoAtualizado);
        return "redirect:/chamados"; // Redireciona para a página da lista de chamados
    }
}
