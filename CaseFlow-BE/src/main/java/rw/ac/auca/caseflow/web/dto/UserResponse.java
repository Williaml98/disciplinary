package rw.ac.auca.caseflow.web.dto;

import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.Role;

public record UserResponse(
        Long id,
        String name,
        Role role,
        String department,
        String studentId,
        String email
) {
    public static UserResponse from(AppUser user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getRole(),
                user.getDepartment(),
                user.getStudentId(),
                user.getEmail()
        );
    }
}
