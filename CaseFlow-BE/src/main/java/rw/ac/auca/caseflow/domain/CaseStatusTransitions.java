package rw.ac.auca.caseflow.domain;

import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The legal manual status transitions for {@code POST /api/cases/{id}/status}.
 *
 * <p>That endpoint used to apply whatever status it was given, so a case could jump straight from
 * Reported to Resolved, or a decided case could be pushed back to Reported — losing the meaning of the
 * lifecycle entirely.
 *
 * <p>Only moves a human should be able to make by hand are listed here. Transitions the system performs
 * as a side effect of a real action — recording a decision, submitting an appeal, resolving an appeal,
 * approving re-integration — are driven by their own endpoints and are intentionally not reachable
 * from here: reaching Decided means recording a decision, not relabelling the case.
 */
public final class CaseStatusTransitions {

    private static final Map<CaseStatus, Set<CaseStatus>> ALLOWED = new EnumMap<>(CaseStatus.class);

    static {
        // Start the review, or close a case filed in error without a formal decision.
        ALLOWED.put(CaseStatus.REPORTED, Set.of(CaseStatus.UNDER_REVIEW, CaseStatus.RESOLVED));
        // Send it back to the queue if it was picked up in error, or close it out.
        ALLOWED.put(CaseStatus.UNDER_REVIEW, Set.of(CaseStatus.REPORTED, CaseStatus.RESOLVED));
        // A decided case is closed by re-integration or by resolving an appeal; a committee member may
        // also close it directly once any sanction has been served.
        ALLOWED.put(CaseStatus.DECIDED, Set.of(CaseStatus.RESOLVED));
        // An appeal in flight is finished through the appeal-resolution endpoint, not by relabelling.
        ALLOWED.put(CaseStatus.UNDER_APPEAL, Set.of());
        // Reopening a closed case is a real need (new evidence), but it goes back to review, not to a
        // decision state.
        ALLOWED.put(CaseStatus.RESOLVED, Set.of(CaseStatus.UNDER_REVIEW));
    }

    private CaseStatusTransitions() {
    }

    public static boolean isAllowed(CaseStatus from, CaseStatus to) {
        return from != to && ALLOWED.getOrDefault(from, Set.of()).contains(to);
    }

    /** Sorted so the API and any UI built from it present options in lifecycle order. */
    public static List<CaseStatus> allowedFrom(CaseStatus from) {
        return ALLOWED.getOrDefault(from, Set.of()).stream()
                .sorted()
                .toList();
    }

    public static Map<CaseStatus, Set<CaseStatus>> all() {
        return Collections.unmodifiableMap(ALLOWED);
    }
}
