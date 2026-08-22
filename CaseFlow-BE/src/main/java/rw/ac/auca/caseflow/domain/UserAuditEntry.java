package rw.ac.auca.caseflow.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Audit record for user-management actions (create, edit, role change, activate/deactivate, delete).
 * Case actions have {@link AuditEntry}; until this existed, everything an admin did to an account left
 * no trace at all.
 *
 * <p>Deliberately holds no {@code @ManyToOne} to {@link AppUser} and no foreign key. The single most
 * important thing this table records is a <em>deletion</em>, and an FK would either block the delete or
 * cascade the audit row away with the account — in both cases destroying the record it exists to keep.
 * The target's id is stored as a loose {@code Long} and their name is snapshotted at write time.
 */
@Entity
@Table(name = "user_audit_entry")
public class UserAuditEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Human-readable description, e.g. "Role changed from Lecturer to Admin". */
    @Column(nullable = false)
    private String action;

    /** Display name of the acting admin, matching AuditEntry.by. */
    @Column(nullable = false)
    private String actor;

    /** Nullable and unconstrained on purpose — see the class comment. */
    private Long targetUserId;

    @Column(nullable = false)
    private String targetUserName;

    @Column(nullable = false)
    private Instant timestamp;

    protected UserAuditEntry() {
    }

    public UserAuditEntry(String action, String actor, Long targetUserId, String targetUserName, Instant timestamp) {
        this.action = action;
        this.actor = actor;
        this.targetUserId = targetUserId;
        this.targetUserName = targetUserName;
        this.timestamp = timestamp;
    }

    public Long getId() {
        return id;
    }

    public String getAction() {
        return action;
    }

    public String getActor() {
        return actor;
    }

    public Long getTargetUserId() {
        return targetUserId;
    }

    public String getTargetUserName() {
        return targetUserName;
    }

    public Instant getTimestamp() {
        return timestamp;
    }
}
