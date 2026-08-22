package rw.ac.auca.caseflow.service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import rw.ac.auca.caseflow.domain.CaseStatus;
import rw.ac.auca.caseflow.domain.RegistrationStatus;
import rw.ac.auca.caseflow.repository.CaseRepository;
import rw.ac.auca.caseflow.web.dto.CaseStatsResponse;
import rw.ac.auca.caseflow.web.dto.MonthlyCaseCountResponse;

/**
 * Global case aggregates, computed in the database.
 *
 * <p>Exists because the dashboards used to derive every badge and stat tile from a full in-memory list
 * of cases. Once the list endpoints are paginated that arithmetic would silently describe only the
 * current page — an under-counted registration-hold badge could let a suspended student register, with
 * no error anywhere to reveal it.
 */
@Service
public class CaseStatsService {

    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MMM yy", Locale.ENGLISH);
    private static final int MONTHS_OF_HISTORY = 8;

    private final CaseRepository caseRepository;

    public CaseStatsService(CaseRepository caseRepository) {
        this.caseRepository = caseRepository;
    }

    public CaseStatsResponse stats() {
        Map<CaseStatus, Long> byStatus = new EnumMap<>(CaseStatus.class);
        caseRepository.countGroupedByStatus()
                .forEach(row -> byStatus.put(row.getStatus(), row.getCount()));

        long total = byStatus.values().stream().mapToLong(Long::longValue).sum();
        long resolved = byStatus.getOrDefault(CaseStatus.RESOLVED, 0L);

        LocalDate today = LocalDate.now();
        long flagged = caseRepository.countByRegistrationStatus(RegistrationStatus.FLAGGED);
        long activeSuspensions = caseRepository
                .countByRegistrationStatusAndSuspensionEndGreaterThanEqual(RegistrationStatus.RESTRICTED, today);
        long expiredSuspensions = caseRepository
                .countByRegistrationStatusAndSuspensionEndLessThan(RegistrationStatus.RESTRICTED, today);

        return new CaseStatsResponse(
                total,
                byStatus.getOrDefault(CaseStatus.REPORTED, 0L),
                byStatus.getOrDefault(CaseStatus.UNDER_REVIEW, 0L),
                byStatus.getOrDefault(CaseStatus.DECIDED, 0L),
                byStatus.getOrDefault(CaseStatus.UNDER_APPEAL, 0L),
                resolved,
                total - resolved,
                flagged,
                caseRepository.countByRegistrationStatus(RegistrationStatus.RESTRICTED),
                activeSuspensions,
                expiredSuspensions,
                // Reproduces the frontend's previous alert-badge arithmetic exactly. Note what it
                // leaves out: a RESTRICTED case with no suspensionEnd — i.e. an expulsion — lands in
                // neither bucket. That's a pre-existing gap in the registrar alerts, preserved here so
                // this change doesn't quietly move a number; worth fixing separately.
                activeSuspensions + expiredSuspensions + flagged);
    }

    /** Last {@value #MONTHS_OF_HISTORY} months, including months with no cases so the chart has no gaps. */
    public List<MonthlyCaseCountResponse> monthly() {
        YearMonth start = YearMonth.from(LocalDate.now()).minusMonths(MONTHS_OF_HISTORY - 1L);
        Map<YearMonth, Long> counts = caseRepository.countGroupedByMonth(start.atDay(1)).stream()
                .collect(java.util.stream.Collectors.toMap(
                        row -> YearMonth.of(row.getYear(), row.getMonth()),
                        CaseRepository.MonthlyCount::getCount));

        return java.util.stream.IntStream.range(0, MONTHS_OF_HISTORY)
                .mapToObj(start::plusMonths)
                .map(month -> new MonthlyCaseCountResponse(
                        month.getYear(),
                        month.getMonthValue(),
                        month.format(MONTH_LABEL),
                        counts.getOrDefault(month, 0L)))
                .toList();
    }
}
