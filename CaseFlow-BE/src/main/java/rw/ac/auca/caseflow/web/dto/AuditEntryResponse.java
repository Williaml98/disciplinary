package rw.ac.auca.caseflow.web.dto;

import java.time.Instant;
import rw.ac.auca.caseflow.domain.AuditEntry;

public record AuditEntryResponse(Long id, String action, String by, Instant timestamp) {
    public static AuditEntryResponse from(AuditEntry entry) {
        return new AuditEntryResponse(entry.getId(), entry.getAction(), entry.getBy(), entry.getTimestamp());
    }
}
