package rw.ac.auca.caseflow.web.dto;

import java.time.LocalDate;
import java.util.List;
import rw.ac.auca.caseflow.domain.AppealStatus;
import rw.ac.auca.caseflow.domain.CaseStatus;
import rw.ac.auca.caseflow.domain.DecisionType;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;
import rw.ac.auca.caseflow.domain.RegistrationStatus;

public record CaseResponse(
        String id,
        String studentName,
        String studentId,
        String reportedBy,
        String reporterDepartment,
        String offenseType,
        String description,
        String evidence,
        LocalDate reportDate,
        CaseStatus status,
        DecisionType decision,
        LocalDate decisionDate,
        LocalDate suspensionStart,
        LocalDate suspensionEnd,
        boolean appealSubmitted,
        String appealText,
        AppealStatus appealStatus,
        RegistrationStatus registrationStatus,
        List<NoteResponse> notes,
        List<AuditEntryResponse> auditTrail
) {
    public static CaseResponse from(DisciplinaryCase c) {
        return new CaseResponse(
                c.getId(),
                c.getStudentName(),
                c.getStudentId(),
                c.getReportedBy(),
                c.getReporterDepartment(),
                c.getOffenseType(),
                c.getDescription(),
                c.getEvidence(),
                c.getReportDate(),
                c.getStatus(),
                c.getDecision(),
                c.getDecisionDate(),
                c.getSuspensionStart(),
                c.getSuspensionEnd(),
                c.isAppealSubmitted(),
                c.getAppealText(),
                c.getAppealStatus(),
                c.getRegistrationStatus(),
                c.getNotes().stream().map(NoteResponse::from).toList(),
                c.getAuditTrail().stream().map(AuditEntryResponse::from).toList()
        );
    }
}
