package rw.ac.auca.caseflow.service;

import java.time.Year;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.caseflow.domain.CaseCounter;
import rw.ac.auca.caseflow.repository.CaseCounterRepository;
import rw.ac.auca.caseflow.repository.CaseRepository;

/**
 * Issues human-readable case ids of the form {@code CF-2026-001}.
 *
 * <p>Replaces the previous {@code caseRepository.count() + 1}, which was unsound in three ways: two
 * concurrent reports read the same count and produced the same id (and since the id is the primary key,
 * the second {@code save()} silently overwrote the first case rather than failing); deleting any case
 * made the next id collide with an existing one; and the counter never restarted between years.
 *
 * <p>Allocation instead increments a per-year counter row held under a pessimistic write lock, so
 * concurrent callers serialise on it. The lock is held only for the few milliseconds of this method,
 * and case creation is rare, so contention is not a practical concern.
 */
@Service
public class CaseNumberService {

    private final CaseCounterRepository counterRepository;
    private final CaseRepository caseRepository;

    public CaseNumberService(CaseCounterRepository counterRepository, CaseRepository caseRepository) {
        this.counterRepository = counterRepository;
        this.caseRepository = caseRepository;
    }

    /**
     * Joins the caller's transaction, so the counter increment and the case insert commit or roll back
     * together. An earlier REQUIRES_NEW version committed the counter independently — which meant a
     * failed request burned a number, and, more importantly, that the allocation could not see rows the
     * caller had written but not yet committed.
     *
     * <p>The pessimistic lock is therefore held for the rest of the caller's transaction. That is
     * acceptable here: filing a case is a rare, short operation.
     */
    @Transactional
    public String next() {
        int year = Year.now().getValue();
        CaseCounter counter = counterRepository.findByYearForUpdate(year)
                .orElseGet(() -> createCounterForYear(year));

        long sequence = counter.getLastSequence() + 1;
        counter.setLastSequence(sequence);
        counterRepository.save(counter);

        // %03d is a minimum width, not a cap — the 1000th case in a year becomes CF-2026-1000 rather
        // than being truncated into a collision.
        return "CF-%d-%03d".formatted(year, sequence);
    }

    /**
     * The first report of a new year has no counter row yet. Two requests can reach this point at once
     * and both attempt the insert; the loser gets a primary-key violation and simply re-reads the row
     * the winner committed.
     */
    private CaseCounter createCounterForYear(int year) {
        try {
            return counterRepository.saveAndFlush(new CaseCounter(year, highestExistingSequence(year)));
        } catch (DataIntegrityViolationException alreadyCreatedByAnotherRequest) {
            return counterRepository.findByYearForUpdate(year)
                    .orElseThrow(() -> alreadyCreatedByAnotherRequest);
        }
    }

    /**
     * Seeds a new counter from the case ids already in the database.
     *
     * <p>Without this, introducing the counter to an existing database would start it at zero and hand
     * out an id that a case already holds. Because the id is the primary key, {@code save()} treats
     * that as a merge — so the collision would silently overwrite a real case rather than failing.
     * Runs at most once per calendar year.
     */
    private long highestExistingSequence(int year) {
        String prefix = "CF-%d-".formatted(year);
        return caseRepository.findIdsStartingWith(prefix).stream()
                .map(id -> id.substring(prefix.length()))
                .mapToLong(CaseNumberService::parseSequenceOrZero)
                .max()
                .orElse(0);
    }

    /** Ignores anything that isn't a plain number, so a hand-edited id can't break allocation. */
    private static long parseSequenceOrZero(String suffix) {
        try {
            return Long.parseLong(suffix);
        } catch (NumberFormatException notANumber) {
            return 0;
        }
    }
}
