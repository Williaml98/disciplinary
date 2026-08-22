package rw.ac.auca.caseflow.service;

import java.time.Instant;
import org.springframework.stereotype.Service;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.UserAuditEntry;
import rw.ac.auca.caseflow.repository.UserAuditRepository;
import rw.ac.auca.caseflow.security.AuthenticatedUser;

/**
 * Records user-management actions, mirroring what {@code AuditEntry} does for cases.
 *
 * <p>Actor names are taken from the authenticated caller rather than from anything client-supplied, so
 * unlike the case audit trail (where {@code by} arrives in the request body) these entries cannot be
 * attributed to someone else.
 */
@Service
public class UserAuditService {

    private final UserAuditRepository repository;

    public UserAuditService(UserAuditRepository repository) {
        this.repository = repository;
    }

    public void record(AuthenticatedUser actor, String action, AppUser target) {
        record(actor, action, target.getId(), target.getName());
    }

    /**
     * Overload for deletion, where the target's details must be captured before the row disappears.
     */
    public void record(AuthenticatedUser actor, String action, Long targetId, String targetName) {
        repository.save(new UserAuditEntry(
                action,
                // Email rather than display name: it's unique and doesn't change when someone edits
                // their profile, so historical entries stay attributable to the right person.
                actor == null ? "System" : actor.email(),
                targetId,
                targetName,
                Instant.now()));
    }
}
