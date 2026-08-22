package rw.ac.auca.caseflow.web;

import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.Role;
import rw.ac.auca.caseflow.email.EmailService;
import rw.ac.auca.caseflow.repository.CaseRepository;
import rw.ac.auca.caseflow.repository.UserRepository;
import rw.ac.auca.caseflow.repository.UserSpecifications;
import rw.ac.auca.caseflow.security.AuthenticatedUser;
import rw.ac.auca.caseflow.service.TemporaryPasswordGenerator;
import rw.ac.auca.caseflow.service.UserAuditService;
import rw.ac.auca.caseflow.service.UserStatsService;
import rw.ac.auca.caseflow.storage.ProfilePictureStorage;
import rw.ac.auca.caseflow.web.dto.CreateUserRequest;
import rw.ac.auca.caseflow.web.dto.PageResponse;
import rw.ac.auca.caseflow.web.dto.PasswordChangeRequest;
import rw.ac.auca.caseflow.web.dto.ProfileUpdateRequest;
import rw.ac.auca.caseflow.web.dto.RoleUpdateRequest;
import rw.ac.auca.caseflow.web.dto.UserImpactResponse;
import rw.ac.auca.caseflow.web.dto.UserResponse;
import rw.ac.auca.caseflow.web.dto.UserStatsResponse;
import rw.ac.auca.caseflow.web.dto.UserStatusRequest;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final CaseRepository caseRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final TemporaryPasswordGenerator temporaryPasswordGenerator;
    private final UserAuditService userAuditService;
    private final UserStatsService userStatsService;
    private final ProfilePictureStorage profilePictureStorage;

    public UserController(UserRepository userRepository, CaseRepository caseRepository,
                           PasswordEncoder passwordEncoder, EmailService emailService,
                           TemporaryPasswordGenerator temporaryPasswordGenerator,
                           UserAuditService userAuditService, UserStatsService userStatsService,
                           ProfilePictureStorage profilePictureStorage) {
        this.userRepository = userRepository;
        this.caseRepository = caseRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.temporaryPasswordGenerator = temporaryPasswordGenerator;
        this.userAuditService = userAuditService;
        this.userStatsService = userStatsService;
        this.profilePictureStorage = profilePictureStorage;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public PageResponse<UserResponse> listUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Role role,
            @RequestParam(required = false) Boolean active,
            @PageableDefault(size = 20) Pageable pageable) {
        Pageable safe = PageableSupport.sanitize(
                pageable, PageableSupport.USER_SORTS, Sort.by(Sort.Direction.ASC, "name"));
        return PageResponse.of(
                userRepository.findAll(UserSpecifications.matching(search, role, active), safe),
                UserResponse::from);
    }

    /** Role counts for the filter chips, which must stay global rather than page-scoped. */
    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public UserStatsResponse stats() {
        return userStatsService.stats();
    }

    /**
     * Creates an account.
     *
     * <p>Two distinct paths share this endpoint. An authenticated admin never sets the password: one is
     * generated, emailed, and flagged for replacement at first sign-in. The unauthenticated bootstrap
     * path — open only while the database has zero users, since there is no other way to create the
     * first account — uses the supplied password instead, because a fresh environment may have no
     * working SMTP and the operator would otherwise be locked out of the system they just installed.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse createUser(@Valid @RequestBody CreateUserRequest request,
                                    @AuthenticationPrincipal AuthenticatedUser caller) {
        boolean databaseIsEmpty = userRepository.count() == 0;
        if (!databaseIsEmpty) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            boolean isAdmin = authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser admin
                    && admin.role() == Role.ADMIN;
            if (!isAdmin) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only an admin can create new users");
            }
        }
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        boolean bootstrapping = databaseIsEmpty;
        String password = bootstrapping ? request.password() : temporaryPasswordGenerator.generate();
        if (bootstrapping && (password == null || password.isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A password is required when creating the first account");
        }

        AppUser user = new AppUser(
                request.name(),
                request.role(),
                request.department(),
                request.studentId(),
                request.email(),
                passwordEncoder.encode(password)
        );
        user.setMustChangePassword(!bootstrapping);
        AppUser saved = userRepository.save(user);

        if (!bootstrapping) {
            emailService.sendWelcome(saved.getEmail(), saved.getName(), roleLabel(saved.getRole()), password);
            userAuditService.record(caller, "Account created (" + roleLabel(saved.getRole()) + ")", saved);
        }
        return UserResponse.from(saved);
    }

    @PatchMapping("/{id}")
    public UserResponse updateProfile(@PathVariable Long id, @Valid @RequestBody ProfileUpdateRequest request,
                                       @AuthenticationPrincipal AuthenticatedUser caller) {
        requireSelfOrAdmin(id, caller);
        AppUser user = findOrThrow(id);

        // Checked explicitly so a duplicate address is a 409 with a readable message, rather than the
        // database unique constraint surfacing as a 500.
        if (!user.getEmail().equalsIgnoreCase(request.email())
                && userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That email is already in use");
        }
        // A student's studentId is the only key linking them to their cases (requireCaseAccess reads it
        // from the token), so letting them rewrite it would hand them access to someone else's record.
        if (caller.role() != Role.ADMIN && user.getRole() == Role.STUDENT
                && !java.util.Objects.equals(user.getStudentId(), request.studentId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Student ID can only be changed by an administrator");
        }

        String before = describe(user);
        user.setName(request.name());
        user.setEmail(request.email());
        user.setDepartment(request.department());
        user.setStudentId(request.studentId());
        AppUser saved = userRepository.save(user);

        if (caller.role() == Role.ADMIN && !caller.id().equals(id)) {
            userAuditService.record(caller, "Profile updated (was: " + before + ")", saved);
        }
        return UserResponse.from(saved);
    }

    @PatchMapping("/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponse updateRole(@PathVariable Long id, @Valid @RequestBody RoleUpdateRequest request,
                                    @AuthenticationPrincipal AuthenticatedUser caller) {
        AppUser user = findOrThrow(id);
        Role previous = user.getRole();
        // Without this an admin can demote themselves and immediately lose the ability to undo it.
        if (caller.id().equals(id) && request.role() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You cannot change your own role");
        }
        user.setRole(request.role());
        AppUser saved = userRepository.save(user);
        userAuditService.record(caller,
                "Role changed from %s to %s".formatted(roleLabel(previous), roleLabel(request.role())), saved);
        return UserResponse.from(saved);
    }

    /** Deactivate/reactivate — the reversible alternative to deleting an account. */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponse updateStatus(@PathVariable Long id, @Valid @RequestBody UserStatusRequest request,
                                      @AuthenticationPrincipal AuthenticatedUser caller) {
        if (caller.id().equals(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You cannot deactivate your own account");
        }
        AppUser user = findOrThrow(id);
        boolean active = Boolean.TRUE.equals(request.active());
        if (user.isActive() == active) {
            return UserResponse.from(user);
        }

        user.setActive(active);
        AppUser saved = userRepository.save(user);
        userAuditService.record(caller, active ? "Account reactivated" : "Account deactivated", saved);

        if (active) {
            emailService.sendAccountReactivated(saved.getEmail(), saved.getName());
        } else {
            emailService.sendAccountDeactivated(saved.getEmail(), saved.getName());
        }
        return UserResponse.from(saved);
    }

    @PostMapping("/{id}/password")
    public UserResponse changePassword(@PathVariable Long id, @Valid @RequestBody PasswordChangeRequest request,
                                        @AuthenticationPrincipal AuthenticatedUser caller) {
        requireSelfOrAdmin(id, caller);
        AppUser user = findOrThrow(id);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        // Clears the forced-change flag set when an admin created the account with a temporary password.
        user.setMustChangePassword(false);
        return UserResponse.from(userRepository.save(user));
    }

    /**
     * What a hard delete would orphan. Cases reference people by display-name string rather than by
     * foreign key, so deleting never fails — it just silently leaves dangling references. The admin UI
     * shows these counts before confirming.
     */
    @GetMapping("/{id}/impact")
    @PreAuthorize("hasRole('ADMIN')")
    public UserImpactResponse deleteImpact(@PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser caller) {
        AppUser user = findOrThrow(id);
        return new UserImpactResponse(
                caseRepository.countByReportedBy(user.getName()),
                user.getStudentId() == null ? 0 : caseRepository.countByStudentId(user.getStudentId()),
                caseRepository.countNotesByAuthor(user.getName()),
                caller.id().equals(id));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteUser(@PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser caller) {
        if (caller.id().equals(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You cannot delete your own account");
        }
        AppUser user = findOrThrow(id);
        // Captured before the row disappears — this audit entry is the only remaining record of them.
        Long targetId = user.getId();
        String targetName = user.getName();
        String targetEmail = user.getEmail();

        if (user.getProfilePicture() != null) {
            profilePictureStorage.delete(targetId, user.getProfilePicture());
        }
        userRepository.deleteById(id);
        userAuditService.record(caller, "Account deleted (" + targetEmail + ")", targetId, targetName);
    }

    // ---- Profile pictures ----

    @PostMapping("/{id}/picture")
    public UserResponse uploadProfilePicture(@PathVariable Long id,
                                              @RequestParam("file") MultipartFile file,
                                              @AuthenticationPrincipal AuthenticatedUser caller) {
        requireSelfOrAdmin(id, caller);
        AppUser user = findOrThrow(id);
        String previous = user.getProfilePicture();

        user.setProfilePicture(profilePictureStorage.store(id, file));
        AppUser saved = userRepository.save(user);
        // Only after the new one is safely persisted, so a failed save doesn't lose both.
        profilePictureStorage.delete(id, previous);
        return UserResponse.from(saved);
    }

    @DeleteMapping("/{id}/picture")
    public UserResponse removeProfilePicture(@PathVariable Long id,
                                              @AuthenticationPrincipal AuthenticatedUser caller) {
        requireSelfOrAdmin(id, caller);
        AppUser user = findOrThrow(id);
        String previous = user.getProfilePicture();
        user.setProfilePicture(null);
        AppUser saved = userRepository.save(user);
        profilePictureStorage.delete(id, previous);
        return UserResponse.from(saved);
    }

    /**
     * Unauthenticated for the same reason as evidence downloads: a plain {@code <img>} tag cannot attach
     * an Authorization header, and the filenames are unguessable server-generated UUIDs.
     */
    @GetMapping("/{id}/picture/{filename}")
    public ResponseEntity<Resource> getProfilePicture(@PathVariable Long id, @PathVariable String filename) {
        Resource resource = profilePictureStorage.load(id, filename);
        MediaType contentType = MediaTypeFactory.getMediaType(resource).orElse(MediaType.APPLICATION_OCTET_STREAM);
        return ResponseEntity.ok().contentType(contentType).body(resource);
    }

    // ---- Helpers ----

    private static String describe(AppUser user) {
        return "%s, %s".formatted(user.getName(), user.getEmail());
    }

    private static String roleLabel(Role role) {
        return switch (role) {
            case LECTURER -> "Lecturer / Invigilator";
            case COMMITTEE -> "Committee Member";
            case STUDENT -> "Student";
            case ADMIN -> "Registrar / Admin";
        };
    }

    private static void requireSelfOrAdmin(Long id, AuthenticatedUser caller) {
        if (caller == null || (!caller.id().equals(id) && caller.role() != Role.ADMIN)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only manage your own account");
        }
    }

    private AppUser findOrThrow(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User " + id + " not found"));
    }
}
