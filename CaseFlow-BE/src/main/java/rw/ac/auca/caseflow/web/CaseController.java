package rw.ac.auca.caseflow.web;

import jakarta.validation.Valid;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import rw.ac.auca.caseflow.domain.AppealStatus;
import rw.ac.auca.caseflow.domain.AuditEntry;
import rw.ac.auca.caseflow.domain.CaseStatus;
import rw.ac.auca.caseflow.domain.DecisionType;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;
import rw.ac.auca.caseflow.domain.Note;
import rw.ac.auca.caseflow.domain.RegistrationStatus;
import rw.ac.auca.caseflow.repository.CaseRepository;
import rw.ac.auca.caseflow.web.dto.AppealRequest;
import rw.ac.auca.caseflow.web.dto.AppealResolutionRequest;
import rw.ac.auca.caseflow.web.dto.CaseResponse;
import rw.ac.auca.caseflow.web.dto.DecisionRequest;
import rw.ac.auca.caseflow.web.dto.NewCaseRequest;
import rw.ac.auca.caseflow.web.dto.NoteRequest;
import rw.ac.auca.caseflow.web.dto.StatusUpdateRequest;

@RestController
@RequestMapping("/api/cases")
public class CaseController {

    private final CaseRepository caseRepository;

    public CaseController(CaseRepository caseRepository) {
        this.caseRepository = caseRepository;
    }

    @GetMapping
    public List<CaseResponse> listCases() {
        return caseRepository.findAll().stream().map(CaseResponse::from).toList();
    }

    @GetMapping("/{id}")
    public CaseResponse getCase(@PathVariable String id) {
        return CaseResponse.from(findOrThrow(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
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

    @PostMapping("/{id}/status")
    public CaseResponse updateStatus(@PathVariable String id, @Valid @RequestBody StatusUpdateRequest request) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        disciplinaryCase.setStatus(request.status());
        disciplinaryCase.addAuditEntry(new AuditEntry(
                "Status set to: " + display(request.status()), actorOrSystem(request.by()), Instant.now()));
        return CaseResponse.from(caseRepository.save(disciplinaryCase));
    }

    @PostMapping("/{id}/notes")
    public CaseResponse addNote(@PathVariable String id, @Valid @RequestBody NoteRequest request) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        Instant now = Instant.now();
        disciplinaryCase.addNote(new Note(request.author(), request.text(), now));
        disciplinaryCase.addAuditEntry(new AuditEntry("Note Added", request.author(), now));
        return CaseResponse.from(caseRepository.save(disciplinaryCase));
    }

    @PostMapping("/{id}/decision")
    public CaseResponse recordDecision(@PathVariable String id, @Valid @RequestBody DecisionRequest request) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        String actor = actorOrSystem(request.by());
        Instant now = Instant.now();

        disciplinaryCase.recordDecision(request.decision(), LocalDate.now(), request.suspensionStart(), request.suspensionEnd());
        disciplinaryCase.setStatus(CaseStatus.DECIDED);
        disciplinaryCase.addAuditEntry(new AuditEntry("Decision Recorded: " + display(request.decision()), actor, now));

        if (request.decision() == DecisionType.SEMESTER_SUSPENSION || request.decision() == DecisionType.EXPULSION) {
            disciplinaryCase.setRegistrationStatus(RegistrationStatus.RESTRICTED);
            disciplinaryCase.addAuditEntry(new AuditEntry("Registration Status: RESTRICTED", "System", now));
        }
        disciplinaryCase.addAuditEntry(new AuditEntry("Student Notified via Email", "System", now));

        return CaseResponse.from(caseRepository.save(disciplinaryCase));
    }

    @PostMapping("/{id}/appeal")
    public CaseResponse submitAppeal(@PathVariable String id, @Valid @RequestBody AppealRequest request) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        Instant now = Instant.now();

        disciplinaryCase.submitAppeal(request.appealText());
        disciplinaryCase.setStatus(CaseStatus.UNDER_APPEAL);
        disciplinaryCase.addAuditEntry(new AuditEntry("Appeal Submitted by Student", disciplinaryCase.getStudentName(), now));
        disciplinaryCase.addAuditEntry(new AuditEntry("Status set to: " + display(CaseStatus.UNDER_APPEAL), "System", now));

        return CaseResponse.from(caseRepository.save(disciplinaryCase));
    }

    @PostMapping("/{id}/appeal/resolution")
    public CaseResponse resolveAppeal(@PathVariable String id, @Valid @RequestBody AppealResolutionRequest request) {
        DisciplinaryCase disciplinaryCase = findOrThrow(id);
        String actor = actorOrSystem(request.by());
        Instant now = Instant.now();

        disciplinaryCase.resolveAppeal(request.resolution());
        disciplinaryCase.setStatus(CaseStatus.RESOLVED);
        disciplinaryCase.addAuditEntry(new AuditEntry("Appeal " + display(request.resolution()), actor, now));

        if (request.resolution() == AppealStatus.OVERTURNED) {
            disciplinaryCase.setRegistrationStatus(RegistrationStatus.ACTIVE);
            disciplinaryCase.addAuditEntry(new AuditEntry("Registration Status: ACTIVE", "System", now));
        }

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

    private static String display(Enum<?> value) {
        String[] words = value.name().split("_");
        StringBuilder result = new StringBuilder();
        for (String word : words) {
            if (!result.isEmpty()) {
                result.append(' ');
            }
            result.append(word.substring(0, 1).toUpperCase(Locale.ROOT))
                    .append(word.substring(1).toLowerCase(Locale.ROOT));
        }
        return result.toString();
    }
}
