package rw.ac.auca.caseflow.web.dto;

/** Role breakdown for the admin user-management filter chips and the "registered users" tile. */
public record UserStatsResponse(
        long total,
        long admin,
        long committee,
        long lecturer,
        long student
) {
}
