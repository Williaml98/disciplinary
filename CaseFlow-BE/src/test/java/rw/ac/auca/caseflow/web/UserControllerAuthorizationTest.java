package rw.ac.auca.caseflow.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.Role;

class UserControllerAuthorizationTest extends AbstractApiTest {

    private String authHeader(AppUser user) {
        return "Bearer " + tokenFor(user);
    }

    // ---- list users (admin only) ----

    @Test
    void listUsers_asAdmin_succeeds() throws Exception {
        AppUser admin = createUser("Admin One", "admin1@auca.ac.rw", Role.ADMIN, null);

        mockMvc.perform(get("/api/users").header("Authorization", authHeader(admin)))
                .andExpect(status().isOk());
    }

    @Test
    void listUsers_asNonAdmin_isForbidden() throws Exception {
        AppUser lecturer = createUser("Lecturer", "lect@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(get("/api/users").header("Authorization", authHeader(lecturer)))
                .andExpect(status().isForbidden());
    }

    @Test
    void listUsers_withoutToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/users")).andExpect(status().isUnauthorized());
    }

    // ---- create user / bootstrap window ----

    @Test
    void createUser_whenDatabaseIsEmpty_isOpenWithoutAuthentication() throws Exception {
        assertThat(userRepository.count()).isZero();

        mockMvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "First Admin", "role", "admin",
                                "email", "firstadmin@auca.ac.rw", "password", "SecurePass123!"))))
                .andExpect(status().isCreated());
    }

    @Test
    void createUser_whenUsersExist_andCallerIsAdmin_succeeds() throws Exception {
        AppUser admin = createUser("Admin Two", "admin2@auca.ac.rw", Role.ADMIN, null);

        mockMvc.perform(post("/api/users").header("Authorization", authHeader(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "New Lecturer", "role", "lecturer",
                                "email", "newlect@auca.ac.rw", "password", "SecurePass123!"))))
                .andExpect(status().isCreated());
    }

    @Test
    void createUser_whenUsersExist_andCallerIsNotAdmin_isForbidden() throws Exception {
        AppUser lecturer = createUser("Lecturer Guard", "lectguard@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(post("/api/users").header("Authorization", authHeader(lecturer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Sneaky", "role", "admin",
                                "email", "sneaky@auca.ac.rw", "password", "SecurePass123!"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void createUser_whenUsersExist_andCallerIsUnauthenticated_isForbidden() throws Exception {
        createUser("Someone", "someone@auca.ac.rw", Role.STUDENT, "40000");

        mockMvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Sneaky Two", "role", "admin",
                                "email", "sneaky2@auca.ac.rw", "password", "SecurePass123!"))))
                .andExpect(status().isForbidden());
    }

    // ---- update role (admin only) ----

    @Test
    void updateRole_asAdmin_succeeds() throws Exception {
        AppUser admin = createUser("Admin Three", "admin3@auca.ac.rw", Role.ADMIN, null);
        AppUser target = createUser("Target One", "target1@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(patch("/api/users/" + target.getId() + "/role").header("Authorization", authHeader(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("role", "committee"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("committee"));
    }

    @Test
    void updateRole_asNonAdmin_isForbidden() throws Exception {
        AppUser lecturer = createUser("Lecturer Four", "lect4@auca.ac.rw", Role.LECTURER, null);
        AppUser target = createUser("Target Two", "target2@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(patch("/api/users/" + target.getId() + "/role").header("Authorization", authHeader(lecturer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("role", "admin"))))
                .andExpect(status().isForbidden());
    }

    // ---- delete user (admin only) ----

    @Test
    void deleteUser_asAdmin_succeeds() throws Exception {
        AppUser admin = createUser("Admin Four", "admin4@auca.ac.rw", Role.ADMIN, null);
        AppUser target = createUser("Target Three", "target3@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(delete("/api/users/" + target.getId()).header("Authorization", authHeader(admin)))
                .andExpect(status().isNoContent());
        assertThat(userRepository.existsById(target.getId())).isFalse();
    }

    @Test
    void deleteUser_asNonAdmin_isForbidden() throws Exception {
        AppUser lecturer = createUser("Lecturer Five", "lect5@auca.ac.rw", Role.LECTURER, null);
        AppUser target = createUser("Target Four", "target4@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(delete("/api/users/" + target.getId()).header("Authorization", authHeader(lecturer)))
                .andExpect(status().isForbidden());
        assertThat(userRepository.existsById(target.getId())).isTrue();
    }

    // ---- profile update: self or admin ----

    @Test
    void updateProfile_asSelf_succeeds() throws Exception {
        AppUser user = createUser("Self Updater", "self@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(patch("/api/users/" + user.getId()).header("Authorization", authHeader(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Self Updated Name", "email", "self@auca.ac.rw"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Self Updated Name"));
    }

    @Test
    void updateProfile_asAnotherNonAdminUser_isForbidden() throws Exception {
        AppUser bystander = createUser("Bystander", "bystander@auca.ac.rw", Role.LECTURER, null);
        AppUser target = createUser("Victim", "victim@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(patch("/api/users/" + target.getId()).header("Authorization", authHeader(bystander))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Hijacked Name", "email", "victim@auca.ac.rw"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void updateProfile_asAdmin_forAnotherUser_succeeds() throws Exception {
        AppUser admin = createUser("Admin Five", "admin5@auca.ac.rw", Role.ADMIN, null);
        AppUser target = createUser("Target Five", "target5@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(patch("/api/users/" + target.getId()).header("Authorization", authHeader(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Admin Renamed", "email", "target5@auca.ac.rw"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Admin Renamed"));
    }

    // ---- change password ----

    @Test
    void changePassword_withCorrectCurrentPassword_succeeds() throws Exception {
        AppUser user = createUser("Password Changer", "pwchange@auca.ac.rw", Role.STUDENT, "50001");

        mockMvc.perform(post("/api/users/" + user.getId() + "/password").header("Authorization", authHeader(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", DEFAULT_PASSWORD, "newPassword", "BrandNewSecure123!"))))
                .andExpect(status().isOk());
    }

    @Test
    void changePassword_withWrongCurrentPassword_isRejected() throws Exception {
        AppUser user = createUser("Password Changer Two", "pwchange2@auca.ac.rw", Role.STUDENT, "50002");

        mockMvc.perform(post("/api/users/" + user.getId() + "/password").header("Authorization", authHeader(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", "TotallyWrongPassword!", "newPassword", "BrandNewSecure123!"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void changePassword_forAnotherNonAdminUser_isForbidden() throws Exception {
        AppUser bystander = createUser("Bystander Two", "bystander2@auca.ac.rw", Role.LECTURER, null);
        AppUser target = createUser("Victim Two", "victim2@auca.ac.rw", Role.LECTURER, null);

        mockMvc.perform(post("/api/users/" + target.getId() + "/password").header("Authorization", authHeader(bystander))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", DEFAULT_PASSWORD, "newPassword", "Hijacked123!"))))
                .andExpect(status().isForbidden());
    }
}
