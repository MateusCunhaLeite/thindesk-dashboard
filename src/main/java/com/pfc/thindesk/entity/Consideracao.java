package com.pfc.thindesk.entity;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Consideração técnica registrada durante o atendimento.
 * Fica salva dentro do próprio documento do chamado (subdocumento no MongoDB).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Consideracao {

    private String texto;
    private String tecnico;
    private LocalDateTime data;
}
