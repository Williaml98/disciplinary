package rw.ac.auca.caseflow.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import rw.ac.auca.caseflow.domain.DisciplinaryCase;

public interface CaseRepository extends JpaRepository<DisciplinaryCase, String>,
        JpaSpecificationExecutor<DisciplinaryCase> {

    List<DisciplinaryCase> findByReportedBy(String reportedBy);

    List<DisciplinaryCase> findByStudentId(String studentId);
}
