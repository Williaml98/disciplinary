package rw.ac.auca.caseflow.web;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.Role;
import rw.ac.auca.caseflow.repository.UserRepository;
import rw.ac.auca.caseflow.security.AuthenticatedUser;
import rw.ac.auca.caseflow.security.JwtService;
import rw.ac.auca.caseflow.web.dto.AuthResponse;
import rw.ac.auca.caseflow.web.dto.LoginRequest;
import rw.ac.auca.caseflow.web.dto.RegisterStudentRequest;
import rw.ac.auca.caseflow.web.dto.UserResponse;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        AppUser user = userRepository.findByEmailIgnoreCase(request.email())
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        return new AuthResponse(jwtService.generateToken(user, request.remember()), UserResponse.from(user));
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterStudentRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        AppUser user = new AppUser(
                request.name(),
                Role.STUDENT,
                null,
                request.studentId(),
                request.email(),
                passwordEncoder.encode(request.password())
        );
        AppUser saved = userRepository.save(user);
        return new AuthResponse(jwtService.generateToken(saved, false), UserResponse.from(saved));
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal AuthenticatedUser caller) {
        AppUser user = userRepository.findById(caller.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account no longer exists"));
        return UserResponse.from(user);
    }
}
