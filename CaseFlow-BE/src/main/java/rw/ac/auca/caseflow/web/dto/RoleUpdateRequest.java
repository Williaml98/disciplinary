package rw.ac.auca.caseflow.web.dto;

import jakarta.validation.constraints.NotNull;
import rw.ac.auca.caseflow.domain.Role;

public record RoleUpdateRequest(
        @NotNull Role role
) {
}
