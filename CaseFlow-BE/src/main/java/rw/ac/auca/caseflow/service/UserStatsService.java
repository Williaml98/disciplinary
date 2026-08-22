package rw.ac.auca.caseflow.service;

import java.util.EnumMap;
import java.util.Map;
import org.springframework.stereotype.Service;
import rw.ac.auca.caseflow.domain.Role;
import rw.ac.auca.caseflow.repository.UserRepository;
import rw.ac.auca.caseflow.web.dto.UserStatsResponse;

/**
 * Role breakdown for the admin user table's filter chips and the overview's user tile.
 *
 * <p>Like {@link CaseStatsService}, this exists so those counts stay global once the user list is
 * paginated rather than silently describing only the visible page.
 */
@Service
public class UserStatsService {

    private final UserRepository userRepository;

    public UserStatsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserStatsResponse stats() {
        Map<Role, Long> byRole = new EnumMap<>(Role.class);
        userRepository.countGroupedByRole().forEach(row -> byRole.put(row.getRole(), row.getCount()));

        return new UserStatsResponse(
                byRole.values().stream().mapToLong(Long::longValue).sum(),
                byRole.getOrDefault(Role.ADMIN, 0L),
                byRole.getOrDefault(Role.COMMITTEE, 0L),
                byRole.getOrDefault(Role.LECTURER, 0L),
                byRole.getOrDefault(Role.STUDENT, 0L));
    }
}
