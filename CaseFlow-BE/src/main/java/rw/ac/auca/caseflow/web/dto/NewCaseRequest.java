package rw.ac.auca.caseflow.web.dto;

import jakarta.validation.constraints.NotBlank;

public record NewCaseRequest(
        @NotBlank String studentName,
        @NotBlank String studentId,
        @NotBlank String reportedBy,
        String reporterDepartment,
        @NotBlank String offenseType,
        @NotBlank String description,
        String evidence
) {
}
