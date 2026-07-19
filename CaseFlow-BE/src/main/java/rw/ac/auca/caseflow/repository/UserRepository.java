package rw.ac.auca.caseflow.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import rw.ac.auca.caseflow.domain.AppUser;

public interface UserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);
}
