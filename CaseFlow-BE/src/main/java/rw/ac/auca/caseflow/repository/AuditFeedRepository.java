package rw.ac.auca.caseflow.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import rw.ac.auca.caseflow.domain.AuditEntry;

/**
 * The admin audit view, merging case actions and user-management actions into one chronological feed.
 *
 * <p>The merge has to happen in SQL. Two separately-paginated feeds cannot be correctly interleaved on
 * the client — page 1 of each is not the global top N unless you fetch both in full, which is exactly
 * the unbounded read pagination exists to remove.
 *
 * <p>This is the only native query in the codebase, so it is the one place the H2-test/Postgres-prod
 * split could diverge; {@code AuditFeedTest} seeds both entry kinds and asserts the interleaving.
 */
public interface AuditFeedRepository extends Repository<AuditEntry, Long> {

    /**
     * Ordering is fixed in the SQL rather than taken from the Pageable: Spring appends a Pageable's
     * sort to a native query by string concatenation using entity property names, which would not match
     * these union aliases. Pass a sortless PageRequest.
     *
     * <p>{@code entry_id} is a required tiebreaker, not decoration — reportCase writes three audit rows
     * with an identical Instant, and without it those three shuffle between pages.
     *
     * <p>{@code a.by} is left unquoted deliberately: BY is non-reserved in both Postgres and H2, and
     * quoting it would break on H2, which folds unquoted identifiers to uppercase.
     */
    @Query(value = """
            select * from (
              select 'CASE' as kind, a.id as entry_id, a.action as action, a.by as actor,
                     a.timestamp as ts, a.case_id as case_id,
                     cast(null as bigint) as target_user_id, cast(null as varchar) as target_user_name
              from audit_entry a
              union all
              select 'USER' as kind, u.id, u.action, u.actor,
                     u.timestamp, cast(null as varchar),
                     u.target_user_id, u.target_user_name
              from user_audit_entry u
            ) feed
            where (:kind is null or feed.kind = :kind)
            order by feed.ts desc, feed.kind desc, feed.entry_id desc
            """,
            countQuery = """
            select (select count(*) from audit_entry where (:kind is null or 'CASE' = :kind))
                 + (select count(*) from user_audit_entry where (:kind is null or 'USER' = :kind))
            """,
            nativeQuery = true)
    Page<AuditFeedRow> findFeed(@Param("kind") String kind, Pageable pageable);

    interface AuditFeedRow {
        String getKind();

        Long getEntryId();

        String getAction();

        String getActor();

        /**
         * Deliberately untyped. A native query returns whatever JDBC type the driver chose for the
         * column, and that differs by database — H2 hands back an OffsetDateTime here, and declaring
         * {@code Instant} makes Spring throw "Cannot project java.time.OffsetDateTime to
         * java.time.Instant". {@link rw.ac.auca.caseflow.web.dto.AuditFeedEntry} normalises it.
         */
        Object getTs();

        String getCaseId();

        Long getTargetUserId();

        String getTargetUserName();
    }
}
