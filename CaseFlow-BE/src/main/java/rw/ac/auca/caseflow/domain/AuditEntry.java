package rw.ac.auca.caseflow.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "audit_entry")
public class AuditEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "case_id", nullable = false)
    private DisciplinaryCase disciplinaryCase;

    @Column(nullable = false)
    private String action;

    @Column(nullable = false)
    private String by;

    @Column(nullable = false)
    private Instant timestamp;

    protected AuditEntry() {
    }

    public AuditEntry(String action, String by, Instant timestamp) {
        this.action = action;
        this.by = by;
        this.timestamp = timestamp;
    }

    public Long getId() {
        return id;
    }

    public String getAction() {
        return action;
    }

    public String getBy() {
        return by;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    void setDisciplinaryCase(DisciplinaryCase disciplinaryCase) {
        this.disciplinaryCase = disciplinaryCase;
    }
}
