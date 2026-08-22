package rw.ac.auca.caseflow.web.dto;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import rw.ac.auca.caseflow.repository.AuditFeedRepository.AuditFeedRow;

/**
 * One row of the merged admin audit feed. {@code caseId} is set for case actions and
 * {@code targetUserName} for user-management actions; the frontend renders the shared fields
 * identically and swaps only the reference chip.
 */
public record AuditFeedEntry(
        String kind,
        Long id,
        String action,
        String by,
        Instant timestamp,
        String caseId,
        Long targetUserId,
        String targetUserName
) {
    public static AuditFeedEntry from(AuditFeedRow row) {
        return new AuditFeedEntry(
                row.getKind(),
                row.getEntryId(),
                row.getAction(),
                row.getActor(),
                toInstant(row.getTs()),
                row.getCaseId(),
                row.getTargetUserId(),
                row.getTargetUserName());
    }

    /**
     * The feed is a native query, so the timestamp arrives as whatever JDBC type the driver picked —
     * H2 and Postgres do not agree. Normalising every plausible shape here keeps the wire format
     * identical on both, rather than working in tests and failing in production (or vice versa).
     *
     * <p>A bare LocalDateTime carries no zone; it is read as UTC because that is what every timestamp
     * in this system is written as.
     */
    private static Instant toInstant(Object value) {
        return switch (value) {
            case null -> null;
            case Instant instant -> instant;
            case OffsetDateTime offset -> offset.toInstant();
            case Timestamp timestamp -> timestamp.toInstant();
            case LocalDateTime local -> local.toInstant(ZoneOffset.UTC);
            default -> throw new IllegalStateException(
                    "Unsupported audit timestamp type: " + value.getClass().getName());
        };
    }
}
