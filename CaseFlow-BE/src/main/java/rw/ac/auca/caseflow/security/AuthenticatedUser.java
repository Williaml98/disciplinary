package rw.ac.auca.caseflow.security;

import rw.ac.auca.caseflow.domain.Role;

public record AuthenticatedUser(Long id, String email, Role role, String studentId) {
}
