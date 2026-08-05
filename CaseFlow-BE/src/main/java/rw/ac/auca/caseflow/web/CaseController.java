package rw.ac.auca.caseflow.web;

import jakarta.validation.Valid;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.util.List;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import rw.ac.auca.caseflow.domain.AppealStatus;
import rw.ac.auca.caseflow.domain.AuditEntry;
import rw.ac.auca.caseflow.domain.CaseStatus;
import rw.ac.auca.caseflow.domain.DecisionType;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;
import rw.ac.auca.caseflow.domain.Note;
import rw.ac.auca.caseflow.domain.RegistrationStatus;
import rw.ac.auca.caseflow.domain.Role;
import rw.ac.auca.caseflow.email.EmailService;
import rw.ac.auca.caseflow.repository.CaseRepository;
import rw.ac.auca.caseflow.repository.UserRepository;
import rw.ac.auca.caseflow.reporting.CaseReportService;
import rw.ac.auca.caseflow.reporting.CaseSpecifications;
import rw.ac.auca.caseflow.reporting.CaseSpecifications.CaseReportFilters;
import rw.ac.auca.caseflow.security.AuthenticatedUser;
import rw.ac.auca.caseflow.storage.EvidenceStorage;
import rw.ac.auca.caseflow.web.dto.AppealRequest;
import rw.ac.auca.caseflow.web.dto.AppealResolutionRequest;
import rw.ac.auca.caseflow.web.dto.CaseResponse;
import rw.ac.auca.caseflow.web.dto.DecisionRequest;
import rw.ac.auca.caseflow.web.dto.NewCaseRequest;
import rw.ac.auca.caseflow.web.dto.NoteRequest;
import rw.ac.auca.caseflow.web.dto.ReintegrationRequest;
import rw.ac.auca.caseflow.web.dto.StatusUpdateRequest;

@RestController
@RequestMapping("/api/cases")
public class CaseController {

    private final CaseRepository caseRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final EvidenceStorage evidenceStorage;
    private final CaseReportService caseReportService;

    public CaseController(CaseRepository caseRepository, UserRepository userRepository, EmailService emailService,
                           EvidenceStorage evidenceStorage, CaseReportService caseReportService) {
        this.caseRepository = caseRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.evidenceStorage = evidenceStorage;
        this.caseReportService = caseReportService;
    }

    @GetMapping
    public List<CaseResponse> listCases(@AuthenticationPrincipal AuthenticatedUser caller) {
        List<DisciplinaryCase> cases = caller.role() == Role.STUDENT
                ? caseRepository.findByStudentId(caller.studentId())
                : caseRepository.findAll();
        return cases.stream().map(CaseResponse::from).toList();
    }

    @GetMapping("/{id}")
    public CaseResponse getCase(@PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        requireCaseAccess(disciplinaryCase, caller);
        return CaseResponse.from(disciplinaryCase);
    }

    @GetMapping("/report")
    @PreAuthorize("hasAnyRole('LECTURER','COMMITTEE','ADMIN')")
    public ResponseEntity<byte[]> generateReport(
            @RequestParam(defaultValue = "pdf") String format,
            @RequestParam(required = false) LocalDate reportDateFrom,
            @RequestParam(required = false) LocalDate reportDateTo,
            @RequestParam(required = false) String offenseType,
            @RequestParam(required = false) CaseStatus status,
            @RequestParam(required = false) DecisionType decision,
            @RequestParam(required = false) String reporterDepartment,
            @RequestParam(required = false) String reportedBy) {
        CaseReportFilters filters = new CaseReportFilters(
                reportDateFrom, reportDateTo, offenseType, status, decision, reporterDepartment, reportedBy);
        List<DisciplinaryCase> cases = caseRepository.findAll(CaseSpecifications.matching(filters));

        byte[] body;
        MediaType contentType;
        String filename;
        if ("csv".equalsIgnoreCase(format)) {
            body = caseReportService.generateCsv(cases);
            contentType = MediaType.parseMediaType("text/csv");
            filename = "caseflow-report-" + LocalDate.now() + ".csv";
        } else if ("pdf".equalsIgnoreCase(format)) {
            body = caseReportService.generatePdf(cases, filters);
            contentType = MediaType.APPLICATION_PDF;
            filename = "caseflow-report-" + LocalDate.now() + ".pdf";
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "format must be 'pdf' or 'csv'");
        }

