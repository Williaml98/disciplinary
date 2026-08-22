package rw.ac.auca.caseflow.repository;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import rw.ac.auca.caseflow.domain.CaseCounter;

public interface CaseCounterRepository extends JpaRepository<CaseCounter, Integer> {

    /**
     * Takes a row-level write lock (SELECT ... FOR UPDATE) so concurrent case reports serialise on the
     * counter instead of reading the same value and producing duplicate case ids.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CaseCounter c where c.year = :year")
    Optional<CaseCounter> findByYearForUpdate(@Param("year") int year);
}
