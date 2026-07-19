package rw.ac.auca.caseflow.web.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import rw.ac.auca.caseflow.domain.DecisionType;

public record DecisionRequest(
        @NotNull DecisionType decision,
        LocalDate suspensionStart,
        LocalDate suspensionEnd,
        String by
) {
}
