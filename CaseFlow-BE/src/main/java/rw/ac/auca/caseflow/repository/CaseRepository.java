package rw.ac.auca.caseflow.repository;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import rw.ac.auca.caseflow.domain.CaseStatus;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;
import rw.ac.auca.caseflow.domain.RegistrationStatus;

public interface CaseRepository extends JpaRepository<DisciplinaryCase, String>,
        JpaSpecificationExecutor<DisciplinaryCase> {

    List<DisciplinaryCase> findByReportedBy(String reportedBy);

    List<DisciplinaryCase> findByStudentId(String studentId);

    // ---- Aggregates behind GET /api/cases/stats ----
    // These exist so dashboard badges and stat tiles stay globally correct once the list endpoints are
    // paginated. All of them count in the database; none materialises an entity, so the eagerly-fetched
    // notes/auditTrail/evidenceFiles collections are never touched.

    @Query("select c.status as status, count(c) as count from DisciplinaryCase c group by c.status")
    List<StatusCount> countGroupedByStatus();

    interface StatusCount {
        CaseStatus getStatus();

        long getCount();
    }

    long countByRegistrationStatus(RegistrationStatus registrationStatus);

    // suspensionEnd IS NULL rows drop out of both of these: SQL comparisons against NULL are UNKNOWN,
    // never TRUE, which matches the frontend's `c.suspensionEnd && c.suspensionEnd >= today` guard.
    long countByRegistrationStatusAndSuspensionEndGreaterThanEqual(RegistrationStatus status, LocalDate today);

    long countByRegistrationStatusAndSuspensionEndLessThan(RegistrationStatus status, LocalDate today);

    /** Monthly totals for the admin overview chart, which until now rendered hardcoded sample data. */
    @Query("""
            select year(c.reportDate) as year, month(c.reportDate) as month, count(c) as count
            from DisciplinaryCase c
            where c.reportDate >= :from
            group by year(c.reportDate), month(c.reportDate)
            order by year(c.reportDate), month(c.reportDate)
            """)
    List<MonthlyCount> countGroupedByMonth(LocalDate from);

    interface MonthlyCount {
        int getYear();

        int getMonth();

        long getCount();
    }

    /**
     * Ids only — no entities, so the eager collections are never touched. Used to seed the per-year
     * case counter from cases that already exist (see CaseNumberService).
     */
    @Query("select c.id from DisciplinaryCase c where c.id like concat(:prefix, '%')")
    List<String> findIdsStartingWith(String prefix);

    // ---- Delete-impact counts, so an admin sees what a hard delete would orphan ----

    long countByReportedBy(String reportedBy);

    long countByStudentId(String studentId);

    @Query("select count(n) from Note n where n.author = :author")
    long countNotesByAuthor(String author);
}
