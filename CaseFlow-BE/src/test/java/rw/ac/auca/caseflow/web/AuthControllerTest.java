package rw.ac.auca.caseflow.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.Role;
import rw.ac.auca.caseflow.email.EmailService;

class AuthControllerTest extends AbstractApiTest {

    @MockitoBean
    private EmailService emailService;

    // ---- login ----

    @Test
    void login_withCorrectCredentials_returnsTokenAndUser() throws Exception {
        createUser("Bob Lecturer", "bob@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", "bob@auca.ac.rw", "password", DEFAULT_PASSWORD, "remember", false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value("bob@auca.ac.rw"))
                .andExpect(jsonPath("$.user.role").value("lecturer"));
    }

    @Test
    void login_withWrongPassword_returnsUnauthorized() throws Exception {
        createUser("Bob Lecturer", "bob2@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", "bob2@auca.ac.rw", "password", "WrongPassword!", "remember", false))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_withUnknownEmail_returnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", "nobody@auca.ac.rw", "password", "whatever", "remember", false))))
                .andExpect(status().isUnauthorized());
    }

    // ---- /me ----

    @Test
    void me_withoutToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void me_withValidToken_returnsCallersOwnRecord() throws Exception {
        AppUser user = createUser("Alice Admin", "alice@auca.ac.rw", Role.ADMIN, null);

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + tokenFor(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("alice@auca.ac.rw"))
                .andExpect(jsonPath("$.role").value("admin"));
    }

    // ---- registration OTP flow ----

    @Test
    void registerFlow_sendVerifyThenRegister_createsAccountAndLogsIn() throws Exception {
        String email = "newstudent@student.auca.ac.rw";

        mockMvc.perform(post("/api/auth/register/otp").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email))))
                .andExpect(status().isNoContent());

        ArgumentCaptor<String> codeCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendOtpCode(eq(email), codeCaptor.capture());
        String code = codeCaptor.getValue();

        mockMvc.perform(post("/api/auth/register/otp/verify").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "otp", code))))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "New Student", "studentId", "99999",
                                "department", "Information Technology",
                                "email", email, "password", "SecurePass123!", "otp", code))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.user.role").value("student"))
                .andExpect(jsonPath("$.user.email").value(email))
                // Registration used to hardcode department to null regardless of what was submitted.
                .andExpect(jsonPath("$.user.department").value("Information Technology"));

        assertThat(userRepository.existsByEmailIgnoreCase(email)).isTrue();
    }

    @Test
    void register_withWrongOtp_isRejectedAndCreatesNoAccount() throws Exception {
        String email = "wrongotp@student.auca.ac.rw";
        mockMvc.perform(post("/api/auth/register/otp").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email))))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "New Student", "studentId", "99998",
                                "department", "Information Technology",
                                "email", email, "password", "SecurePass123!", "otp", "000000"))))
                .andExpect(status().isBadRequest());

        assertThat(userRepository.existsByEmailIgnoreCase(email)).isFalse();
    }

    @Test
    void registerOtp_forAlreadyRegisteredEmail_returnsConflict() throws Exception {
        createUser("Existing Student", "dup@student.auca.ac.rw", Role.STUDENT, "11111");

        mockMvc.perform(post("/api/auth/register/otp").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "dup@student.auca.ac.rw"))))
                .andExpect(status().isConflict());
    }

    // ---- forgot-password flow ----

    @Test
    void passwordResetFlow_sendThenReset_updatesPasswordAndLogsIn() throws Exception {
        AppUser user = createUser("Reset Me", "resetflow@auca.ac.rw", Role.STUDENT, "22222");

        mockMvc.perform(post("/api/auth/password/reset/otp").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", user.getEmail()))))
                .andExpect(status().isNoContent());

        ArgumentCaptor<String> codeCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendPasswordResetCode(eq(user.getEmail()), codeCaptor.capture());
        String code = codeCaptor.getValue();

        mockMvc.perform(post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", user.getEmail(), "otp", code, "newPassword", "BrandNewPass123!"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", user.getEmail(), "password", DEFAULT_PASSWORD, "remember", false))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", user.getEmail(), "password", "BrandNewPass123!", "remember", false))))
                .andExpect(status().isOk());
    }

    @Test
    void passwordResetOtp_forUnknownEmail_returnsNotFound() throws Exception {
        mockMvc.perform(post("/api/auth/password/reset/otp").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "doesnotexist@auca.ac.rw"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void passwordReset_withWrongOtp_isRejectedAndPasswordUnchanged() throws Exception {
        AppUser user = createUser("Reset Me Too", "resetwrong@auca.ac.rw", Role.STUDENT, "33333");
        mockMvc.perform(post("/api/auth/password/reset/otp").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", user.getEmail()))))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", user.getEmail(), "otp", "000000", "newPassword", "WontApply123!"))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", user.getEmail(), "password", DEFAULT_PASSWORD, "remember", false))))
                .andExpect(status().isOk());
    }
}
