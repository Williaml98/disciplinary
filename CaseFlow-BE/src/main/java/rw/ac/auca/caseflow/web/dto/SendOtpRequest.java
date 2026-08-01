package rw.ac.auca.caseflow.web.dto;

import jakarta.validation.constraints.NotBlank;

public record SendOtpRequest(
        @NotBlank String email
) {
}
