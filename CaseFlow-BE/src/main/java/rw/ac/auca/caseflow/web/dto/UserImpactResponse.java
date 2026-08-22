package rw.ac.auca.caseflow.web.dto;

/**
 * What would be left dangling if this account were deleted.
 *
 * <p>Cases reference people by display-name string rather than by foreign key, so a delete never fails
 * — it just silently orphans those references. The admin UI shows these counts before confirming, and
 * steers toward deactivation when they are non-zero.
 */
public record UserImpactResponse(
        long casesReported,
        long casesAsStudent,
        long notesAuthored,
        boolean isSelf
) {
    public boolean hasImpact() {
        return casesReported > 0 || casesAsStudent > 0 || notesAuthored > 0;
    }
}
