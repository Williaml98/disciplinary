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
        /**
         * Optional, and ignored entirely when an admin creates the account — the backend generates a
         * temporary password and emails it instead. Only the zero-users bootstrap path reads this, and
         * it enforces its own presence check (see UserController.createUser).
         */
        String password
) {
}
