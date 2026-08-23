package rw.ac.auca.caseflow.web;

import java.util.Locale;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import rw.ac.auca.caseflow.repository.AuditFeedRepository;
import rw.ac.auca.caseflow.web.dto.AuditFeedEntry;
import rw.ac.auca.caseflow.web.dto.PageResponse;

/**
 * Admin-only chronological audit feed across cases and user management.
 *
 * <p>Replaces the frontend's previous approach of flat-mapping every case's audit trail in the browser,
 * which required loading every case and could never have included user-management actions — those left
 * no trace at all until UserAuditEntry existed.
 */
@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private static final int MAX_PAGE_SIZE = 100;

    private final AuditFeedRepository auditFeedRepository;

    public AuditController(AuditFeedRepository auditFeedRepository) {
        this.auditFeedRepository = auditFeedRepository;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public PageResponse<AuditFeedEntry> feed(
            @RequestParam(required = false) String kind,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        if (kind != null && !kind.isBlank() && !kind.equals("CASE") && !kind.equals("USER")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "kind must be 'CASE' or 'USER'");
        }
        // Sortless on purpose — the union's ordering is fixed in the query. See AuditFeedRepository.
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
        return PageResponse.of(
                auditFeedRepository.findFeed(
                        kind == null || kind.isBlank() ? null : kind,
                        likePattern(search),
                        pageable),
                AuditFeedEntry::from);
    }

    /**
     * Lower-cased and wrapped for a LIKE. An absent search becomes a bare {@code "%"} rather than null:
     * Postgres cannot infer a type for a null bind used only inside LIKE and fails the whole query, so
     * the "no filter" case is expressed as a pattern that matches everything.
     *
     * <p>% and _ in a real search are escaped (against the '!' in the query's ESCAPE clauses) so they
     * match literally instead of behaving as wildcards.
     */
    private static String likePattern(String search) {
        if (search == null || search.isBlank()) {
            return "%";
        }
        String escaped = search.toLowerCase(Locale.ROOT)
                .replace("!", "!!").replace("%", "!%").replace("_", "!_");
        return "%" + escaped + "%";
    }
}
