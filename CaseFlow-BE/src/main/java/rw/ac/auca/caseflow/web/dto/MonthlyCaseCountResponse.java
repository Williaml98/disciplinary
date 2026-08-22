package rw.ac.auca.caseflow.web.dto;

/** One bar in the admin overview's "cases reported by month" chart. */
public record MonthlyCaseCountResponse(
        int year,
        int month,
        String label,
        long count
) {
}
