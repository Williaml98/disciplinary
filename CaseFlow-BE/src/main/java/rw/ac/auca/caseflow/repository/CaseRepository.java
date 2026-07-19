package rw.ac.auca.caseflow.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;

public interface CaseRepository extends JpaRepository<DisciplinaryCase, String> {

    List<DisciplinaryCase> findByReportedBy(String reportedBy);

    List<DisciplinaryCase> findByStudentId(String studentId);
}
