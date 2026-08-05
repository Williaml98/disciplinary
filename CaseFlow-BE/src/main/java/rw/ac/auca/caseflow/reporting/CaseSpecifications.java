package rw.ac.auca.caseflow.reporting;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;
import rw.ac.auca.caseflow.domain.CaseStatus;
import rw.ac.auca.caseflow.domain.DecisionType;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;

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
                parts.add("Date: " + (reportDateFrom == null ? "…" : reportDateFrom)
                        + " to " + (reportDateTo == null ? "…" : reportDateTo));
            }
            if (offenseType != null && !offenseType.isBlank()) parts.add("Offense: " + offenseType);
            if (status != null) parts.add("Status: " + status.wireValue());
            if (decision != null) parts.add("Decision: " + decision.wireValue());
            if (reporterDepartment != null && !reporterDepartment.isBlank()) parts.add("Department: " + reporterDepartment);
            if (reportedBy != null && !reportedBy.isBlank()) parts.add("Reported by: " + reportedBy);
            return parts.isEmpty() ? "Filters: none (all cases)" : "Filters: " + String.join(" · ", parts);
        }
    }
}
