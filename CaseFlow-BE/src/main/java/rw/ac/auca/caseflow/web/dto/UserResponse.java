package rw.ac.auca.caseflow.web.dto;

import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.Role;

public record UserResponse(
        Long id,
        String name,
        Role role,
        String department,
        String studentId,
        String email,
        boolean active,
        boolean mustChangePassword,
        /**
         * Relative path, not a bare filename — the frontend prefixes it with API_BASE_URL, matching how
         * CaseResponse exposes evidence files. Null when the user has no avatar.
         */
        String profilePictureUrl
) {
    public static UserResponse from(AppUser user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getRole(),
                user.getDepartment(),
                user.getStudentId(),
                user.getEmail(),
                user.isActive(),
                user.isMustChangePassword(),
                user.getProfilePicture() == null
                        ? null
                        : "/users/" + user.getId() + "/picture/" + user.getProfilePicture()
        );
    }
}
