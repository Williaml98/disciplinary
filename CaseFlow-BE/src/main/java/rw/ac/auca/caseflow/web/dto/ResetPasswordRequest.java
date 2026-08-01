package rw.ac.auca.caseflow.web.dto;

import jakarta.validation.constraints.NotBlank;

public record ResetPasswordRequest(
        @NotBlank String email,
        @NotBlank String otp,
        @NotBlank String newPassword
) {
}
