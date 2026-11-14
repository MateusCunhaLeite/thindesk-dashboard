package com.pfc.thindesk.service;

import com.pfc.thindesk.dto.DashboardDTOs.Pagina;
import com.pfc.thindesk.dto.FiltroChamado;
import com.pfc.thindesk.entity.Chamado;
import com.pfc.thindesk.entity.Consideracao;
import com.pfc.thindesk.entity.Prioridade;
import com.pfc.thindesk.entity.StatusChamado;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import com.pfc.thindesk.repository.ChamadoRepository;

@Service
public class ChamadoService {

    @Autowired
    private ChamadoRepository chamadoRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    public Chamado criarChamado(Chamado chamado) {
        // valores padrão para chamados novos
        if (chamado.getDataAbertura() == null) {
            chamado.setDataAbertura(LocalDateTime.now());
        }
        if (chamado.getStatus() == null) {
            chamado.setStatus(StatusChamado.ABERTO);
        }
        if (chamado.getPrioridade() == null) {
            chamado.setPrioridade(Prioridade.MEDIA);
        }
        return chamadoRepository.save(chamado);
    }

    public List<Chamado> listarChamados() {
        return chamadoRepository.findAll(Sort.by(Sort.Direction.DESC, "dataAbertura"));
    }

    public Chamado buscarPorId(String id) {
        return chamadoRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Chamado não encontrado com id: " + id));
    }

    /** Lista com os mesmos filtros do dashboard, paginada e do mais recente para o mais antigo. */
    public Pagina<Chamado> listarPaginado(FiltroChamado filtro, int pagina, int tamanho) {
        if (pagina < 1 || tamanho < 1) {
            throw new IllegalArgumentException("Página e tamanho devem ser maiores que zero");
        }
        tamanho = Math.min(tamanho, 100);

        Query query = filtro.montarQuery("dataAbertura");
        long total = mongoTemplate.count(query, Chamado.class);

        query.with(Sort.by(Sort.Direction.DESC, "dataAbertura"))
                .skip((long) (pagina - 1) * tamanho)
                .limit(tamanho);
        List<Chamado> dados = mongoTemplate.find(query, Chamado.class);

        int totalPaginas = (int) Math.max(1, Math.ceil((double) total / tamanho));
        return new Pagina<>(dados, pagina, tamanho, total, totalPaginas);
    }

    public Chamado atualizarChamado(String id, Chamado chamadoAtualizado) {
        return chamadoRepository.findById(id)
                .map(chamado -> {
                    chamado.setDescricao(chamadoAtualizado.getDescricao());
                    chamado.setStatus(chamadoAtualizado.getStatus());
                    chamado.setTipo(chamadoAtualizado.getTipo());
                    chamado.setTecnico(chamadoAtualizado.getTecnico());
                    chamado.setUsuario(chamadoAtualizado.getUsuario());
                    return chamadoRepository.save(chamado);
                })
                .orElseThrow(() -> new NoSuchElementException("Chamado não encontrado com id: " + id));
    }

    /**
     * Muda o status (e opcionalmente o técnico) controlando a data de fechamento:
     * ao concluir/cancelar grava a data, ao reabrir apaga.
     */
    public Chamado atualizarStatus(String id, String status, String tecnico) {
        Chamado chamado = buscarPorId(id);

        if (status != null && !status.isBlank()) {
            StatusChamado novoStatus;
            try {
                novoStatus = StatusChamado.valueOf(status);
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Status inválido: " + status);
            }

            boolean estavaEncerrado = chamado.getStatus() != null && chamado.getStatus().isEncerrado();
            if (novoStatus.isEncerrado() && !estavaEncerrado) {
                chamado.setDataFechamento(LocalDateTime.now());
            } else if (novoStatus.isPendente()) {
                chamado.setDataFechamento(null);
            }
            chamado.setStatus(novoStatus);
        }

        if (tecnico != null) {
            chamado.setTecnico(tecnico.isBlank() ? null : tecnico.trim());
        }
        return chamadoRepository.save(chamado);
    }

    public Consideracao adicionarConsideracao(String id, String texto, String tecnico) {
        if (texto == null || texto.isBlank()) {
            throw new IllegalArgumentException("O texto da consideração é obrigatório");
        }
        if (texto.length() > 1000) {
            throw new IllegalArgumentException("A consideração deve ter no máximo 1000 caracteres");
        }

        Chamado chamado = buscarPorId(id);
        String autor = tecnico != null && !tecnico.isBlank() ? tecnico : chamado.getTecnico();
        Consideracao consideracao = new Consideracao(texto.trim(), autor, LocalDateTime.now());

        chamado.getConsideracoes().add(consideracao);
        chamadoRepository.save(chamado);
        return consideracao;
    }

}
