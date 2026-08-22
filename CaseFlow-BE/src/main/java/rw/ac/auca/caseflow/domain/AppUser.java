package rw.ac.auca.caseflow.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "app_user")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    private String department;

    private String studentId;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    /**
     * Soft-disable flag checked at login. Deactivation is preferred over deletion for staff who have
     * cases attributed to them, since those attributions are name strings that a hard delete would
     * silently orphan.
     *
     * <p>Not nullable, but columnDefinition supplies a default so rows that predate this column are
     * backfilled as active by the ddl-auto migration rather than failing the NOT NULL constraint.
     */
    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean active = true;

    /** Set when an admin creates the account with a generated temporary password. */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean mustChangePassword = false;

    /**
     * Server-generated filename of the uploaded avatar, not a URL — the same convention as
     * {@code DisciplinaryCase.evidenceFiles}. UserResponse turns it into a path at serialization time.
     */
    private String profilePicture;

    protected AppUser() {
    }

    public AppUser(String name, Role role, String department, String studentId, String email, String passwordHash) {
        this.name = name;
        this.role = role;
        this.department = department;
        this.studentId = studentId;
        this.email = email;
        this.passwordHash = passwordHash;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public boolean isMustChangePassword() {
        return mustChangePassword;
    }

    public void setMustChangePassword(boolean mustChangePassword) {
        this.mustChangePassword = mustChangePassword;
    }

    public String getProfilePicture() {
        return profilePicture;
    }

    public void setProfilePicture(String profilePicture) {
        this.profilePicture = profilePicture;
    }
}
