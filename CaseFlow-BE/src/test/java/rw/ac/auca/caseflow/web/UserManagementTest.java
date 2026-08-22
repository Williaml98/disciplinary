package rw.ac.auca.caseflow.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.Role;
import rw.ac.auca.caseflow.email.EmailService;

/** Covers deactivation, the welcome-email/temp-password flow, delete impact, and user auditing. */
class UserManagementTest extends AbstractApiTest {

    @MockitoBean
    private EmailService emailService;

    @Autowired
    private PasswordEncoder encoder;

    private String authHeader(AppUser user) {
        return "Bearer " + tokenFor(user);
    }

    // ---- deactivation ----

    @Test
    void login_forDeactivatedAccount_isRejected() throws Exception {
        AppUser user = createUser("Suspended Staff", "suspended@auca.ac.rw", Role.LECTURER, null);
        user.setActive(false);
        userRepository.save(user);

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "suspended@auca.ac.rw", "password", DEFAULT_PASSWORD, "remember", false))))
                .andExpect(status().isForbidden())
                // Asserted via the reason rather than the body: MockMvc doesn't run the ERROR dispatch
                // that turns a ResponseStatusException into the {"message": ...} body a real client sees.
                .andExpect(status().reason(org.hamcrest.Matchers.containsString("deactivated")));
    }

    /** Tokens are stateless, so deactivation must be enforced per-request or it isn't enforced at all. */
    @Test
    void existingToken_forDeactivatedAccount_isRejected() throws Exception {
        AppUser user = createUser("Revoked Staff", "revoked@auca.ac.rw", Role.LECTURER, null);
        String token = "Bearer " + tokenFor(user);

        mockMvc.perform(get("/api/cases").header("Authorization", token)).andExpect(status().isOk());

        user.setActive(false);
        userRepository.save(user);

        mockMvc.perform(get("/api/cases").header("Authorization", token)).andExpect(status().isUnauthorized());
    }

    @Test
    void deactivateAndReactivate_asAdmin_togglesAndEmails() throws Exception {
        AppUser admin = createUser("Admin Deact", "admindeact@auca.ac.rw", Role.ADMIN, null);
        AppUser target = createUser("Target User", "target@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(patch("/api/users/" + target.getId() + "/status").header("Authorization", authHeader(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("active", false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
        verify(emailService).sendAccountDeactivated(eq("target@auca.ac.rw"), any());

        mockMvc.perform(patch("/api/users/" + target.getId() + "/status").header("Authorization", authHeader(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("active", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
        verify(emailService).sendAccountReactivated(eq("target@auca.ac.rw"), any());
    }

    @Test
    void deactivatingYourself_isRejected() throws Exception {
        AppUser admin = createUser("Admin Self", "adminself@auca.ac.rw", Role.ADMIN, null);

        mockMvc.perform(patch("/api/users/" + admin.getId() + "/status").header("Authorization", authHeader(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("active", false))))
                .andExpect(status().isConflict());
    }

    @Test
    void deactivate_asNonAdmin_isForbidden() throws Exception {
        AppUser lecturer = createUser("Plain Lecturer", "plain@auca.ac.rw", Role.LECTURER, null);
        AppUser target = createUser("Other User", "other@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(patch("/api/users/" + target.getId() + "/status").header("Authorization", authHeader(lecturer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("active", false))))
                .andExpect(status().isForbidden());
    }

    // ---- admin-created accounts get a generated temporary password ----

    @Test
    void createUser_asAdmin_generatesTempPasswordAndEmailsIt() throws Exception {
        AppUser admin = createUser("Admin Create", "admincreate@auca.ac.rw", Role.ADMIN, null);

        mockMvc.perform(post("/api/users").header("Authorization", authHeader(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "New Lecturer", "role", "lecturer",
                                "department", "Computer Science",
                                "email", "newlect@auca.ac.rw",
                                // Deliberately supplied: the admin's value must be ignored entirely.
                                "password", "AdminChosenPassword1!"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mustChangePassword").value(true));

        ArgumentCaptor<String> passwordCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendWelcome(eq("newlect@auca.ac.rw"), eq("New Lecturer"), any(),
                passwordCaptor.capture());

        String emailed = passwordCaptor.getValue();
        assertThat(emailed).isNotEqualTo("AdminChosenPassword1!");

        AppUser created = userRepository.findByEmailIgnoreCase("newlect@auca.ac.rw").orElseThrow();
        assertThat(encoder.matches(emailed, created.getPasswordHash())).isTrue();
        assertThat(encoder.matches("AdminChosenPassword1!", created.getPasswordHash())).isFalse();
    }

    /**
     * The bootstrap path must keep honouring the supplied password: a fresh install may have no working
     * SMTP, and generating-and-emailing would lock the operator out of the system entirely.
     */
    @Test
    void createUser_duringBootstrap_usesSuppliedPasswordAndSendsNoEmail() throws Exception {
        assertThat(userRepository.count()).isZero();

        mockMvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "First Admin", "role", "admin",
                                "email", "bootstrap@auca.ac.rw", "password", "BootstrapPass123!"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mustChangePassword").value(false));

        verify(emailService, never()).sendWelcome(any(), any(), any(), any());

        AppUser created = userRepository.findByEmailIgnoreCase("bootstrap@auca.ac.rw").orElseThrow();
        assertThat(encoder.matches("BootstrapPass123!", created.getPasswordHash())).isTrue();
    }

    @Test
    void changingPassword_clearsTheForcedChangeFlag() throws Exception {
        AppUser user = createUser("Temp Pw User", "temppw@auca.ac.rw", Role.LECTURER, null);
        user.setMustChangePassword(true);
        userRepository.save(user);

        mockMvc.perform(post("/api/users/" + user.getId() + "/password").header("Authorization", authHeader(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", DEFAULT_PASSWORD, "newPassword", "BrandNewPass1!"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mustChangePassword").value(false));
    }

    // ---- guards on self-modification ----

    @Test
    void deletingYourself_isRejected() throws Exception {
        AppUser admin = createUser("Admin NoSelfDelete", "nodelete@auca.ac.rw", Role.ADMIN, null);

        mockMvc.perform(delete("/api/users/" + admin.getId()).header("Authorization", authHeader(admin)))
                .andExpect(status().isConflict());
        assertThat(userRepository.existsById(admin.getId())).isTrue();
    }

    @Test
    void demotingYourself_isRejected() throws Exception {
        AppUser admin = createUser("Admin NoSelfDemote", "nodemote@auca.ac.rw", Role.ADMIN, null);

        mockMvc.perform(patch("/api/users/" + admin.getId() + "/role").header("Authorization", authHeader(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("role", "lecturer"))))
                .andExpect(status().isConflict());
    }

    /** studentId is the only key tying a student to their case, so self-service edits must not touch it. */
    @Test
    void student_cannotChangeTheirOwnStudentId() throws Exception {
        AppUser student = createUser("Student Id", "studentid@student.auca.ac.rw", Role.STUDENT, "30001");

        mockMvc.perform(patch("/api/users/" + student.getId()).header("Authorization", authHeader(student))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Student Id", "email", "studentid@student.auca.ac.rw",
                                "studentId", "99999"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void updateProfile_toAnExistingEmail_isConflictNotServerError() throws Exception {
        createUser("Taken", "taken@auca.ac.rw", Role.LECTURER, null);
        AppUser user = createUser("Mover", "mover@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(patch("/api/users/" + user.getId()).header("Authorization", authHeader(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Mover", "email", "taken@auca.ac.rw"))))
                .andExpect(status().isConflict());
    }

    // ---- pagination, stats, impact ----

    @Test
    void listUsers_isPaginatedAndSearchable() throws Exception {
        AppUser admin = createUser("Admin Page", "adminpage@auca.ac.rw", Role.ADMIN, null);
        createUser("Alice Uwase", "alice@auca.ac.rw", Role.LECTURER, null);
        createUser("Bob Habimana", "bob@auca.ac.rw", Role.COMMITTEE, null);

        mockMvc.perform(get("/api/users").header("Authorization", authHeader(admin))
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.first").value(true));

        mockMvc.perform(get("/api/users").header("Authorization", authHeader(admin))
                        .param("search", "alice"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].email").value("alice@auca.ac.rw"));

        mockMvc.perform(get("/api/users").header("Authorization", authHeader(admin))
                        .param("role", "committee"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    /** An unknown sort property used to reach the repository and surface as a 500. */
    @Test
    void listUsers_withUnknownSortProperty_doesNotFail() throws Exception {
        AppUser admin = createUser("Admin Sort", "adminsort@auca.ac.rw", Role.ADMIN, null);

        mockMvc.perform(get("/api/users").header("Authorization", authHeader(admin))
                        .param("sort", "passwordHash,desc"))
                .andExpect(status().isOk());
    }

    @Test
    void userStats_countsByRole() throws Exception {
        AppUser admin = createUser("Admin Stats", "adminstats@auca.ac.rw", Role.ADMIN, null);
        createUser("L1", "l1@auca.ac.rw", Role.LECTURER, null);
        createUser("L2", "l2@auca.ac.rw", Role.LECTURER, null);
        createUser("S1", "s1@student.auca.ac.rw", Role.STUDENT, "40001");

        mockMvc.perform(get("/api/users/stats").header("Authorization", authHeader(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(4))
                .andExpect(jsonPath("$.lecturer").value(2))
                .andExpect(jsonPath("$.student").value(1))
                .andExpect(jsonPath("$.admin").value(1));
    }

    @Test
    void deleteImpact_reportsWhatWouldBeOrphaned() throws Exception {
        AppUser admin = createUser("Admin Impact", "adminimpact@auca.ac.rw", Role.ADMIN, null);
        AppUser lecturer = createUser("Busy Lecturer", "busy@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(post("/api/cases").header("Authorization", authHeader(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "studentName", "Some Student", "studentId", "40002",
                                "reportedBy", "Busy Lecturer", "reporterDepartment", "CS",
                                "offenseType", "Plagiarism", "description", "d", "evidence", "e"))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/users/" + lecturer.getId() + "/impact")
                        .header("Authorization", authHeader(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.casesReported").value(1))
                .andExpect(jsonPath("$.isSelf").value(false));
    }

    /**
     * Regression: resetting via "Forgot password" left mustChangePassword set, so the user set a real
     * password and was then immediately bounced back to the forced-change screen.
     */
    @Test
    void resettingPasswordAlsoClearsTheForcedChangeFlag() throws Exception {
        AppUser user = createUser("Reset Flag", "resetflag@auca.ac.rw", Role.LECTURER, null);
        user.setMustChangePassword(true);
        userRepository.save(user);

        mockMvc.perform(post("/api/auth/password/reset/otp").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "resetflag@auca.ac.rw"))))
                .andExpect(status().isNoContent());

        ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendPasswordResetCode(eq("resetflag@auca.ac.rw"), code.capture());

        mockMvc.perform(post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "resetflag@auca.ac.rw",
                                "otp", code.getValue(),
                                "newPassword", "ChosenByMe1!"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.mustChangePassword").value(false));
    }

    // ---- profile pictures ----

    /** A real 1x1 PNG — ProfilePictureStorage sniffs magic bytes, so a dummy byte array is rejected. */
    private static final byte[] PNG =
            {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};

    @Test
    void uploadProfilePicture_returnsAResolvablePath() throws Exception {
        AppUser user = createUser("Picture User", "picture@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(multipart("/api/users/" + user.getId() + "/picture")
                        .file(new MockMultipartFile("file", "me.png", "image/png", PNG))
                        .header("Authorization", authHeader(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profilePictureUrl")
                        .value(org.hamcrest.Matchers.startsWith("/users/" + user.getId() + "/picture/")));
    }

    /**
     * Regression: the endpoint existed but was never added to SecurityConfig's permitAll list, so it
     * fell through to .anyRequest().authenticated(). A browser fetches avatars with a plain img tag,
     * which cannot send a bearer token — so every avatar 401'd and silently fell back to initials.
     */
    @Test
    void profilePicture_isReadableWithoutAuthentication() throws Exception {
        AppUser user = createUser("Anon Picture", "anonpic@auca.ac.rw", Role.LECTURER, null);

        String body = mockMvc.perform(multipart("/api/users/" + user.getId() + "/picture")
                        .file(new MockMultipartFile("file", "me.png", "image/png", PNG))
                        .header("Authorization", authHeader(user)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String path = objectMapper.readTree(body).get("profilePictureUrl").asText();

        // No Authorization header at all — exactly how an <img> tag requests it.
        mockMvc.perform(get("/api" + path))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .content().contentTypeCompatibleWith(MediaType.IMAGE_PNG));
    }

    @Test
    void uploadProfilePicture_rejectsAFileWhoseBytesDontMatchItsType() throws Exception {
        AppUser user = createUser("Bad Picture", "badpic@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(multipart("/api/users/" + user.getId() + "/picture")
                        .file(new MockMultipartFile("file", "evil.png", "image/png", "#!/bin/sh".getBytes()))
                        .header("Authorization", authHeader(user)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadProfilePicture_forSomeoneElse_isForbidden() throws Exception {
        AppUser owner = createUser("Owner", "owner@auca.ac.rw", Role.LECTURER, null);
        AppUser other = createUser("Other Lecturer", "otherlect@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(multipart("/api/users/" + owner.getId() + "/picture")
                        .file(new MockMultipartFile("file", "me.png", "image/png", PNG))
                        .header("Authorization", authHeader(other)))
                .andExpect(status().isForbidden());
    }
}
