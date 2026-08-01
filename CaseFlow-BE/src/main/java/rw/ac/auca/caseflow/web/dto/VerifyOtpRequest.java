package rw.ac.auca.caseflow.web.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyOtpRequest(
        @NotBlank String email,
        @NotBlank String otp
) {
}
