package rw.ac.auca.caseflow.repository;

import org.springframework.data.jpa.domain.Specification;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.Role;

/** Server-side filters for the admin user table, replacing what used to be client-side array filtering. */
public final class UserSpecifications {

    private UserSpecifications() {
    }

    public static Specification<AppUser> matching(String search, Role role, Boolean active) {
        return Specification.allOf(search(search), role(role), active(active));
    }

    /** Matches the frontend's previous behaviour: name or email, case-insensitive substring. */
    public static Specification<AppUser> search(String search) {
        if (search == null || search.isBlank()) {
            return (root, query, cb) -> cb.conjunction();
        }
        String like = "%" + escapeLike(search.toLowerCase()) + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("name")), like, '\\'),
                cb.like(cb.lower(root.get("email")), like, '\\'));
    }

    public static Specification<AppUser> role(Role role) {
        return role == null
                ? (root, query, cb) -> cb.conjunction()
                : (root, query, cb) -> cb.equal(root.get("role"), role);
    }

    public static Specification<AppUser> active(Boolean active) {
        return active == null
                ? (root, query, cb) -> cb.conjunction()
                : (root, query, cb) -> cb.equal(root.get("active"), active);
    }

    /**
     * Without this, a search containing % or _ is treated as a wildcard, so typing "%" quietly matches
     * every user.
     */
    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
