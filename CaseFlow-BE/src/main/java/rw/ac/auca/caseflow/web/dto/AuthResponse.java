package rw.ac.auca.caseflow.web.dto;

public record AuthResponse(
        String token,
        UserResponse user
) {
}
