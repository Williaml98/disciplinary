package rw.ac.auca.caseflow.web.dto;

import jakarta.validation.constraints.NotBlank;

public record ProfileUpdateRequest(
        @NotBlank String name,
        @NotBlank String email,
        String department,
        String studentId
) {
}
