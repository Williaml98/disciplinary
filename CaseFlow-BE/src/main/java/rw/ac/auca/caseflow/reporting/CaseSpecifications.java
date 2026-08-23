package rw.ac.auca.caseflow.reporting;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;
import rw.ac.auca.caseflow.domain.CaseStatus;
import rw.ac.auca.caseflow.domain.DecisionType;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;
import rw.ac.auca.caseflow.domain.RegistrationStatus;
import rw.ac.auca.caseflow.domain.Role;

// Builds a single combined Specification from whichever report filters were actually supplied —
// every field here is optional and AND'ed together with whatever else was set.
public final class CaseSpecifications {

    private CaseSpecifications() {
    }

    public static Specification<DisciplinaryCase> matching(CaseReportFilters filters) {
        List<Specification<DisciplinaryCase>> predicates = new ArrayList<>();

        if (filters.reportDateFrom() != null) {
            predicates.add((root, query, cb) ->
                    cb.greaterThanOrEqualTo(root.get("reportDate"), filters.reportDateFrom()));
        }
        if (filters.reportDateTo() != null) {
            predicates.add((root, query, cb) ->
                    cb.lessThanOrEqualTo(root.get("reportDate"), filters.reportDateTo()));
        }
        if (filters.offenseType() != null && !filters.offenseType().isBlank()) {
            predicates.add((root, query, cb) ->
                    cb.equal(root.get("offenseType"), filters.offenseType()));
        }
        if (filters.status() != null) {
            predicates.add((root, query, cb) -> cb.equal(root.get("status"), filters.status()));
        }
        if (filters.decision() != null) {
            predicates.add((root, query, cb) -> cb.equal(root.get("decision"), filters.decision()));
        }
        if (filters.reporterDepartment() != null && !filters.reporterDepartment().isBlank()) {
            predicates.add((root, query, cb) -> cb.like(
                    cb.lower(root.get("reporterDepartment")), "%" + filters.reporterDepartment().toLowerCase() + "%"));
        }
        if (filters.reportedBy() != null && !filters.reportedBy().isBlank()) {
            predicates.add((root, query, cb) -> cb.like(
                    cb.lower(root.get("reportedBy")), "%" + filters.reportedBy().toLowerCase() + "%"));
        }

        return predicates.stream().reduce(Specification::and).orElse((root, query, cb) -> cb.conjunction());
    }

    // ---- Additional predicates for the paginated list endpoint ----
    // Every predicate in this class touches only root scalar columns. That matters: no joins means no
    // cartesian product, which means Spring Data's generated count query is accurate without DISTINCT
    // and pagination can't return short pages. A predicate that joined notes or auditTrail would break
    // both — add one only with a corresponding fix to the count query.

