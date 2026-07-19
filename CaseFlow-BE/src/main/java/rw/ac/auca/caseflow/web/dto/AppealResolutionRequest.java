package rw.ac.auca.caseflow.web.dto;

import jakarta.validation.constraints.NotNull;
import rw.ac.auca.caseflow.domain.AppealStatus;

public record AppealResolutionRequest(
        @NotNull AppealStatus resolution,
        String by
) {
}
