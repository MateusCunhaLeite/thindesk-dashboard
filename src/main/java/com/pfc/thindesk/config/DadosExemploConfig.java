package com.pfc.thindesk.config;

import com.pfc.thindesk.entity.Chamado;
import com.pfc.thindesk.entity.Cliente;
import com.pfc.thindesk.entity.Consideracao;
import com.pfc.thindesk.entity.Prioridade;
import com.pfc.thindesk.entity.StatusChamado;
import com.pfc.thindesk.repository.ChamadoRepository;
import com.pfc.thindesk.repository.ClienteRepository;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;

/**
 * Popula o banco com chamados de exemplo dos últimos 6 meses quando a coleção está vazia.
 * As datas são calculadas a partir de hoje, então o dashboard sempre tem dados recentes.
 * Pode ser desligado com thindesk.dados-exemplo=false no application.properties.
 */
@Configuration
@ConditionalOnProperty(name = "thindesk.dados-exemplo", havingValue = "true")
public class DadosExemploConfig implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DadosExemploConfig.class);

    private static final int QUANTIDADE = 450;
    private static final int DIAS = 180;

    // tipo de chamado -> títulos possíveis
    private static final Map<String, List<String>> TIPOS = Map.of(
            "Acesso e senhas", List.of("Reset de senha do AD", "Usuário bloqueado", "Liberação de acesso a pasta da rede", "Criação de usuário para novo colaborador"),
            "Hardware", List.of("Computador não liga", "Monitor piscando", "Teclado com teclas falhando", "Notebook superaquecendo"),
            "Software", List.of("Erro ao abrir o Excel", "Instalação do Adobe Reader", "Atualização do Windows travada", "Programa fechando sozinho"),
            "Rede", List.of("Sem acesso à internet", "Wi-Fi caindo constantemente", "Lentidão na rede", "Ponto de rede sem sinal"),
            "Impressora", List.of("Impressora não imprime", "Papel atolando", "Instalar impressora de rede"),
            "E-mail", List.of("Caixa de e-mail cheia", "Outlook não sincroniza", "Não recebe e-mails externos"),
            "Manutenção", List.of("Manutenção preventiva do equipamento", "Troca de peça danificada", "Limpeza e revisão do computador"),
            "Sistema interno", List.of("Erro ao emitir nota fiscal", "Relatório não carrega no sistema", "Lentidão no módulo de vendas")
    );

    // peso de cada tipo (quanto maior, mais chamados daquele tipo)
    private static final Map<String, Integer> PESO_TIPO = Map.of(
            "Acesso e senhas", 20, "Hardware", 16, "Software", 15, "Rede", 13,
            "Impressora", 11, "E-mail", 9, "Manutenção", 8, "Sistema interno", 8
    );

    private static final List<String> TECNICOS = List.of("João", "Carlos Mendes", "Juliana Rocha", "Rafael Souza", "Patrícia Lima");

    private static final String[][] CLIENTES = {
        {"Alberto", "(61) 99811-2030", "Financeiro"},
        {"Ana Paula Ferreira", "(61) 99654-1122", "RH"},
        {"Marcos Vinícius", "(61) 98123-4455", "Comercial"},
        {"Fernanda Costa", "(61) 99432-7788", "Financeiro"},
        {"João Pedro Martins", "(61) 98877-6655", "Logística"},
        {"Luciana Ribeiro", "(61) 99234-5566", "Jurídico"},
        {"Ricardo Gomes", "(61) 98345-1212", "Diretoria"},
        {"Camila Barbosa", "(61) 99712-3434", "Marketing"},
        {"Diego Santos", "(61) 98456-7878", "Comercial"},
        {"Beatriz Oliveira", "(61) 99567-9090", "RH"},
        {"Gustavo Pereira", "(61) 98678-1313", "TI"},
        {"Renata Carvalho", "(61) 99789-2424", "Logística"}
    };

    private static final List<String> NOTAS_INICIO = List.of(
            "Chamado recebido, iniciando análise.",
            "Contato realizado com o usuário para entender o problema.",
            "Acesso remoto realizado para diagnóstico.");
    private static final List<String> NOTAS_AGUARDANDO = List.of(
            "Aguardando retorno do usuário para validar.",
            "Usuário não estava no local, aguardando novo horário.");
    private static final List<String> NOTAS_CONCLUSAO = List.of(
            "Problema resolvido, usuário confirmou o funcionamento.",
            "Solução aplicada e testada junto ao usuário.",
            "Atendimento concluído.");

    @Autowired
    private ChamadoRepository chamadoRepository;
    @Autowired
    private ClienteRepository clienteRepository;

    // semente fixa para gerar sempre os mesmos dados
    private final Random random = new Random(2026);

    @Override
    public void run(String... args) {
        if (clienteRepository.count() == 0) {
            for (String[] c : CLIENTES) {
                Cliente cliente = new Cliente();
                cliente.setNome(c[0]);
                cliente.setTelefone(c[1]);
                cliente.setSetor(c[2]);
                clienteRepository.save(cliente);
            }
        }

        if (chamadoRepository.count() > 0) {
            return;
        }

        log.info("Banco de chamados vazio, gerando {} chamados de exemplo...", QUANTIDADE);
        LocalDateTime agora = LocalDateTime.now();

        List<LocalDateTime> aberturas = new ArrayList<>();
        for (int i = 0; i < QUANTIDADE; i++) {
            aberturas.add(gerarDataAbertura(agora));
        }
        aberturas.sort(null);

        List<Chamado> chamados = new ArrayList<>();
        for (LocalDateTime abertura : aberturas) {
            chamados.add(gerarChamado(abertura, agora));
        }
        chamadoRepository.saveAll(chamados);
        log.info("Dados de exemplo gerados.");
    }

    private LocalDateTime gerarDataAbertura(LocalDateTime agora) {
        // potência > 1 concentra mais chamados nos meses recentes
        double diasAtras = Math.pow(random.nextDouble(), 1.25) * DIAS;
        LocalDateTime data = agora.minusMinutes((long) (diasAtras * 24 * 60));

        // a maioria dos chamados é aberta em dia útil
        if (data.getDayOfWeek() == DayOfWeek.SATURDAY && random.nextDouble() < 0.85) {
            data = data.minusDays(1);
        } else if (data.getDayOfWeek() == DayOfWeek.SUNDAY && random.nextDouble() < 0.85) {
            data = data.minusDays(2);
        }

        data = data.withHour(8 + random.nextInt(10)).withMinute(random.nextInt(60)).withSecond(random.nextInt(60)).withNano(0);
        if (data.isAfter(agora)) {
            data = agora.minusMinutes(random.nextInt(180));
        }
        return data;
    }

    private Chamado gerarChamado(LocalDateTime abertura, LocalDateTime agora) {
        String tipo = sortearTipo();
        Prioridade prioridade = sortearPrioridade();
        double idadeHoras = ChronoUnit.MINUTES.between(abertura, agora) / 60.0;

        // ~80% resolvidos dentro do SLA, o restante passa do prazo
        double fator = random.nextDouble() < 0.8 ? 0.1 + random.nextDouble() * 0.85 : 1.05 + random.nextDouble() * 1.5;
        double horasResolucao = prioridade.getSlaHoras() * fator;

        StatusChamado status;
        LocalDateTime fechamento = null;

        if (random.nextDouble() < 0.04) {
            status = StatusChamado.CANCELADO;
            fechamento = abertura.plusMinutes((long) (Math.min(idadeHoras, 2) * random.nextDouble() * 60));
        } else if (horasResolucao < idadeHoras && !(idadeHoras < 30 * 24 && random.nextDouble() < 0.1)) {
            status = StatusChamado.CONCLUIDO;
            fechamento = abertura.plusMinutes((long) (horasResolucao * 60));
        } else if (idadeHoras < 2) {
            status = StatusChamado.ABERTO;
        } else {
            double s = random.nextDouble();
            status = s < 0.25 ? StatusChamado.ABERTO : s < 0.75 ? StatusChamado.EM_ANDAMENTO : StatusChamado.AGUARDANDO;
        }

        String tecnico = status == StatusChamado.ABERTO && random.nextDouble() < 0.6 ? null : sortear(TECNICOS);

        Chamado chamado = new Chamado();
        chamado.setDescricao(sortear(TIPOS.get(tipo)));
        chamado.setTipo(tipo);
        chamado.setPrioridade(prioridade);
        chamado.setStatus(status);
        chamado.setTecnico(tecnico);
        chamado.setUsuario(CLIENTES[random.nextInt(CLIENTES.length)][0]);
        chamado.setDataAbertura(abertura);
        chamado.setDataFechamento(fechamento);

        // considerações técnicas ao longo do atendimento
        if (tecnico != null) {
            LocalDateTime fim = fechamento != null ? fechamento : agora;
            long duracao = ChronoUnit.MINUTES.between(abertura, fim);
            chamado.getConsideracoes().add(new Consideracao(sortear(NOTAS_INICIO), tecnico, abertura.plusMinutes(duracao / 10)));

            if (status == StatusChamado.AGUARDANDO) {
                chamado.getConsideracoes().add(new Consideracao(sortear(NOTAS_AGUARDANDO), tecnico, abertura.plusMinutes(duracao * 6 / 10)));
            } else if (status == StatusChamado.CONCLUIDO) {
                chamado.getConsideracoes().add(new Consideracao(sortear(NOTAS_CONCLUSAO), tecnico, fim));
            }
        }
        return chamado;
    }

    private String sortearTipo() {
        int total = PESO_TIPO.values().stream().mapToInt(Integer::intValue).sum();
        int sorteio = random.nextInt(total);
        // percorre em ordem fixa para o resultado ser sempre o mesmo
        for (String tipo : PESO_TIPO.keySet().stream().sorted().toList()) {
            sorteio -= PESO_TIPO.get(tipo);
            if (sorteio < 0) {
                return tipo;
            }
        }
        return "Software";
    }

    private Prioridade sortearPrioridade() {
        double s = random.nextDouble();
        if (s < 0.30) return Prioridade.BAIXA;
        if (s < 0.70) return Prioridade.MEDIA;
        if (s < 0.92) return Prioridade.ALTA;
        return Prioridade.CRITICA;
    }

    private <T> T sortear(List<T> lista) {
        return lista.get(random.nextInt(lista.size()));
    }
}
