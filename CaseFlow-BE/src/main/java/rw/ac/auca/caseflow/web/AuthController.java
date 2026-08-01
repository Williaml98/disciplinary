package rw.ac.auca.caseflow.web;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.Role;
import rw.ac.auca.caseflow.email.EmailService;
import rw.ac.auca.caseflow.otp.OtpService;
import rw.ac.auca.caseflow.repository.UserRepository;
import rw.ac.auca.caseflow.security.AuthenticatedUser;
import rw.ac.auca.caseflow.security.JwtService;
import rw.ac.auca.caseflow.web.dto.AuthResponse;
import rw.ac.auca.caseflow.web.dto.LoginRequest;
import rw.ac.auca.caseflow.web.dto.RegisterStudentRequest;
import rw.ac.auca.caseflow.web.dto.ResetPasswordRequest;
import rw.ac.auca.caseflow.web.dto.SendOtpRequest;
import rw.ac.auca.caseflow.web.dto.UserResponse;
import rw.ac.auca.caseflow.web.dto.VerifyOtpRequest;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String REGISTER_PURPOSE = "register";
    private static final String RESET_PASSWORD_PURPOSE = "reset-password";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final OtpService otpService;
    private final EmailService emailService;

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
                           OtpService otpService, EmailService emailService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.otpService = otpService;
        this.emailService = emailService;
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        AppUser user = userRepository.findByEmailIgnoreCase(request.email())
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        return new AuthResponse(jwtService.generateToken(user, request.remember()), UserResponse.from(user));
    }

    @PostMapping("/register/otp")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void sendRegistrationOtp(@Valid @RequestBody SendOtpRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        otpService.sendCode(REGISTER_PURPOSE, request.email(), code -> emailService.sendOtpCode(request.email(), code));
    }

    @PostMapping("/register/otp/verify")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyRegistrationOtp(@Valid @RequestBody VerifyOtpRequest request) {
        otpService.verifyCode(REGISTER_PURPOSE, request.email(), request.otp());
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterStudentRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        otpService.verifyCode(REGISTER_PURPOSE, request.email(), request.otp());
        otpService.consume(REGISTER_PURPOSE, request.email());
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

    @PostMapping("/password/reset/otp")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void sendPasswordResetOtp(@Valid @RequestBody SendOtpRequest request) {
        AppUser user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No account found with that email"));
        otpService.sendCode(RESET_PASSWORD_PURPOSE, user.getEmail(), code -> emailService.sendPasswordResetCode(user.getEmail(), code));
    }

    @PostMapping("/password/reset")
    public AuthResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        AppUser user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No account found with that email"));
        otpService.verifyCode(RESET_PASSWORD_PURPOSE, request.email(), request.otp());
        otpService.consume(RESET_PASSWORD_PURPOSE, request.email());
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
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
