package rw.ac.auca.caseflow.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One row per calendar year, holding the last case number issued for that year.
 *
 * <p>Read under a pessimistic write lock by {@code CaseNumberService}, which is what makes case-id
 * allocation safe under concurrent reports. See that class for why the previous count-based scheme was
 * unsound.
 */
@Entity
@Table(name = "case_counter")
public class CaseCounter {

    // Mapped away from "year", which is a reserved word in H2 (and a non-reserved keyword in Postgres)
    // — an unquoted `select ... year from case_counter` is a syntax error on the test profile.
    @Id
    @Column(name = "counter_year")
    private int year;

    @Column(nullable = false)
    private long lastSequence;

    protected CaseCounter() {
    }

    public CaseCounter(int year, long lastSequence) {
        this.year = year;
        this.lastSequence = lastSequence;
    }

    public int getYear() {
        return year;
    }

    public long getLastSequence() {
        return lastSequence;
    }

    public void setLastSequence(long lastSequence) {
        this.lastSequence = lastSequence;
    }
}
