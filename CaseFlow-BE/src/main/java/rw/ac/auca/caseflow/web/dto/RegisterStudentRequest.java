package rw.ac.auca.caseflow.web.dto;

import jakarta.validation.constraints.NotBlank;

public record RegisterStudentRequest(
        @NotBlank String name,
        @NotBlank String studentId,
        @NotBlank String email,
        @NotBlank String password
) {
}
