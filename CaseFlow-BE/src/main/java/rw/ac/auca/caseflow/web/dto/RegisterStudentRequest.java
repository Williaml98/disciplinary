package rw.ac.auca.caseflow.web.dto;

import jakarta.validation.constraints.NotBlank;

public record RegisterStudentRequest(
        @NotBlank String name,
        @NotBlank String studentId,
        @NotBlank(message = "is required") String department,
        @NotBlank String email,
        @NotBlank String password,
        @NotBlank String otp
) {
}
