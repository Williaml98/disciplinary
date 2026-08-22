package rw.ac.auca.caseflow.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.Role;

public interface UserRepository extends JpaRepository<AppUser, Long>,
        JpaSpecificationExecutor<AppUser> {

    Optional<AppUser> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    Optional<AppUser> findByStudentId(String studentId);

    /** Backs the role-filter chip counts and the "registered users" tile once the list is paginated. */
    @Query("select u.role as role, count(u) as count from AppUser u group by u.role")
    List<RoleCount> countGroupedByRole();

    interface RoleCount {
        Role getRole();

        long getCount();
    }
}
