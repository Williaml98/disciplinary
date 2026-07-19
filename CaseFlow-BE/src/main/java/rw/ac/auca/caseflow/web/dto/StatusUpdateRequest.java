package rw.ac.auca.caseflow.web.dto;

import jakarta.validation.constraints.NotNull;
import rw.ac.auca.caseflow.domain.CaseStatus;

public record StatusUpdateRequest(
        @NotNull CaseStatus status,
        String by
) {
}
