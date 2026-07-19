package rw.ac.auca.caseflow.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import rw.ac.auca.caseflow.domain.Role;

public record CreateUserRequest(
        @NotBlank String name,
        @NotNull Role role,
        String department,
        String studentId,
        @NotBlank String email,
        @NotBlank String password
) {
}