        return ResponseEntity.ok()
                .contentType(contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(body);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('LECTURER','ADMIN')")
    public CaseResponse reportCase(@Valid @RequestBody NewCaseRequest request) {
        String id = nextCaseId();
        Instant now = Instant.now();

        DisciplinaryCase disciplinaryCase = new DisciplinaryCase(
                id,
                request.studentName(),
                request.studentId(),
                request.reportedBy(),
                request.reporterDepartment(),
                request.offenseType(),
                request.description(),
                request.evidence() == null || request.evidence().isBlank() ? "No evidence attached" : request.evidence(),
                LocalDate.now(),
                CaseStatus.REPORTED,
                RegistrationStatus.FLAGGED
        );
        disciplinaryCase.addAuditEntry(new AuditEntry("Incident Reported", request.reportedBy(), now));
        disciplinaryCase.addAuditEntry(new AuditEntry("Case " + id + " Created", "System", now));
        disciplinaryCase.addAuditEntry(new AuditEntry("Committee Chair Notified", "System", now));

        return CaseResponse.from(caseRepository.save(disciplinaryCase));
    }

    @PostMapping("/{id}/evidence")
    @PreAuthorize("hasAnyRole('LECTURER','ADMIN')")
    public CaseResponse uploadEvidence(@PathVariable String id,
                                        @RequestParam("files") List<MultipartFile> files,
                                        @RequestParam(value = "by", required = false) String by) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        for (MultipartFile file : files) {
            disciplinaryCase.addEvidenceFile(evidenceStorage.store(id, file));
        }
        disciplinaryCase.addAuditEntry(new AuditEntry(
                "Evidence Uploaded (" + files.size() + " file" + (files.size() == 1 ? "" : "s") + ")",
                actorOrSystem(by), Instant.now()));
        return CaseResponse.from(caseRepository.save(disciplinaryCase));
    }

    @GetMapping("/{id}/evidence/{filename}")
    public ResponseEntity<Resource> getEvidenceFile(@PathVariable String id, @PathVariable String filename) {
        Resource resource = evidenceStorage.load(id, filename);
        MediaType contentType = MediaTypeFactory.getMediaType(resource).orElse(MediaType.APPLICATION_OCTET_STREAM);
        return ResponseEntity.ok().contentType(contentType).body(resource);
    }

