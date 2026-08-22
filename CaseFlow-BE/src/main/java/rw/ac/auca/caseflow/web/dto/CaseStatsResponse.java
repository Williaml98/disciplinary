package rw.ac.auca.caseflow.web.dto;

/**
 * Global case counts for dashboard badges and stat tiles.
 *
 * <p>These are deliberately unfiltered. A badge answers "how many are there?", while a list's
 * {@code totalElements} answers "how many match what I'm looking at" — merging the two would make every
 * badge change as soon as someone typed in a search box.
 *
 * <p>Explicit fields rather than a {@code Map<CaseStatus, Long>}: Jackson applies {@code @JsonValue}
 * differently to enum map *keys* than to enum values, so a map would risk silently emitting
 * {@code "UNDER_REVIEW"} where the frontend expects {@code "Under Review"} — with no compile error on
 * either side.
 */
public record CaseStatsResponse(
        long total,
        long reported,
        long underReview,
        long decided,
        long underAppeal,
        long resolved,
        long open,
        long flagged,
        long restricted,
        long activeSuspensions,
        long expiredSuspensions,
        long registrationHolds
) {
}
