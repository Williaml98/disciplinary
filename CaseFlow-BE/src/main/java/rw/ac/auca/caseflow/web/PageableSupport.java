package rw.ac.auca.caseflow.web;

import java.util.List;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Sanitises a client-supplied {@link Pageable} before it reaches a repository.
 *
 * <p>Two problems with binding {@code ?sort=} straight through: an unknown property throws
 * {@code PropertyReferenceException} (a 500, not a 400), and any real property is sortable — including
 * ones no caller should be ordering by.
 *
 * <p>It also appends {@code id} as a final sort key. That is not cosmetic. Cases are stamped with
 * {@code LocalDate.now()}, so same-day ties are the norm rather than the exception, and an
 * {@code ORDER BY report_date} with {@code LIMIT/OFFSET} over tied rows returns an arbitrary window —
 * meaning rows genuinely duplicate across pages and vanish from others.
 */
final class PageableSupport {

    static final Set<String> CASE_SORTS =
            Set.of("id", "reportDate", "studentName", "studentId", "status", "offenseType", "decisionDate");

    static final Set<String> USER_SORTS = Set.of("id", "name", "email", "role", "department");

    private PageableSupport() {
    }

    static Pageable sanitize(Pageable pageable, Set<String> allowed, Sort fallback) {
        List<Sort.Order> kept = pageable.getSort().stream()
                .filter(order -> allowed.contains(order.getProperty()))
                .toList();
        Sort sort = kept.isEmpty() ? fallback : Sort.by(kept);
        return PageRequest.of(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                sort.and(Sort.by(Sort.Direction.DESC, "id")));
    }
}
