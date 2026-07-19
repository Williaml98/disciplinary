package rw.ac.auca.caseflow.web.dto;

import jakarta.validation.constraints.NotBlank;

public record NoteRequest(
        @NotBlank String author,
        @NotBlank String text
) {
}