    @PostMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('COMMITTEE','ADMIN')")
    public CaseResponse updateStatus(@PathVariable String id, @Valid @RequestBody StatusUpdateRequest request) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        disciplinaryCase.setStatus(request.status());
        disciplinaryCase.addAuditEntry(new AuditEntry(
                "Status set to: " + request.status().wireValue(), actorOrSystem(request.by()), Instant.now()));
        return CaseResponse.from(caseRepository.save(disciplinaryCase));
    }

    @PostMapping("/{id}/notes")
    @PreAuthorize("hasRole('COMMITTEE')")
    public CaseResponse addNote(@PathVariable String id, @Valid @RequestBody NoteRequest request) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        Instant now = Instant.now();

        boolean statusChanged = disciplinaryCase.getStatus() == CaseStatus.REPORTED;
        if (statusChanged) {
            disciplinaryCase.setStatus(CaseStatus.UNDER_REVIEW);
        }
        disciplinaryCase.addNote(new Note(request.author(), request.text(), now));
        if (statusChanged) {
            disciplinaryCase.addAuditEntry(new AuditEntry(
                    "Status set to: " + CaseStatus.UNDER_REVIEW.wireValue(), request.author(), now));
        }
        disciplinaryCase.addAuditEntry(new AuditEntry("Note Added", request.author(), now));

        return CaseResponse.from(caseRepository.save(disciplinaryCase));
    }

    @PostMapping("/{id}/decision")
    @PreAuthorize("hasRole('COMMITTEE')")
    public CaseResponse recordDecision(@PathVariable String id, @Valid @RequestBody DecisionRequest request) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        String actor = actorOrSystem(request.by());
        Instant now = Instant.now();
        boolean needsSuspension = request.decision() == DecisionType.SEMESTER_SUSPENSION
                || request.decision() == DecisionType.EXPULSION;
        RegistrationStatus newRegStatus = needsSuspension ? RegistrationStatus.RESTRICTED : RegistrationStatus.ACTIVE;

        disciplinaryCase.recordDecision(
                request.decision(),
                LocalDate.now(),
                needsSuspension ? request.suspensionStart() : null,
                needsSuspension ? request.suspensionEnd() : null);
        disciplinaryCase.setStatus(CaseStatus.DECIDED);
        disciplinaryCase.setRegistrationStatus(newRegStatus);
        disciplinaryCase.addAuditEntry(new AuditEntry(
                "Decision Recorded: " + request.decision().wireValue(), actor, now));
        disciplinaryCase.addAuditEntry(new AuditEntry(
                "Registration Status: " + newRegStatus.name(), "System", now));
        disciplinaryCase.addAuditEntry(new AuditEntry("Student Notified via Email", "System", now));
        notifyStudentOfDecision(disciplinaryCase);

        return CaseResponse.from(caseRepository.save(disciplinaryCase));
    }

    @PostMapping("/{id}/appeal")
    @PreAuthorize("hasRole('STUDENT')")
    public CaseResponse submitAppeal(@PathVariable String id, @Valid @RequestBody AppealRequest request,
                                      @AuthenticationPrincipal AuthenticatedUser caller) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        requireCaseAccess(disciplinaryCase, caller);
        Instant now = Instant.now();

        disciplinaryCase.submitAppeal(request.appealText());
        disciplinaryCase.setStatus(CaseStatus.UNDER_APPEAL);
        disciplinaryCase.addAuditEntry(new AuditEntry("Appeal Submitted by Student", disciplinaryCase.getStudentName(), now));
        disciplinaryCase.addAuditEntry(new AuditEntry(
                "Status set to: " + CaseStatus.UNDER_APPEAL.wireValue(), "System", now));

        return CaseResponse.from(caseRepository.save(disciplinaryCase));
    }

    @PostMapping("/{id}/appeal/resolution")
    @PreAuthorize("hasRole('COMMITTEE')")
    public CaseResponse resolveAppeal(@PathVariable String id, @Valid @RequestBody AppealResolutionRequest request) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        String actor = actorOrSystem(request.by());
        Instant now = Instant.now();
        boolean overturned = request.resolution() == AppealStatus.OVERTURNED;

        disciplinaryCase.resolveAppeal(request.resolution());
        disciplinaryCase.setStatus(overturned ? CaseStatus.RESOLVED : CaseStatus.DECIDED);
        disciplinaryCase.addAuditEntry(new AuditEntry(
                "Appeal " + request.resolution().wireValue() + " by Committee", actor, now));

        if (overturned) {
            disciplinaryCase.setRegistrationStatus(RegistrationStatus.ACTIVE);
            disciplinaryCase.addAuditEntry(new AuditEntry("Registration Status: ACTIVE", "System", now));
            disciplinaryCase.addAuditEntry(new AuditEntry("Case Resolved", "System", now));
        }
        disciplinaryCase.addAuditEntry(new AuditEntry("Student Notified via Email", "System", now));
        notifyStudentOfAppealResolution(disciplinaryCase);

        return CaseResponse.from(caseRepository.save(disciplinaryCase));
    }

    @PostMapping("/{id}/reintegration")
    @PreAuthorize("hasRole('COMMITTEE')")
    public CaseResponse approveReintegration(@PathVariable String id, @Valid @RequestBody ReintegrationRequest request) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        String actor = actorOrSystem(request.by());
        Instant now = Instant.now();

        disciplinaryCase.setStatus(CaseStatus.RESOLVED);
        disciplinaryCase.setRegistrationStatus(RegistrationStatus.ACTIVE);
        disciplinaryCase.addAuditEntry(new AuditEntry("Re-integration Approved", actor, now));
        disciplinaryCase.addAuditEntry(new AuditEntry("Registration Status: ACTIVE", "System", now));
        disciplinaryCase.addAuditEntry(new AuditEntry("Case Closed", "System", now));
        disciplinaryCase.addAuditEntry(new AuditEntry("Student Notified via Email", "System", now));
        notifyStudentOfReintegration(disciplinaryCase);

        return CaseResponse.from(caseRepository.save(disciplinaryCase));
    }

    private DisciplinaryCase findOrThrow(String id) {
        return caseRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Case " + id + " not found"));
    }

    private String nextCaseId() {
        int year = Year.now().getValue();
        long sequence = caseRepository.count() + 1;
        return "CF-%d-%03d".formatted(year, sequence);
    }

    private static String actorOrSystem(String by) {
        return (by == null || by.isBlank()) ? "System" : by;
    }

    private static void requireCaseAccess(DisciplinaryCase disciplinaryCase, AuthenticatedUser caller) {
        if (caller.role() == Role.STUDENT && !disciplinaryCase.getStudentId().equals(caller.studentId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this case");
        }
    }

    private void notifyStudentOfDecision(DisciplinaryCase disciplinaryCase) {
        userRepository.findByStudentId(disciplinaryCase.getStudentId()).ifPresent(student -> {
            String subject = "CaseFlow: Decision recorded for case " + disciplinaryCase.getId();
            String body = """
                    Dear %s,

                    A decision has been recorded for your disciplinary case %s (%s).

                    Decision: %s

                    Please log in to CaseFlow for full details.

                    — AUCA Disciplinary Committee
                    """.formatted(
                    disciplinaryCase.getStudentName(),
                    disciplinaryCase.getId(),
                    disciplinaryCase.getOffenseType(),
                    disciplinaryCase.getDecision().wireValue());
            emailService.send(student.getEmail(), subject, body);
        });
    }

    private void notifyStudentOfAppealResolution(DisciplinaryCase disciplinaryCase) {
        userRepository.findByStudentId(disciplinaryCase.getStudentId()).ifPresent(student -> {
            String subject = "CaseFlow: Appeal outcome for case " + disciplinaryCase.getId();
            String body = """
                    Dear %s,

                    The committee has reached a decision on your appeal for disciplinary case %s (%s).

                    Appeal outcome: %s

                    Please log in to CaseFlow for full details.

                    — AUCA Disciplinary Committee
                    """.formatted(
                    disciplinaryCase.getStudentName(),
                    disciplinaryCase.getId(),
                    disciplinaryCase.getOffenseType(),
                    disciplinaryCase.getAppealStatus().wireValue());
            emailService.send(student.getEmail(), subject, body);
        });
    }

    private void notifyStudentOfReintegration(DisciplinaryCase disciplinaryCase) {
        userRepository.findByStudentId(disciplinaryCase.getStudentId()).ifPresent(student -> {
            String subject = "CaseFlow: Re-integration approved for case " + disciplinaryCase.getId();
            String body = """
                    Dear %s,

                    Your re-integration following disciplinary case %s (%s) has been approved. Your registration status is now Active.

                    Please log in to CaseFlow for full details.

                    — AUCA Disciplinary Committee
                    """.formatted(
                    disciplinaryCase.getStudentName(),
                    disciplinaryCase.getId(),
                    disciplinaryCase.getOffenseType());
            emailService.send(student.getEmail(), subject, body);
        });
    }
}
