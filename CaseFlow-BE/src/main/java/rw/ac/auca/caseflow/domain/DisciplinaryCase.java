package rw.ac.auca.caseflow.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "disciplinary_case")
public class DisciplinaryCase {

    @Id
    private String id;

    @Column(nullable = false)
    private String studentName;

    @Column(nullable = false)
    private String studentId;

    @Column(nullable = false)
    private String reportedBy;

    private String reporterDepartment;

    @Column(nullable = false)
    private String offenseType;

    @Column(nullable = false, length = 4000)
    private String description;

    @Column(length = 2000)
    private String evidence;

    @Column(nullable = false)
    private LocalDate reportDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CaseStatus status;

    @Enumerated(EnumType.STRING)
    private DecisionType decision;

    private LocalDate decisionDate;

    private LocalDate suspensionStart;

    private LocalDate suspensionEnd;

    @Column(nullable = false)
    private boolean appealSubmitted;

    @Column(length = 4000)
    private String appealText;

    @Enumerated(EnumType.STRING)
    private AppealStatus appealStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RegistrationStatus registrationStatus;

    // EAGER: open-in-view is disabled, and CaseResponse always serializes these outside
    // any transaction, so LAZY throws LazyInitializationException on every read.
    @OneToMany(mappedBy = "disciplinaryCase", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("timestamp asc")
    private List<Note> notes = new ArrayList<>();

    @OneToMany(mappedBy = "disciplinaryCase", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("timestamp asc")
    private List<AuditEntry> auditTrail = new ArrayList<>();

    // EAGER for the same reason as notes/auditTrail above: open-in-view is disabled and
    // CaseResponse serializes this outside any transaction.
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "case_evidence_files", joinColumns = @JoinColumn(name = "case_id"))
    @OrderColumn(name = "position")
    @Column(name = "filename")
    private List<String> evidenceFiles = new ArrayList<>();

    protected DisciplinaryCase() {
    }

    public DisciplinaryCase(String id, String studentName, String studentId, String reportedBy,
                             String reporterDepartment, String offenseType, String description,
                             String evidence, LocalDate reportDate, CaseStatus status,
                             RegistrationStatus registrationStatus) {
        this.id = id;
        this.studentName = studentName;
        this.studentId = studentId;
        this.reportedBy = reportedBy;
        this.reporterDepartment = reporterDepartment;
        this.offenseType = offenseType;
        this.description = description;
        this.evidence = evidence;
        this.reportDate = reportDate;
        this.status = status;
        this.registrationStatus = registrationStatus;
        this.appealSubmitted = false;
    }

    public void addNote(Note note) {
        note.setDisciplinaryCase(this);
        notes.add(note);
    }

    public void addAuditEntry(AuditEntry entry) {
        entry.setDisciplinaryCase(this);
        auditTrail.add(entry);
    }

    public String getId() {
        return id;
    }

    public String getStudentName() {
        return studentName;
    }

    public String getStudentId() {
        return studentId;
    }

    public String getReportedBy() {
        return reportedBy;
    }

    public String getReporterDepartment() {
        return reporterDepartment;
    }

    public String getOffenseType() {
        return offenseType;
    }

    public String getDescription() {
        return description;
    }

    public String getEvidence() {
        return evidence;
    }

    public LocalDate getReportDate() {
        return reportDate;
    }

    public CaseStatus getStatus() {
        return status;
    }

    public void setStatus(CaseStatus status) {
        this.status = status;
    }

    public DecisionType getDecision() {
        return decision;
    }

    public LocalDate getDecisionDate() {
        return decisionDate;
    }

    public LocalDate getSuspensionStart() {
        return suspensionStart;
    }

    public LocalDate getSuspensionEnd() {
        return suspensionEnd;
    }

    public void recordDecision(DecisionType decision, LocalDate decisionDate, LocalDate suspensionStart, LocalDate suspensionEnd) {
        this.decision = decision;
        this.decisionDate = decisionDate;
        this.suspensionStart = suspensionStart;
        this.suspensionEnd = suspensionEnd;
    }

    public boolean isAppealSubmitted() {
        return appealSubmitted;
    }

    public String getAppealText() {
        return appealText;
    }

    public AppealStatus getAppealStatus() {
        return appealStatus;
    }

    public void submitAppeal(String appealText) {
        this.appealSubmitted = true;
        this.appealText = appealText;
        this.appealStatus = AppealStatus.PENDING;
    }

    public void resolveAppeal(AppealStatus resolution) {
        this.appealStatus = resolution;
    }

    public RegistrationStatus getRegistrationStatus() {
        return registrationStatus;
    }

    public void setRegistrationStatus(RegistrationStatus registrationStatus) {
        this.registrationStatus = registrationStatus;
    }

    public List<Note> getNotes() {
        return notes;
    }

    public List<AuditEntry> getAuditTrail() {
        return auditTrail;
    }

    public List<String> getEvidenceFiles() {
        return evidenceFiles;
    }

    public void addEvidenceFile(String filename) {
        evidenceFiles.add(filename);
    }
}
