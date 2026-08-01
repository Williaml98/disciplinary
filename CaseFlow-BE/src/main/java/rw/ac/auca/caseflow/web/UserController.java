package rw.ac.auca.caseflow.web;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.Role;
import rw.ac.auca.caseflow.repository.UserRepository;
import rw.ac.auca.caseflow.security.AuthenticatedUser;
import rw.ac.auca.caseflow.web.dto.CreateUserRequest;
import rw.ac.auca.caseflow.web.dto.PasswordChangeRequest;
import rw.ac.auca.caseflow.web.dto.ProfileUpdateRequest;
import rw.ac.auca.caseflow.web.dto.RoleUpdateRequest;
import rw.ac.auca.caseflow.web.dto.UserResponse;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserController(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserResponse> listUsers() {
        return userRepository.findAll().stream().map(UserResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse createUser(@Valid @RequestBody CreateUserRequest request) {
        // Open only to bootstrap the very first account on an empty database (there's no other
        // login-gated way to create it); once any user exists, only an admin may create more.
        boolean databaseIsEmpty = userRepository.count() == 0;
        if (!databaseIsEmpty) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            boolean isAdmin = authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser caller
                    && caller.role() == Role.ADMIN;
            if (!isAdmin) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only an admin can create new users");
            }
        }
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        AppUser user = new AppUser(
                request.name(),
                request.role(),
                request.department(),
                request.studentId(),
                request.email(),
                passwordEncoder.encode(request.password())
        );
        return UserResponse.from(userRepository.save(user));
    }

    @PatchMapping("/{id}")
    public UserResponse updateProfile(@PathVariable Long id, @Valid @RequestBody ProfileUpdateRequest request,
                                       @AuthenticationPrincipal AuthenticatedUser caller) {
        requireSelfOrAdmin(id, caller);
        AppUser user = findOrThrow(id);
        user.setName(request.name());
        user.setEmail(request.email());
        user.setDepartment(request.department());
        user.setStudentId(request.studentId());
        return UserResponse.from(userRepository.save(user));
    }

    @PatchMapping("/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponse updateRole(@PathVariable Long id, @Valid @RequestBody RoleUpdateRequest request) {
        AppUser user = findOrThrow(id);
        user.setRole(request.role());
        return UserResponse.from(userRepository.save(user));
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
        return UserResponse.from(userRepository.save(user));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteUser(@PathVariable Long id) {
        if (!userRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User " + id + " not found");
        }
        userRepository.deleteById(id);
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