    /** Free-text search across the fields the case tables let you search on. */
    public static Specification<DisciplinaryCase> search(String search) {
        if (search == null || search.isBlank()) {
            return (root, query, cb) -> cb.conjunction();
        }
        String like = "%" + escapeLike(search.toLowerCase()) + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("studentName")), like, '\\'),
                cb.like(cb.lower(root.get("studentId")), like, '\\'),
                cb.like(cb.lower(root.get("id")), like, '\\'),
                cb.like(cb.lower(root.get("offenseType")), like, '\\'));
    }

    /** Multi-valued status, for the committee queue (Reported OR Under Review). */
    public static Specification<DisciplinaryCase> statusIn(List<CaseStatus> statuses) {
        if (statuses == null || statuses.isEmpty()) {
            return (root, query, cb) -> cb.conjunction();
        }
        return (root, query, cb) -> root.get("status").in(statuses);
    }

    public static Specification<DisciplinaryCase> registrationStatus(RegistrationStatus status) {
        return status == null
                ? (root, query, cb) -> cb.conjunction()
                : (root, query, cb) -> cb.equal(root.get("registrationStatus"), status);
    }

    /**
     * "Cases filed by this person", keyed on the reporter's account id.
     *
     * <p>The name is still accepted as a fallback so cases filed before {@code reportedByUserId}
     * existed remain visible to their author — but the id wins where present. Matching on name alone
     * meant renaming a lecturer orphaned every case they had filed, and an exact match was needed to
     * stop "Marie Uwase" picking up cases filed by "Dr. Marie Uwase".
     */
    public static Specification<DisciplinaryCase> reportedBy(Long userId, String name) {
        boolean hasName = name != null && !name.isBlank();
        if (userId == null) {
            return hasName
                    ? (root, query, cb) -> cb.equal(root.get("reportedBy"), name)
                    : (root, query, cb) -> cb.conjunction();
        }
        return (root, query, cb) -> hasName
                ? cb.or(cb.equal(root.get("reportedByUserId"), userId),
                        cb.and(cb.isNull(root.get("reportedByUserId")), cb.equal(root.get("reportedBy"), name)))
                : cb.equal(root.get("reportedByUserId"), userId);
    }

    /**
     * Restricted-with-no-end-date, i.e. expelled. Needed as its own filter because every date-range
     * predicate excludes NULLs, so an expulsion could not be selected by any combination of them.
     */
    public static Specification<DisciplinaryCase> suspensionEndMissing(Boolean missing) {
        if (missing == null) {
            return (root, query, cb) -> cb.conjunction();
        }
        return missing
                ? (root, query, cb) -> cb.isNull(root.get("suspensionEnd"))
                : (root, query, cb) -> cb.isNotNull(root.get("suspensionEnd"));
    }

    public static Specification<DisciplinaryCase> suspensionEndBetween(LocalDate from, LocalDate to) {
        List<Specification<DisciplinaryCase>> predicates = new ArrayList<>();
        if (from != null) {
            predicates.add((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("suspensionEnd"), from));
        }
        if (to != null) {
            predicates.add((root, query, cb) -> cb.lessThanOrEqualTo(root.get("suspensionEnd"), to));
        }
        return predicates.stream().reduce(Specification::and).orElse((root, query, cb) -> cb.conjunction());
    }

    /**
     * The single authorization choke point for case visibility. Folding the student scoping into the
     * spec chain means it composes with every other filter automatically and cannot be forgotten at a
     * new call site — unlike the controller-level {@code if} it replaces.
     *
     * <p>A STUDENT with no studentId matches nothing: {@code cb.equal(x, null)} renders as {@code = NULL},
     * which is never true. That fail-closed behaviour is intentional.
     */
    public static Specification<DisciplinaryCase> visibleTo(Role callerRole, String callerStudentId) {
        return callerRole != Role.STUDENT
                ? (root, query, cb) -> cb.conjunction()
                : (root, query, cb) -> cb.equal(root.get("studentId"), callerStudentId);
    }

    /** Otherwise a search containing % or _ silently behaves as a wildcard. */
    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    public record CaseReportFilters(
            LocalDate reportDateFrom,
            LocalDate reportDateTo,
            String offenseType,
            CaseStatus status,
            DecisionType decision,
            String reporterDepartment,
            String reportedBy
    ) {
        public String describe() {
            List<String> parts = new ArrayList<>();
            if (reportDateFrom != null || reportDateTo != null) {
                // Spelled out rather than using an ellipsis: the PDF renders in Helvetica, a WinAnsi
                // core font with no glyph for U+2026, so "…" came out blank on an open-ended range.
                parts.add("Date: " + (reportDateFrom == null ? "any" : reportDateFrom)
                        + " to " + (reportDateTo == null ? "any" : reportDateTo));
            }
            if (offenseType != null && !offenseType.isBlank()) parts.add("Offense: " + offenseType);
            if (status != null) parts.add("Status: " + status.wireValue());
            if (decision != null) parts.add("Decision: " + decision.wireValue());
            if (reporterDepartment != null && !reporterDepartment.isBlank()) parts.add("Department: " + reporterDepartment);
            if (reportedBy != null && !reportedBy.isBlank()) parts.add("Reported by: " + reportedBy);
            return parts.isEmpty() ? "None - all cases included" : String.join("   |   ", parts);
        }
    }
}
