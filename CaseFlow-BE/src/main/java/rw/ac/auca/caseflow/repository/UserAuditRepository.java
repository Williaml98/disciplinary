package rw.ac.auca.caseflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import rw.ac.auca.caseflow.domain.UserAuditEntry;

public interface UserAuditRepository extends JpaRepository<UserAuditEntry, Long> {
}
