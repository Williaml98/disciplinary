package rw.ac.auca.caseflow.web.dto;

import java.time.LocalDate;
import java.util.List;
import rw.ac.auca.caseflow.domain.AppealStatus;
import rw.ac.auca.caseflow.domain.CaseStatus;
import rw.ac.auca.caseflow.domain.DecisionType;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;
import rw.ac.auca.caseflow.domain.RegistrationStatus;
import rw.ac.auca.caseflow.domain.Role;

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
        List<AuditEntryResponse> auditTrail,
        List<String> evidenceFiles
) {
    /**
     * Full view — for lecturer, committee and admin callers.
     *
     * <p>Prefer {@link #forCaller} at request boundaries: committee deliberation notes are internal, and
     * this overload includes them.
     */
    public static CaseResponse from(DisciplinaryCase c) {
        return build(c, true);
    }

    /**
     * Caller-scoped view. Students get everything about their own case — description, evidence, the
     * decision and the full audit trail — except the committee's deliberation notes, which are internal
     * working notes rather than part of the record served to the student.
     */
    public static CaseResponse forCaller(DisciplinaryCase c, Role callerRole) {
        return build(c, callerRole != Role.STUDENT);
    }

    private static CaseResponse build(DisciplinaryCase c, boolean includeNotes) {
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
                includeNotes ? c.getNotes().stream().map(NoteResponse::from).toList() : List.of(),
                c.getAuditTrail().stream().map(AuditEntryResponse::from).toList(),
                c.getEvidenceFiles().stream().map(f -> "/cases/" + c.getId() + "/evidence/" + f).toList()
        );
    }
}
