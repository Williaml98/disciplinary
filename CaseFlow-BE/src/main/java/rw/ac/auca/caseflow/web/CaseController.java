package rw.ac.auca.caseflow.web;

import jakarta.validation.Valid;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.web.PageableDefault;
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
import rw.ac.auca.caseflow.domain.CaseStatusTransitions;
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
import rw.ac.auca.caseflow.service.CaseNumberService;
import rw.ac.auca.caseflow.service.CaseStatsService;
import rw.ac.auca.caseflow.storage.EvidenceStorage;
import rw.ac.auca.caseflow.web.dto.AppealRequest;
import rw.ac.auca.caseflow.web.dto.AppealResolutionRequest;
import rw.ac.auca.caseflow.web.dto.CaseResponse;
import rw.ac.auca.caseflow.web.dto.CaseStatsResponse;
import rw.ac.auca.caseflow.web.dto.MonthlyCaseCountResponse;
import rw.ac.auca.caseflow.web.dto.PageResponse;
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
    private final CaseNumberService caseNumberService;
    private final CaseStatsService caseStatsService;

    public CaseController(CaseRepository caseRepository, UserRepository userRepository, EmailService emailService,
                           EvidenceStorage evidenceStorage, CaseReportService caseReportService,
                           CaseNumberService caseNumberService, CaseStatsService caseStatsService) {
        this.caseRepository = caseRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.evidenceStorage = evidenceStorage;
        this.caseReportService = caseReportService;
        this.caseNumberService = caseNumberService;
        this.caseStatsService = caseStatsService;
    }

    /**
     * Paginated, server-side-filtered case list.
     *
     * <p>Student scoping is applied through {@link CaseSpecifications#visibleTo}, so it composes with
     * every filter below rather than being a separate branch that a new filter could bypass.
     */
    @GetMapping
    public PageResponse<CaseResponse> listCases(
            @AuthenticationPrincipal AuthenticatedUser caller,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) List<CaseStatus> status,
            @RequestParam(required = false) RegistrationStatus registrationStatus,
            @RequestParam(required = false) String offenseType,
            @RequestParam(required = false) DecisionType decision,
            @RequestParam(required = false) String reporterDepartment,
            @RequestParam(required = false) String reportedByExact,
            @RequestParam(required = false) Long reportedByUserId,
            @RequestParam(required = false) LocalDate reportDateFrom,
            @RequestParam(required = false) LocalDate reportDateTo,
            @RequestParam(required = false) LocalDate suspensionEndFrom,
            @RequestParam(required = false) LocalDate suspensionEndTo,
            @RequestParam(required = false) Boolean suspensionEndMissing,
            @PageableDefault(size = 20) Pageable pageable) {

        // status/reportedBy are passed as null here: this endpoint uses the multi-valued and
        // exact-match variants instead, while the other five predicates come free from matching().
        CaseReportFilters shared = new CaseReportFilters(
                reportDateFrom, reportDateTo, offenseType, null, decision, reporterDepartment, null);

        Specification<DisciplinaryCase> spec = CaseSpecifications.matching(shared)
                .and(CaseSpecifications.visibleTo(caller.role(), caller.studentId()))
                .and(CaseSpecifications.statusIn(status))
                .and(CaseSpecifications.registrationStatus(registrationStatus))
                .and(CaseSpecifications.reportedBy(reportedByUserId, reportedByExact))
                .and(CaseSpecifications.suspensionEndBetween(suspensionEndFrom, suspensionEndTo))
                .and(CaseSpecifications.suspensionEndMissing(suspensionEndMissing))
                .and(CaseSpecifications.search(search));

        Pageable safe = PageableSupport.sanitize(
                pageable, PageableSupport.CASE_SORTS, Sort.by(Sort.Direction.DESC, "reportDate"));

        return PageResponse.of(
                caseRepository.findAll(spec, safe), c -> CaseResponse.forCaller(c, caller.role()));
    }

    /** Global counts for dashboard badges and tiles — see CaseStatsService for why these exist. */
    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('COMMITTEE','ADMIN')")
    public CaseStatsResponse stats() {
        return caseStatsService.stats();
    }

    @GetMapping("/stats/monthly")
    @PreAuthorize("hasAnyRole('COMMITTEE','ADMIN')")
    public List<MonthlyCaseCountResponse> monthlyStats() {
        return caseStatsService.monthly();
    }

    @GetMapping("/{id}")
    public CaseResponse getCase(@PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        requireCaseAccess(disciplinaryCase, caller);
        return CaseResponse.forCaller(disciplinaryCase, caller.role());
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

    @GetMapping("/{id}/clearance-certificate")
    public ResponseEntity<byte[]> downloadClearanceCertificate(@PathVariable String id,
                                                                 @AuthenticationPrincipal AuthenticatedUser caller) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        requireCaseAccess(disciplinaryCase, caller);
        boolean cleared = disciplinaryCase.getDecision() == DecisionType.CLEARED
                || disciplinaryCase.getAppealStatus() == AppealStatus.OVERTURNED;
        if (!cleared) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This case has not been cleared");
        }

        byte[] pdf = caseReportService.generateClearanceCertificate(disciplinaryCase);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("clearance-" + id + ".pdf").build().toString())
                .body(pdf);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('LECTURER','ADMIN')")
    public CaseResponse reportCase(@Valid @RequestBody NewCaseRequest request,
                                    @AuthenticationPrincipal AuthenticatedUser caller) {
        String id = caseNumberService.next();
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
        // Stamped from the token, not the request body: the display name can be edited later, and a
        // client could otherwise claim to be someone else.
        disciplinaryCase.setReportedByUserId(caller.id());
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
        // Validate the whole batch up front: storing as we go would leave the already-written files
        // orphaned on disk when a later file is rejected and the exception aborts before save().
        evidenceStorage.validateAll(files);
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
        CaseStatus from = disciplinaryCase.getStatus();
        CaseStatus to = request.status();

        if (!CaseStatusTransitions.isAllowed(from, to)) {
            List<CaseStatus> allowed = CaseStatusTransitions.allowedFrom(from);
            throw new ResponseStatusException(HttpStatus.CONFLICT, allowed.isEmpty()
                    ? "A case that is %s cannot be moved by hand — resolve the appeal instead."
                            .formatted(from.wireValue())
                    : "A case cannot go from %s to %s. Allowed: %s.".formatted(
                            from.wireValue(), to.wireValue(),
                            allowed.stream().map(CaseStatus::wireValue).collect(Collectors.joining(", "))));
        }

        disciplinaryCase.setStatus(to);
        disciplinaryCase.addAuditEntry(new AuditEntry(
                "Status changed from %s to %s".formatted(from.wireValue(), to.wireValue()),
                actorOrSystem(request.by()), Instant.now()));
        return CaseResponse.from(caseRepository.save(disciplinaryCase));
    }

    /** Lets the UI offer only the moves the state machine will actually accept. */
    @GetMapping("/{id}/allowed-statuses")
    @PreAuthorize("hasAnyRole('COMMITTEE','ADMIN')")
    public List<CaseStatus> allowedStatuses(@PathVariable String id) {
        return CaseStatusTransitions.allowedFrom(findOrThrow(id).getStatus());
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

        // A sanction the student must serve (suspension/expulsion) stays DECIDED until the
        // re-integration flow clears it. Every other outcome has nothing further to happen, so it
        // resolves here — previously these sat on DECIDED forever, with no path to RESOLVED at all.
        // Appeals are still accepted against a resolved case and reopen it as UNDER_APPEAL.
        CaseStatus newStatus = needsSuspension ? CaseStatus.DECIDED : CaseStatus.RESOLVED;

        disciplinaryCase.recordDecision(
                request.decision(),
                LocalDate.now(),
                needsSuspension ? request.suspensionStart() : null,
                needsSuspension ? request.suspensionEnd() : null);
        disciplinaryCase.setStatus(newStatus);
        disciplinaryCase.setRegistrationStatus(newRegStatus);
        disciplinaryCase.addAuditEntry(new AuditEntry(
                "Decision Recorded: " + request.decision().wireValue(), actor, now));
        disciplinaryCase.addAuditEntry(new AuditEntry(
                "Registration Status: " + newRegStatus.wireValue(), "System", now));
        if (newStatus == CaseStatus.RESOLVED) {
            disciplinaryCase.addAuditEntry(new AuditEntry("Case Resolved", "System", now));
        }
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

        return CaseResponse.forCaller(caseRepository.save(disciplinaryCase), caller.role());
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
            disciplinaryCase.addAuditEntry(new AuditEntry("Registration Status: " + RegistrationStatus.ACTIVE.wireValue(), "System", now));
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
        disciplinaryCase.addAuditEntry(new AuditEntry("Registration Status: " + RegistrationStatus.ACTIVE.wireValue(), "System", now));
        disciplinaryCase.addAuditEntry(new AuditEntry("Case Closed", "System", now));
        disciplinaryCase.addAuditEntry(new AuditEntry("Student Notified via Email", "System", now));
        notifyStudentOfReintegration(disciplinaryCase);

        return CaseResponse.from(caseRepository.save(disciplinaryCase));
    }

    private DisciplinaryCase findOrThrow(String id) {
        return caseRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Case " + id + " not found"));
    }

    private static String actorOrSystem(String by) {
        return (by == null || by.isBlank()) ? "System" : by;
    }

    private static void requireCaseAccess(DisciplinaryCase disciplinaryCase, AuthenticatedUser caller) {
        if (caller.role() == Role.STUDENT && !disciplinaryCase.getStudentId().equals(caller.studentId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this case");
        }
    }

    /** Case reference rows every notification shares, so the three emails stay consistent. */
    private static Map<String, String> caseDetails(DisciplinaryCase disciplinaryCase) {
        Map<String, String> details = new LinkedHashMap<>();
        details.put("Case reference", disciplinaryCase.getId());
        details.put("Offense", disciplinaryCase.getOffenseType());
        details.put("Reported", String.valueOf(disciplinaryCase.getReportDate()));
        return details;
    }

    private void notifyStudentOfDecision(DisciplinaryCase disciplinaryCase) {
        userRepository.findByStudentId(disciplinaryCase.getStudentId()).ifPresent(student -> {
            Map<String, String> details = caseDetails(disciplinaryCase);
            details.put("Decision", disciplinaryCase.getDecision().wireValue());
            details.put("Registration status", disciplinaryCase.getRegistrationStatus().wireValue());
            if (disciplinaryCase.getSuspensionStart() != null) {
                details.put("Suspension period",
                        disciplinaryCase.getSuspensionStart() + " to " + disciplinaryCase.getSuspensionEnd());
            }

            boolean resolved = disciplinaryCase.getStatus() == CaseStatus.RESOLVED;
            emailService.sendCaseNotification(
                    student.getEmail(),
                    "CaseFlow: Decision recorded for case " + disciplinaryCase.getId(),
                    "A decision has been recorded",
                    "Dear " + disciplinaryCase.getStudentName() + ", the disciplinary committee has "
                            + "recorded a decision on your case.",
                    details,
                    resolved
                            ? "This case is now closed. If you believe the decision is incorrect, you may "
                                    + "still submit an appeal from your CaseFlow dashboard."
                            : "You may submit an appeal from your CaseFlow dashboard if you believe this "
                                    + "decision is incorrect.");
        });
    }

    private void notifyStudentOfAppealResolution(DisciplinaryCase disciplinaryCase) {
        userRepository.findByStudentId(disciplinaryCase.getStudentId()).ifPresent(student -> {
            boolean overturned = disciplinaryCase.getAppealStatus() == AppealStatus.OVERTURNED;
            Map<String, String> details = caseDetails(disciplinaryCase);
            details.put("Appeal outcome", disciplinaryCase.getAppealStatus().wireValue());
            details.put("Registration status", disciplinaryCase.getRegistrationStatus().wireValue());

            emailService.sendCaseNotification(
                    student.getEmail(),
                    "CaseFlow: Appeal outcome for case " + disciplinaryCase.getId(),
                    overturned ? "Your appeal was successful" : "Your appeal was reviewed",
                    "Dear " + disciplinaryCase.getStudentName() + ", the committee has reached a decision "
                            + "on your appeal.",
                    details,
                    overturned
                            ? "The original decision has been overturned and this case is now resolved in "
                                    + "your favour."
                            : "The committee upheld its original decision, which therefore stands.");
        });
    }

    private void notifyStudentOfReintegration(DisciplinaryCase disciplinaryCase) {
        userRepository.findByStudentId(disciplinaryCase.getStudentId()).ifPresent(student -> {
            Map<String, String> details = caseDetails(disciplinaryCase);
            details.put("Registration status", disciplinaryCase.getRegistrationStatus().wireValue());

            emailService.sendCaseNotification(
                    student.getEmail(),
                    "CaseFlow: Re-integration approved for case " + disciplinaryCase.getId(),
                    "Your re-integration has been approved",
                    "Dear " + disciplinaryCase.getStudentName() + ", your re-integration following this "
                            + "disciplinary case has been approved.",
                    details,
                    "Your registration status is now Active and this case is closed. You may register for "
                            + "courses as normal.");
        });
    }
}
